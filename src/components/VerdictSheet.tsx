import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  HelpCircle,
  XCircle,
} from 'lucide-react'
import { formatMaxStay, scheduleCategoryLabel } from '../lib/labels'
import type { CurbSideGroup } from '../lib/curbSelection'
import {
  composeCurbVerdictForQuery,
  scheduleStatusHints,
  type CurbVerdict,
  type CurbVerdictStatus,
} from '../lib/schedule'
import {
  compareSideAbbrevs,
  sideAbbrev,
} from '../lib/sideNormalize'
import type { ResolvedTimeQuery } from '../lib/timeQuery'

type VerdictSheetProps = {
  verdict: CurbVerdict | null
  groups: CurbSideGroup[]
  selectedGroupKey: string | null
  onSelectGroup: (groupKey: string) => void
  resolved: ResolvedTimeQuery
  visible: boolean
}

type StreetSideChip = {
  groupKey: string
  letter: string
  sideDisplay: string
  status: CurbVerdictStatus
}

type StreetRow = {
  street: string
  sides: StreetSideChip[]
}

function groupStreets(
  groups: CurbSideGroup[],
  statusByKey: Map<string, CurbVerdictStatus>,
): StreetRow[] {
  const rows = new Map<string, StreetRow>()
  for (const g of groups) {
    let row = rows.get(g.street)
    if (!row) {
      row = { street: g.street, sides: [] }
      rows.set(g.street, row)
    }
    row.sides.push({
      groupKey: g.groupKey,
      letter: sideAbbrev(g.side),
      sideDisplay: g.sideDisplay,
      status: statusByKey.get(g.groupKey) ?? 'schedule_unclear',
    })
  }
  for (const row of rows.values()) {
    row.sides.sort((a, b) => compareSideAbbrevs(a.letter, b.letter))
  }
  return [...rows.values()]
}

function sideChipTone(status: CurbVerdictStatus): string {
  switch (status) {
    case 'parking_allowed':
    case 'likely_allowed':
      return 'border-status-allowed/35 bg-status-allowed-soft text-status-allowed'
    case 'not_allowed':
      return 'border-status-restricted/35 bg-status-restricted-soft text-status-restricted'
    case 'schedule_unclear':
      return 'border-status-unclear/35 bg-status-unclear-soft text-status-unclear'
  }
}

function statusStyles(status: CurbVerdict['status']) {
  switch (status) {
    case 'parking_allowed':
      return {
        icon: <CheckCircle2 className="h-5 w-5 text-status-allowed" />,
        wrap: 'bg-status-allowed-soft border-status-allowed/30 text-status-allowed',
      }
    case 'likely_allowed':
      return {
        icon: <HelpCircle className="h-5 w-5 text-status-likely" />,
        wrap: 'bg-status-likely-soft border-status-likely/30 text-status-likely',
      }
    case 'schedule_unclear':
      return {
        icon: <AlertTriangle className="h-5 w-5 text-status-unclear" />,
        wrap: 'bg-status-unclear-soft border-status-unclear/30 text-status-unclear',
      }
    case 'not_allowed':
      return {
        icon: <XCircle className="h-5 w-5 text-status-restricted" />,
        wrap: 'bg-status-restricted-soft border-status-restricted/30 text-status-restricted',
      }
  }
}

