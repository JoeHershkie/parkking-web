import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  HelpCircle,
  X,
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
import { BottomSheet, type SheetDetent } from './BottomSheet'

type VerdictSheetProps = {
  verdict: CurbVerdict | null
  groups: CurbSideGroup[]
  selectedGroupKey: string | null
  onSelectGroup: (groupKey: string) => void
  onClose?: () => void
  onOpenLocation?: () => void
  onOpenTime?: () => void
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
      return 'border-status-allowed/40 bg-status-allowed-soft text-status-allowed'
    case 'not_allowed':
      return 'border-status-restricted/40 bg-status-restricted-soft text-status-restricted'
    case 'schedule_unclear':
      return 'border-status-unclear/40 bg-status-unclear-soft text-status-unclear'
  }
}

function statusStyles(status: CurbVerdict['status']) {
  switch (status) {
    case 'parking_allowed':
      return {
        icon: <CheckCircle2 className="h-5 w-5 text-status-allowed shrink-0" />,
        color: 'text-status-allowed',
        wrap: 'bg-status-allowed-soft border-status-allowed/30 text-status-allowed',
      }
    case 'likely_allowed':
      return {
        icon: <HelpCircle className="h-5 w-5 text-status-likely shrink-0" />,
        color: 'text-status-likely',
        wrap: 'bg-status-likely-soft border-status-likely/30 text-status-likely',
      }
    case 'schedule_unclear':
      return {
        icon: <AlertTriangle className="h-5 w-5 text-status-unclear shrink-0" />,
        color: 'text-status-unclear',
        wrap: 'bg-status-unclear-soft border-status-unclear/30 text-status-unclear',
      }
    case 'not_allowed':
      return {
        icon: <XCircle className="h-5 w-5 text-status-restricted shrink-0" />,
        color: 'text-status-restricted',
        wrap: 'bg-status-restricted-soft border-status-restricted/30 text-status-restricted',
      }
  }
}

export function VerdictSheet({
  verdict,
  groups,
  selectedGroupKey,
  onSelectGroup,
  onClose,
  onOpenLocation,
  onOpenTime,
  resolved,
  visible,
}: VerdictSheetProps) {
  const [detent, setDetent] = useState<SheetDetent>('peek')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string>('')

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
      setAnnouncement('Bylaw text copied to clipboard')
      setTimeout(() => {
        setCopiedKey(null)
        setAnnouncement('')
      }, 1600)
    } catch {
      // ignore
    }
  }

  const isExpanded = detent !== 'peek'

  return (
    <>
      {/* Screen reader live announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <BottomSheet
        open={visible}
        detent={detent}
        onDetentChange={setDetent}
        onClose={onClose}
      >
        <div className="space-y-2.5">
          {/* Header Summary */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="mt-0.5">{styles.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenLocation}
                    className="truncate text-base font-bold text-ink leading-snug hover:opacity-80 text-left"
                    title="Change location"
                  >
                    {street}
                  </button>
                  {onOpenTime && resolved.label && (
                    <button
                      type="button"
                      onClick={onOpenTime}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-300 transition"
                      title="Change check time"
                    >
                      <Clock className="h-3 w-3" />
                      <span>{resolved.label}</span>
                    </button>
                  )}
                </div>
                {side && (
                  <p className="text-xs font-semibold text-ink-muted">
                    {side}
                  </p>
                )}
                <p className={`text-xs font-bold ${styles.color}`}>
                  {verdict.headline}
                </p>
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="tap-target -mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Close verdict"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Primary Reason */}
          {verdict.primaryReason && (
            <p className="text-xs font-medium text-slate-700 leading-relaxed">
              {verdict.primaryReason}
            </p>
          )}

          {/* Max Stay Alert */}
          {verdict.maxStayWarning && (
            <div className="flex items-start gap-2 rounded-xl border border-status-restricted/30 bg-status-restricted-soft px-3 py-2 text-xs font-semibold text-status-restricted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{verdict.maxStayWarning}</span>
            </div>
          )}

          {/* Midnight Alert */}
          {verdict.midnightWarning && (
            <div className="rounded-xl border border-status-unclear/30 bg-status-unclear-soft px-3 py-2 text-xs font-semibold text-ink">
              {verdict.midnightWarning}
            </div>
          )}

          {/* Signage Disclaimer */}
          <p className="text-[11px] font-medium text-ink-subtle">
            {verdict.signageReminder}
          </p>

          {/* Toggle details button */}
          <button
            type="button"
            onClick={() => setDetent(detent === 'peek' ? 'medium' : 'peek')}
            className="tap-target flex w-full items-center justify-between rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-xs font-bold text-ink"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Hide rule details' : 'Show rule details'}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-ink-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-ink-muted" />
            )}
          </button>

          {/* Expanded Section (Nearby Sides + Rule Cards) */}
          {isExpanded && (
            <div className="space-y-4 pt-1">
              {/* Nearby curb sides */}
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
                        <div className="flex shrink-0 gap-1.5">
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
                                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border text-xs font-black transition ${sideChipTone(s.status)} ${
                                  selected
                                    ? 'ring-2 ring-slate-900 ring-offset-1 ring-offset-surface'
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

              {/* Rule Details List */}
              <div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                  Rule details ({verdict.contributingRules.length})
                </p>
                {verdict.contributingRules.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    No mapped curb rules at this point.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {verdict.contributingRules.map((rule, i) => {
                      const p = rule.feature.properties
                      const max = formatMaxStay(p.max, p.maxMinutes)
                      const hints = scheduleStatusHints(p.schedule)
                      const key = `${i}-${p.Highway}-${p.Rule}`
                      const isCopied = copiedKey === key

                      return (
                        <li
                          key={key}
                          className="rounded-2xl border border-border bg-surface-muted p-3.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-extrabold text-ink">
                              {scheduleCategoryLabel(p.schedule_category)}
                            </p>
                            <span className="shrink-0 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-700">
                              {rule.kind.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <dt className="font-extrabold uppercase tracking-wider text-ink-subtle text-[10px]">
                                Side
                              </dt>
                              <dd className="font-semibold text-ink">{p.Side}</dd>
                            </div>
                            {max && (
                              <div>
                                <dt className="font-extrabold uppercase tracking-wider text-ink-subtle text-[10px]">
                                  Max stay
                                </dt>
                                <dd className="font-semibold text-ink">{max}</dd>
                              </div>
                            )}
                          </dl>

                          <div className="mt-2.5">
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                                Bylaw text
                              </span>
                              <button
                                type="button"
                                onClick={() => void copyRule(p.Rule, key)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:opacity-80"
                                aria-label="Copy bylaw text"
                              >
                                {isCopied ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                {isCopied ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <p className="rounded-xl border border-border bg-surface px-3 py-2 text-[11px] italic leading-relaxed text-ink">
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
      </BottomSheet>
    </>
  )
}
