import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import { useVisualViewport } from '../hooks/useVisualViewport'
import {
  computeModalDragTranslateY,
  shouldDismissModalSheet,
} from '../lib/sheetGestures'

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
  const [prevOpen, setPrevOpen] = useState(open)
  const [shouldRender, setShouldRender] = useState(open)
  const [isEntering, setIsEntering] = useState(open)
  const [isExiting, setIsExiting] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const pointerStartY = useRef(0)
  const pointerStartTime = useRef(0)
  const isPointerDownRef = useRef(false)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setShouldRender(true)
      setIsExiting(false)
      setIsEntering(true)
    } else {
      setIsExiting(true)
      setIsDragging(false)
    }
  }

  useEffect(() => {
    if (!isEntering) return
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        setIsEntering(false)
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [isEntering])

  useEffect(() => {
    if (!isExiting) return
    const timer = window.setTimeout(() => {
      setShouldRender(false)
      setIsExiting(false)
    }, 320)
    return () => clearTimeout(timer)
  }, [isExiting])

  // Keep the layout viewport pinned so iOS doesn't scroll the map up with the keyboard.
  useEffect(() => {
    if (!shouldRender) return

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
  }, [shouldRender])

  if (!shouldRender) return null

  const { keyboardOpen, layoutHeight } = viewport
  const fillToKeyboard = variant === 'bottom' && keyboardOpen
  const isTransitioning = isEntering || isExiting

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    isPointerDownRef.current = true
    pointerStartY.current = e.clientY
    pointerStartTime.current = Date.now()
    setIsDragging(true)
    setDragY(0)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    const deltaY = e.clientY - pointerStartY.current
    setDragY(computeModalDragTranslateY(deltaY))
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setIsDragging(false)

    const deltaY = e.clientY - pointerStartY.current
    const dt = Math.max(1, Date.now() - pointerStartTime.current)
    const velocityDown = deltaY / dt

    if (shouldDismissModalSheet(deltaY, velocityDown)) {
      onClose()
    } else {
      setDragY(0)
    }
  }

  const handlePointerCancel = () => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false
    setIsDragging(false)
    setDragY(0)
  }

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

  const bottomTransform = isTransitioning
    ? 'translateY(calc(100% + 24px))'
    : dragY !== 0
      ? `translateY(${Math.max(0, dragY)}px)`
      : 'translateY(0)'

  const centerTransform = isTransitioning
    ? 'scale(0.95) translateY(16px)'
    : keyboardOpen
      ? `translateY(-${Math.min(
          Math.max(
            viewport.keyboardInset,
            layoutHeight - viewport.height,
          ),
          viewport.height * 0.25,
        )}px)`
      : 'scale(1) translateY(0)'

  const sheetStyle: CSSProperties = fillToKeyboard
    ? { maxHeight: 'none' }
    : variant === 'bottom'
      ? {
          height: fullscreen ? 'calc(100dvh - 3.25rem)' : undefined,
          maxHeight: fullscreen ? 'calc(100dvh - 3.25rem)' : Math.max(160, layoutHeight * 0.88),
          transform: bottomTransform,
        }
      : {
          maxHeight: Math.max(160, viewport.height * 0.88),
          transform: centerTransform,
        }

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center ${
        fillToKeyboard || (variant === 'bottom' && fullscreen)
          ? 'items-end'
          : variant === 'bottom'
            ? 'items-end safe-pad-x sm:items-center sm:p-0'
            : 'items-end sm:items-center'
      }`}
      style={overlayStyle}
    >
      <button
        type="button"
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        style={sheetStyle}
        className={`z-10 flex w-full max-w-[var(--overlay-max)] flex-col overflow-hidden text-ink shadow-sheet ${
          isDragging
            ? ''
            : 'transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
        } ${
          isTransitioning && variant === 'center' ? 'opacity-0' : 'opacity-100'
        } ${
          fillToKeyboard
            ? 'absolute inset-0 max-w-none rounded-none border-0 bg-surface'
            : variant === 'bottom'
              ? fullscreen
                ? 'relative rounded-t-[var(--radius-sheet)] rounded-b-none border border-border border-b-0 bg-surface'
                : 'relative rounded-t-[var(--radius-sheet)] rounded-b-none border border-white/70 border-b-0 ios-glass-sheet-translucent'
              : 'relative mx-4 rounded-[var(--radius-sheet)] border border-border shadow-float bg-surface'
        }`}
      >
        {!hideHeader ? (
          <div
            onPointerDown={variant === 'bottom' && !fillToKeyboard ? handlePointerDown : undefined}
            onPointerMove={variant === 'bottom' && !fillToKeyboard ? handlePointerMove : undefined}
            onPointerUp={variant === 'bottom' && !fillToKeyboard ? handlePointerUp : undefined}
            onPointerCancel={variant === 'bottom' && !fillToKeyboard ? handlePointerCancel : undefined}
            className={`relative flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 safe-pad-top ${
              variant === 'bottom' && !fillToKeyboard
                ? 'cursor-grab touch-none select-none active:cursor-grabbing'
                : ''
            }`}
          >
            {variant === 'bottom' && !fillToKeyboard && (
              <div className="pointer-events-none absolute left-1/2 top-2 h-1.25 w-[54px] -translate-x-1/2 rounded-full bg-slate-300" />
            )}
            <h2 className="pointer-events-none pt-1 text-base font-extrabold text-ink">{title}</h2>
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
          <div
            onPointerDown={variant === 'bottom' && !fillToKeyboard ? handlePointerDown : undefined}
            onPointerMove={variant === 'bottom' && !fillToKeyboard ? handlePointerMove : undefined}
            onPointerUp={variant === 'bottom' && !fillToKeyboard ? handlePointerUp : undefined}
            onPointerCancel={variant === 'bottom' && !fillToKeyboard ? handlePointerCancel : undefined}
            className="relative flex shrink-0 cursor-grab touch-none select-none flex-col items-center justify-center pt-1.5 pb-1.5 active:cursor-grabbing after:absolute after:inset-x-0 after:-top-2 after:-bottom-3 after:content-['']"
            aria-label="Drag sheet to dismiss"
          >
            <div className="pointer-events-none h-1 w-[54px] rounded-full bg-slate-300" />
          </div>
        )}
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 ${
            hideHeader ? 'pt-0 pb-3' : 'py-3'
          } ${fillToKeyboard ? 'pb-3' : 'safe-pad-bottom'}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