export function VerdictSheet({
  verdict,
  groups,
  selectedGroupKey,
  onSelectGroup,
  resolved,
  visible,
}: VerdictSheetProps) {
  const [expanded, setExpanded] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const groupStatusByKey = useMemo(() => {
    const map = new Map<string, CurbVerdictStatus>()
    for (const g of groups) {
      const v = composeCurbVerdictForQuery(g.features, resolved, {
        street: g.street,
        side: g.side,
        sideDisplay: g.sideDisplay,
      })
      map.set(g.groupKey, v.status)
    }
    return map
  }, [groups, resolved])

  const streetRows = useMemo(
    () => groupStreets(groups, groupStatusByKey),
    [groups, groupStatusByKey],
  )

  if (!visible || !verdict) return null

  const styles = statusStyles(verdict.status) ?? statusStyles('schedule_unclear')
  const street = verdict.street ?? 'Selected location'
  const side = verdict.sideDisplay

  async function copyRule(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1600)
    } catch {
      // ignore
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 safe-pad-x safe-pad-bottom">
      <div className="pointer-events-auto mx-auto max-h-[78dvh] w-full max-w-[var(--overlay-max)] overflow-y-auto overscroll-contain">
        <div className="rounded-[var(--radius-sheet)] border border-border bg-surface p-4 shadow-sheet">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border-strong" />

          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 rounded-2xl border p-2.5 ${styles.wrap}`}
              aria-hidden
            >
              {styles.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-black text-ink">
                {street}
              </h2>
              {side && (
                <p className="mt-0.5 truncate text-xs font-medium text-ink-muted">
                  {side}
                </p>
              )}
              <p className="mt-1 text-sm font-extrabold text-ink">
                {verdict.headline}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-ink-muted">
                {resolved.label}
              </p>
            </div>
          </div>

          {verdict.primaryReason && (
            <p className="mt-2 text-xs font-semibold leading-relaxed text-ink">
              {verdict.primaryReason}
            </p>
          )}

          {verdict.maxStayWarning && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-status-restricted/30 bg-status-restricted-soft px-3 py-2 text-xs font-semibold text-status-restricted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{verdict.maxStayWarning}</span>
            </div>
          )}

          {verdict.midnightWarning && (
            <div className="mt-2 rounded-xl border border-status-unclear/30 bg-status-unclear-soft px-3 py-2 text-xs font-semibold text-ink">
              {verdict.midnightWarning}
            </div>
          )}

          <p className="mt-2 text-[11px] font-medium text-ink-subtle">
            {verdict.signageReminder}
          </p>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="tap-target mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-xs font-extrabold text-ink"
          >
            <span>{expanded ? 'Hide rule details' : 'Show rule details'}</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {expanded && (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              {groups.length > 1 && (
                <div>
                  <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                    Nearby curb sides
                  </p>
                  <ul className="space-y-1.5">
                    {streetRows.map((row) => (
                      <li
                        key={row.street}
                        className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-ink">
                          {row.street}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          {row.sides.map((s) => {
                            const selected = s.groupKey === selectedGroupKey
                            return (
                              <button
                                key={s.groupKey}
                                type="button"
                                title={`${s.sideDisplay}: ${s.status.replace(/_/g, ' ')}`}
                                aria-label={`${row.street} ${s.sideDisplay}`}
                                aria-pressed={selected}
                                onClick={() => onSelectGroup(s.groupKey)}
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-black ${sideChipTone(s.status)} ${
                                  selected
                                    ? 'ring-2 ring-brand/45 ring-offset-1 ring-offset-surface-muted'
                                    : ''
                                }`}
                              >
                                {s.letter}
                              </button>
                            )
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                  Rule details ({verdict.contributingRules.length})
                </p>
                {verdict.contributingRules.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    No mapped curb rules at this point.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {verdict.contributingRules.map((rule, i) => {
                      const p = rule.feature.properties
                      const max = formatMaxStay(p.max, p.maxMinutes)
                      const hints = scheduleStatusHints(p.schedule)
                      const key = `${i}-${p.Highway}-${p.Rule}`
                      return (
                        <li
                          key={key}
                          className="rounded-2xl border border-border bg-surface-muted p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-extrabold text-ink">
                              {scheduleCategoryLabel(p.schedule_category)}
                            </p>
                            <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold capitalize text-ink-muted">
                              {rule.kind.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <dt className="font-extrabold uppercase tracking-wider text-ink-subtle">
                                Side
                              </dt>
                              <dd className="font-semibold text-ink">{p.Side}</dd>
                            </div>
                            {max && (
                              <div>
                                <dt className="font-extrabold uppercase tracking-wider text-ink-subtle">
                                  Max stay
                                </dt>
                                <dd className="font-semibold text-ink">{max}</dd>
                              </div>
                            )}
                          </dl>
                          <div className="mt-2">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                                Bylaw text
                              </span>
                              <button
                                type="button"
                                onClick={() => void copyRule(p.Rule, key)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand"
                              >
                                {copiedKey === key ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                {copiedKey === key ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <p className="rounded-xl border border-border bg-surface px-2.5 py-2 font-mono text-[11px] italic leading-relaxed text-ink">
                              “{p.Rule}”
                            </p>
                          </div>
                          {hints.map((hint, hintIdx) => (
                            <p
                              key={`${key}-${hint.kind}-${hintIdx}`}
                              className="mt-2 text-[11px] font-semibold text-status-unclear"
                              title={hint.title}
                            >
                              {hint.text}
                            </p>
                          ))}
                          {p.schedule?.flags?.exceptPublicHolidays && (
                            <p className="mt-2 text-[11px] font-semibold text-teal-800">
                              Exempt on public holidays.
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
