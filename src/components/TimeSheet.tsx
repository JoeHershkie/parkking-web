import { useEffect, useState } from 'react'
import {
  DURATION_PRESETS,
  formatDurationLabel,
  MIDNIGHT_WARNING,
  type DurationPreset,
  type TimeQuery,
} from '../lib/timeQuery'
import { ModalSheet } from './ModalSheet'

type TimeSheetProps = {
  open: boolean
  onClose: () => void
  query: TimeQuery
  onApply: (next: TimeQuery) => void
  midnightPreview: boolean
}

function minuteToTimeValue(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeValueToMinute(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function TimeSheet({
  open,
  onClose,
  query,
  onApply,
  midnightPreview,
}: TimeSheetProps) {
  const [draft, setDraft] = useState<TimeQuery>(query)

  useEffect(() => {
    if (open) setDraft(query)
  }, [open, query])

  function setPreset(preset: DurationPreset) {
    if (preset === 'custom') {
      setDraft((d) => ({ ...d, durationPreset: 'custom' }))
      return
    }
    setDraft((d) => ({
      ...d,
      durationPreset: preset,
      requestedDurationMinutes: preset,
    }))
  }

  function handleApply() {
    onApply(draft)
    onClose()
  }

  return (
    <ModalSheet open={open} title="Check time & duration" onClose={onClose} variant="center">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, mode: 'now' }))}
            className={`tap-target rounded-xl border px-3 py-2.5 text-sm font-extrabold transition ${
              draft.mode === 'now'
                ? 'border-brand bg-brand text-white'
                : 'border-border bg-surface-muted text-ink'
            }`}
          >
            Now
          </button>
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, mode: 'custom' }))}
            className={`tap-target rounded-xl border px-3 py-2.5 text-sm font-extrabold transition ${
              draft.mode === 'custom'
                ? 'border-brand bg-brand text-white'
                : 'border-border bg-surface-muted text-ink'
            }`}
          >
            Custom
          </button>
        </div>

        {draft.mode === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
              Date
              <input
                type="date"
                value={draft.date}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date: e.target.value }))
                }
                className="tap-target mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-base font-bold text-ink"
              />
            </label>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
              Start
              <input
                type="time"
                value={minuteToTimeValue(draft.startMinute)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    startMinute: timeValueToMinute(e.target.value),
                  }))
                }
                className="tap-target mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-base font-bold text-ink"
              />
            </label>
          </div>
        )}

        <div>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
            Duration
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {DURATION_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setPreset(mins)}
                className={`tap-target rounded-xl border text-xs font-extrabold transition ${
                  draft.durationPreset === mins
                    ? 'border-brand bg-brand text-white'
                    : 'border-border bg-surface-muted text-ink'
                }`}
              >
                {formatDurationLabel(mins)}
              </button>
            ))}
          </div>
          {draft.durationPreset === 'custom' ||
          !DURATION_PRESETS.includes(
            draft.requestedDurationMinutes as (typeof DURATION_PRESETS)[number],
          ) ? (
            <label className="mt-2 block text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
              Custom minutes
              <input
                type="number"
                min={1}
                max={720}
                value={draft.requestedDurationMinutes}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    durationPreset: 'custom',
                    requestedDurationMinutes: Math.max(
                      1,
                      Number(e.target.value) || 1,
                    ),
                  }))
                }
                className="tap-target mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-base font-bold text-ink"
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setPreset('custom')}
              className="mt-2 text-xs font-bold text-brand"
            >
              Custom duration…
            </button>
          )}
        </div>

        {(midnightPreview || draftCrossesMidnight(draft)) && (
          <p className="rounded-xl border border-status-unclear/30 bg-status-unclear-soft px-3 py-2 text-xs font-semibold text-ink">
            {MIDNIGHT_WARNING}
          </p>
        )}

        <button
          type="button"
          onClick={handleApply}
          className="tap-target w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-md shadow-brand/20"
        >
          Apply
        </button>
      </div>
    </ModalSheet>
  )
}

function draftCrossesMidnight(draft: TimeQuery): boolean {
  const start =
    draft.mode === 'now'
      ? new Date().getHours() * 60 + new Date().getMinutes()
      : draft.startMinute
  return start + draft.requestedDurationMinutes > 23 * 60 + 59
}
