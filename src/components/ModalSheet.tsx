import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useVisualViewport } from '../hooks/useVisualViewport'

type SheetProps = {
  open: boolean
  title?: string
  hideHeader?: boolean
  fullscreen?: boolean
  onClose: () => void
  children: ReactNode
  /** bottom sheet (default) or centered modal */
  variant?: 'bottom' | 'center'
}

export function ModalSheet({
  open,
  title = '',
  hideHeader = false,
  fullscreen = false,
  onClose,
  children,
  variant = 'bottom',
}: SheetProps) {
  const viewport = useVisualViewport(open)

  // Keep the layout viewport pinned so iOS doesn't scroll the map up with the keyboard.
  useEffect(() => {
    if (!open) return

    const lockScroll = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }

    lockScroll()
    window.addEventListener('scroll', lockScroll, { passive: true })
    const vv = window.visualViewport
    vv?.addEventListener('scroll', lockScroll)

    const { style: htmlStyle } = document.documentElement
    const { style: bodyStyle } = document.body
    const prevHtmlOverflow = htmlStyle.overflow
    const prevBodyOverflow = bodyStyle.overflow
    htmlStyle.overflow = 'hidden'
    bodyStyle.overflow = 'hidden'

    return () => {
      window.removeEventListener('scroll', lockScroll)
      vv?.removeEventListener('scroll', lockScroll)
      htmlStyle.overflow = prevHtmlOverflow
      bodyStyle.overflow = prevBodyOverflow
    }
  }, [open])

  if (!open) return null

  const { keyboardOpen, layoutHeight } = viewport
  const fillToKeyboard = variant === 'bottom' && keyboardOpen

  // iOS positions `position:fixed; inset:0` against the *visual* viewport, which
  // stops short of the keyboard and leaves a map gap. Size explicitly to the
  // frozen layout height so the sheet extends under the keyboard and sits flush.
  const overlayStyle: CSSProperties = fillToKeyboard
    ? {
        top: 0,
        left: 0,
        right: 0,
        bottom: 'auto',
        height: layoutHeight,
      }
    : {}

  const sheetStyle: CSSProperties = fillToKeyboard
    ? { maxHeight: 'none' }
    : variant === 'bottom'
      ? {
          height: fullscreen ? 'calc(100dvh - 3.25rem)' : undefined,
          maxHeight: fullscreen ? 'calc(100dvh - 3.25rem)' : Math.max(160, layoutHeight * 0.88),
        }
      : {
          maxHeight: Math.max(160, viewport.height * 0.88),
          ...(keyboardOpen
            ? {
                transform: `translateY(-${Math.min(
                  Math.max(
                    viewport.keyboardInset,
                    layoutHeight - viewport.height,
                  ),
                  viewport.height * 0.25,
                )}px)`,
              }
            : {}),
        }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={overlayStyle}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        style={sheetStyle}
        className={`z-10 flex w-full max-w-[var(--overlay-max)] flex-col overflow-hidden bg-surface text-ink shadow-sheet ${
          fillToKeyboard
            ? 'absolute inset-0 max-w-none rounded-none border-0'
            : variant === 'bottom'
              ? 'relative rounded-t-[var(--radius-sheet)] border border-border border-b-0'
              : 'relative mx-4 rounded-[var(--radius-sheet)] border border-border shadow-float'
        }`}
      >
        {!hideHeader ? (
          <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 safe-pad-top">
            {variant === 'bottom' && !fillToKeyboard && (
              <div className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-slate-300" />
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
        ) : (
          <div className="flex shrink-0 justify-center pt-2.5 pb-1">
            <div className="h-1 w-9 rounded-full bg-slate-300" />
          </div>
        )}
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 ${
            hideHeader ? 'pt-1 pb-3' : 'py-3'
          } ${fillToKeyboard ? 'pb-3' : 'safe-pad-bottom'}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
