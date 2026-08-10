import type { ParkingFeature, ParkingProperties } from '../../types/parking'
import { formatMaxStay } from '../labels'
import { MIDNIGHT_WARNING, type ResolvedTimeQuery } from '../timeQuery'
import { evaluateInRange } from './evaluate'
import { scheduleStatusHints } from './display'
import type { FilterPolarity, Slot, SlotEvaluation } from './types'

export type CurbVerdictStatus =
  | 'parking_allowed'
  | 'not_allowed'
  | 'likely_allowed'
  | 'schedule_unclear'

export type RestrictionKind =
  | 'no_stopping'
  | 'no_standing'
  | 'no_parking'
  | 'permitted_window'
  | 'max_stay'
  | 'uncertain'

export type ContributingRule = {
  feature: ParkingFeature
  evaluation: SlotEvaluation
  kind: RestrictionKind | 'inactive' | 'allowed'
  reason: string
}

export type CurbVerdict = {
  status: CurbVerdictStatus
  headline: string
  primaryReason: string | null
  contributingRules: ContributingRule[]
  activeRestrictions: ContributingRule[]
  uncertaintyNotes: string[]
  maxStayWarning: string | null
  midnightWarning: string | null
  signageReminder: string
  street: string | null
  side: string | null
  sideDisplay: string | null
}

const SIGNAGE_REMINDER = 'Check posted signs.'

const RESTRICTION_PRECEDENCE: Record<RestrictionKind, number> = {
  no_stopping: 0,
  no_standing: 1,
  no_parking: 2,
  permitted_window: 3,
  max_stay: 4,
  uncertain: 5,
}

const HEADLINES: Record<CurbVerdictStatus, string> = {
  parking_allowed: 'Parking allowed',
  not_allowed: 'Not allowed',
  likely_allowed: 'Likely allowed',
  schedule_unclear: 'Schedule unclear',
}

function categoryKind(
  category: ParkingProperties['schedule_category'],
): RestrictionKind | null {
  if (category === 'no_stopping') return 'no_stopping'
  if (category === 'no_standing') return 'no_standing'
  if (category === 'no_parking') return 'no_parking'
  if (category === 'restricted_periods') return 'permitted_window'
  return null
}

function reasonForRestriction(
  kind: RestrictionKind,
  props: ParkingProperties,
  polarity: FilterPolarity,
): string {
  switch (kind) {
    case 'no_stopping':
      return 'No stopping is in effect for part of this interval.'
    case 'no_standing':
      return 'No standing is in effect for part of this interval.'
    case 'no_parking':
      return 'No parking is in effect for part of this interval.'
    case 'permitted_window':
      return polarity === 'not_permitted'
        ? 'Outside the permitted parking window.'
        : 'Permitted-window rule applies.'
    case 'max_stay': {
      const max = formatMaxStay(props.max, props.maxMinutes)
      return max
        ? `Requested stay exceeds max stay of ${max}.`
        : 'Requested stay exceeds the posted max stay.'
    }
    case 'uncertain':
      return 'Schedule data is incomplete for this rule.'
  }
}

function maxStayViolated(
  props: ParkingProperties,
  requestedDurationMinutes: number,
): boolean {
  if (requestedDurationMinutes <= 0) return false
  const maxMinutes = props.maxMinutes
  if (maxMinutes != null && maxMinutes > 0) {
    return requestedDurationMinutes > maxMinutes
  }
  return false
}

function classifyRule(
  feature: ParkingFeature,
  evaluation: SlotEvaluation,
  requestedDurationMinutes: number,
): ContributingRule {
  const props = feature.properties
  const { polarity } = evaluation

  if (evaluation.failed || evaluation.unparsed || polarity === 'unknown') {
    return {
      feature,
      evaluation,
      kind: 'uncertain',
      reason: reasonForRestriction('uncertain', props, polarity),
    }
  }

  if (polarity === 'restricted') {
    const kind = categoryKind(props.schedule_category) ?? 'no_parking'
    return {
      feature,
      evaluation,
      kind,
      reason: reasonForRestriction(kind, props, polarity),
    }
  }

  if (polarity === 'not_permitted') {
    return {
      feature,
      evaluation,
      kind: 'permitted_window',
      reason: reasonForRestriction('permitted_window', props, polarity),
    }
  }

  // Active permitted window or inactive restriction — check max stay when parking is otherwise ok.
  if (
    (polarity === 'permitted' || polarity === 'inactive') &&
    maxStayViolated(props, requestedDurationMinutes)
  ) {
    return {
      feature,
      evaluation,
      kind: 'max_stay',
      reason: reasonForRestriction('max_stay', props, polarity),
    }
  }

  if (polarity === 'permitted') {
    return {
      feature,
      evaluation,
      kind: 'allowed',
      reason: 'Parking is permitted under this rule.',
    }
  }

  return {
    feature,
    evaluation,
    kind: 'inactive',
    reason: 'Restriction is not active for this interval.',
  }
}

function pickPrimary(
  restrictions: ContributingRule[],
): ContributingRule | null {
  if (restrictions.length === 0) return null
  return [...restrictions].sort((a, b) => {
    const ak =
      a.kind in RESTRICTION_PRECEDENCE
        ? RESTRICTION_PRECEDENCE[a.kind as RestrictionKind]
        : 99
    const bk =
      b.kind in RESTRICTION_PRECEDENCE
        ? RESTRICTION_PRECEDENCE[b.kind as RestrictionKind]
        : 99
    return ak - bk
  })[0]
}

