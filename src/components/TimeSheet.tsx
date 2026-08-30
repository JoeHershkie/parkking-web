import { useState } from 'react'
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

function draftCrossesMidnight(draft: TimeQuery): boolean {
  const start =
    draft.mode === 'now'
      ? new Date().getHours() * 60 + new Date().getMinutes()
      : draft.startMinute
  return start + draft.requestedDurationMinutes > 23 * 60 + 59
}

function TimeSheetForm({
  query,
  onClose,
  onApply,
  midnightPreview,
}: {
  query: TimeQuery
  onClose: () => void
  onApply: (next: TimeQuery) => void
  midnightPreview: boolean
}) {
  const [draft, setDraft] = useState<TimeQuery>(query)

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
    <div className="space-y-4 pb-2">
      {/* iOS Segmented Control */}
      <div className="flex rounded-full bg-slate-200/70 p-1">
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, mode: 'now' }))}
          className={`tap-target flex-1 rounded-full py-1.5 text-xs font-bold transition ${
            draft.mode === 'now'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Now
        </button>
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, mode: 'custom' }))}
          className={`tap-target flex-1 rounded-full py-1.5 text-xs font-bold transition ${
            draft.mode === 'custom'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Custom
        </button>
      </div>

      {/* Custom date & time pickers */}
      {draft.mode === 'custom' && (
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block min-w-0 max-w-full text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Date
            <input
              type="date"
              value={draft.date}
              onChange={(e) =>
                setDraft((d) => ({ ...d, date: e.target.value }))
              }
              className="tap-target mt-1 w-full min-w-0 max-w-full rounded-xl border border-border bg-surface-muted px-2.5 py-2 text-base font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
          <label className="block min-w-0 max-w-full text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Start Time
            <input
              type="time"
              value={minuteToTimeValue(draft.startMinute)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  startMinute: timeValueToMinute(e.target.value),
                }))
              }
              className="tap-target mt-1 w-full min-w-0 max-w-full rounded-xl border border-border bg-surface-muted px-2.5 py-2 text-base font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
        </div>
      )}

      {/* Duration chips */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          Duration
        </p>
        <div className="grid grid-cols-4 gap-2">
          {DURATION_PRESETS.map((mins) => {
            const selected =
              draft.durationPreset === mins &&
              draft.requestedDurationMinutes === mins
            return (
              <button
                key={mins}
                type="button"
                onClick={() => setPreset(mins)}
                className={`tap-target rounded-full border py-2.5 text-xs font-bold transition ${
                  selected
                    ? 'border-brand bg-brand/10 text-brand ring-1 ring-brand'
                    : 'border-border bg-surface text-ink hover:bg-surface-muted'
                }`}
              >
                {formatDurationLabel(mins)}
              </button>
            )
          })}
        </div>

        {draft.durationPreset === 'custom' ||
        !DURATION_PRESETS.includes(
          draft.requestedDurationMinutes as (typeof DURATION_PRESETS)[number],
        ) ? (
          <label className="mt-2.5 block text-[10px] font-bold uppercase tracking-wider text-ink-muted">
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
              className="tap-target mt-1 w-full min-w-0 max-w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-base font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setPreset('custom')}
            className="mt-2 text-xs font-bold text-brand hover:opacity-80"
          >
            Custom duration…
          </button>
        )}
      </div>

      {/* Midnight warning */}
      {(midnightPreview || draftCrossesMidnight(draft)) && (
        <div className="rounded-xl border border-status-unclear/30 bg-status-unclear-soft px-3 py-2 text-xs font-semibold text-ink">
          {MIDNIGHT_WARNING}
        </div>
      )}

      {/* Apply button */}
      <button
        type="button"
        onClick={handleApply}
        className="tap-target mt-2 w-full rounded-full bg-brand py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition active:scale-[0.99]"
      >
        Apply
      </button>
    </div>
  )
}

export function TimeSheet({
  open,
  onClose,
  query,
  onApply,
  midnightPreview,
}: TimeSheetProps) {
  return (
    <ModalSheet open={open} hideHeader={true} onClose={onClose} variant="bottom">
      {open && (
        <TimeSheetForm
          query={query}
          onClose={onClose}
          onApply={onApply}
          midnightPreview={midnightPreview}
        />
      )}
    </ModalSheet>
  )
}
