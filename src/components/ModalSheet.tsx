import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type SheetProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** bottom sheet (default) or centered modal */
  variant?: 'bottom' | 'center'
}

export function ModalSheet({
  open,
  title,
  onClose,
  children,
  variant = 'bottom',
}: SheetProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex max-h-[88dvh] w-full max-w-[var(--overlay-max)] flex-col overflow-hidden bg-surface text-ink shadow-sheet ${
          variant === 'bottom'
            ? 'rounded-t-[var(--radius-sheet)] border border-border border-b-0'
            : 'mx-4 rounded-[var(--radius-sheet)] border border-border shadow-float'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          {variant === 'bottom' && (
            <div className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-border-strong" />
          )}
          <h2 className="pt-1 text-base font-extrabold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="tap-target inline-flex items-center justify-center rounded-full bg-surface-muted text-ink-muted hover:bg-border"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 safe-pad-bottom">
          {children}
        </div>
      </div>
    </div>
  )
}