export type ComposeCurbVerdictOptions = {
  features: ParkingFeature[]
  slot: Slot
  effectiveEndMinute: number | null
  requestedDurationMinutes: number
  truncatedAtMidnight?: boolean
  includeUnknown?: boolean
  street?: string | null
  side?: string | null
  sideDisplay?: string | null
}

/**
 * Compose all local overlapping rules for one curb side into a single verdict.
 * Known restrictions override uncertainty. Precedence:
 * no stopping → no standing → no parking → permitted-window → max-stay.
 */
export function composeCurbVerdict(
  options: ComposeCurbVerdictOptions,
): CurbVerdict {
  const {
    features,
    slot,
    effectiveEndMinute,
    requestedDurationMinutes,
    truncatedAtMidnight = false,
    includeUnknown = true,
    street = null,
    side = null,
    sideDisplay = null,
  } = options

  const midnightWarning = truncatedAtMidnight ? MIDNIGHT_WARNING : null

  if (features.length === 0) {
    return {
      status: 'likely_allowed',
      headline: HEADLINES.likely_allowed,
      primaryReason:
        'No mapped restriction found; data may be incomplete.',
      contributingRules: [],
      activeRestrictions: [],
      uncertaintyNotes: [
        'No mapped restriction found; data may be incomplete.',
      ],
      maxStayWarning: null,
      midnightWarning,
      signageReminder: SIGNAGE_REMINDER,
      street,
      side,
      sideDisplay,
    }
  }

  const contributingRules = features.map((feature) => {
    const evaluation = evaluateInRange(
      feature.properties,
      slot,
      effectiveEndMinute,
      includeUnknown,
    )
    return classifyRule(feature, evaluation, requestedDurationMinutes)
  })

  // Complementary permitted-window signs: being outside one window must not
  // ban parking when another overlapping rule on the same curb is actively
  // permitting the interval (e.g. 10-minute school window vs daytime 1-hour).
  const hasActivePermit = contributingRules.some((r) => r.kind === 'allowed')
  const normalizedRules = hasActivePermit
    ? contributingRules.map((r) =>
        r.kind === 'permitted_window'
          ? {
              ...r,
              kind: 'inactive' as const,
              reason: 'Another posted rule covers this interval.',
            }
          : r,
      )
    : contributingRules

  const hardRestrictions = normalizedRules.filter((r) =>
    (
      [
        'no_stopping',
        'no_standing',
        'no_parking',
        'permitted_window',
        'max_stay',
      ] as RestrictionKind[]
    ).includes(r.kind as RestrictionKind),
  )

  const uncertainRules = normalizedRules.filter((r) => r.kind === 'uncertain')

  const uncertaintyNotes: string[] = []
  for (const rule of uncertainRules) {
    const hints = scheduleStatusHints(rule.feature.properties.schedule)
    if (hints.length > 0) {
      for (const hint of hints) uncertaintyNotes.push(hint.text)
    } else if (!rule.feature.properties.schedule) {
      uncertaintyNotes.push('No schedule data for a mapped rule.')
    } else {
      uncertaintyNotes.push(rule.reason)
    }
  }

  const maxStayRule = hardRestrictions.find((r) => r.kind === 'max_stay')
  const maxStayWarning = maxStayRule?.reason ?? null

  // Known restrictions override uncertainty.
  if (hardRestrictions.length > 0) {
    const primary = pickPrimary(hardRestrictions)!
    return {
      status: 'not_allowed',
      headline: HEADLINES.not_allowed,
      primaryReason: primary.reason,
      contributingRules: normalizedRules,
      activeRestrictions: hardRestrictions,
      uncertaintyNotes: [...new Set(uncertaintyNotes)],
      maxStayWarning,
      midnightWarning,
      signageReminder: SIGNAGE_REMINDER,
      street,
      side,
      sideDisplay,
    }
  }

  if (uncertainRules.length > 0) {
    return {
      status: 'schedule_unclear',
      headline: HEADLINES.schedule_unclear,
      primaryReason:
        uncertaintyNotes[0] ??
        'Missing or incomplete schedule data prevents a reliable answer.',
      contributingRules: normalizedRules,
      activeRestrictions: [],
      uncertaintyNotes: [...new Set(uncertaintyNotes)],
      maxStayWarning: null,
      midnightWarning,
      signageReminder: SIGNAGE_REMINDER,
      street,
      side,
      sideDisplay,
    }
  }

  return {
    status: 'parking_allowed',
    headline: HEADLINES.parking_allowed,
    primaryReason: 'Mapped rules permit this interval.',
    contributingRules: normalizedRules,
    activeRestrictions: [],
    uncertaintyNotes: [],
    maxStayWarning: null,
    midnightWarning,
    signageReminder: SIGNAGE_REMINDER,
    street,
    side,
    sideDisplay,
  }
}

export function composeCurbVerdictForQuery(
  features: ParkingFeature[],
  resolved: ResolvedTimeQuery,
  meta?: {
    street?: string | null
    side?: string | null
    sideDisplay?: string | null
  },
): CurbVerdict {
  return composeCurbVerdict({
    features,
    slot: resolved.slot,
    effectiveEndMinute: resolved.effectiveEndMinute,
    requestedDurationMinutes: resolved.requestedDurationMinutes,
    truncatedAtMidnight: resolved.truncatedAtMidnight,
    street: meta?.street ?? null,
    side: meta?.side ?? null,
    sideDisplay: meta?.sideDisplay ?? null,
  })
}
