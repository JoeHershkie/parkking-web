import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  computeSheetDragState,
  resolveSheetRelease,
} from '../lib/sheetGestures'
import { getSheetTargetHeight, type SheetDetent } from '../lib/sheetDetents'

export type { SheetDetent }

type BottomSheetProps = {
  open: boolean
  detent: SheetDetent
  onDetentChange: (detent: SheetDetent) => void
  onClose?: () => void
  onVisualHeightChange?: (height: number, isDragging: boolean) => void
  children: ReactNode
}

export function BottomSheet({
  open,
  detent,
  onDetentChange,
  onClose,
  onVisualHeightChange,
  children,
}: BottomSheetProps) {
  const [prevOpen, setPrevOpen] = useState(open)
  const [shouldRender, setShouldRender] = useState(open)
  const [isEntering, setIsEntering] = useState(open)
  const [isExiting, setIsExiting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const pointerStartY = useRef(0)
  const pointerStartTime = useRef(0)
  const isPointerDownRef = useRef(false)
  const sheetRef = useRef<HTMLDivElement>(null)

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

  const getTargetHeight = useCallback(
    (targetDetent: SheetDetent): number => {
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800
      return getSheetTargetHeight(targetDetent, vh)
    },
    [],
  )

  const currentTargetHeight = getTargetHeight(detent)
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  useEffect(() => {
    if (!open || !shouldRender || isExiting) {
      onVisualHeightChange?.(0, false)
    } else if (!isDragging) {
      onVisualHeightChange?.(currentTargetHeight, false)
    }
  }, [open, shouldRender, isExiting, isDragging, currentTargetHeight, onVisualHeightChange])

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
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
    onVisualHeightChange?.(currentTargetHeight, true)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    const deltaY = e.clientY - pointerStartY.current
    setDragY(deltaY)
    const nextDragState = computeSheetDragState(detent, deltaY, vh, Boolean(onClose))
    const visualH = Math.max(0, nextDragState.height - nextDragState.translateY)
    onVisualHeightChange?.(visualH, true)
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

    setDragY(0)

    const result = resolveSheetRelease(
      detent,
      deltaY,
      velocityDown,
      vh,
      Boolean(onClose),
    )

    if (result.action === 'dismiss') {
      onVisualHeightChange?.(0, false)
      onClose?.()
    } else {
      const nextH = getSheetTargetHeight(result.detent, vh)
      onVisualHeightChange?.(nextH, false)
      onDetentChange(result.detent)
    }
  }

  const handlePointerCancel = () => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false
    setIsDragging(false)
    setDragY(0)
    onVisualHeightChange?.(currentTargetHeight, false)
  }

  if (!shouldRender) return null

  const dragState = isDragging
    ? computeSheetDragState(detent, dragY, vh, Boolean(onClose))
    : { height: currentTargetHeight, translateY: 0 }

  const isFullHeight = detent === 'expanded'

  let currentTransform = 'translateY(0)'
  if (isEntering || isExiting) {
    currentTransform = 'translateY(calc(100% + 24px))'
  } else if (dragState.translateY > 0) {
    currentTransform = `translateY(${dragState.translateY}px)`
  }

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        isFullHeight ? 'p-0' : 'safe-pad-x'
      }`}
    >
      <div
        ref={sheetRef}
        style={{
          height: `${dragState.height}px`,
          transform: currentTransform,
        }}
        className={`pointer-events-auto flex w-full max-w-[var(--overlay-max)] flex-col overflow-hidden rounded-t-[var(--radius-sheet)] rounded-b-none border-b-0 shadow-sheet ${
          isFullHeight ? 'ios-glass-sheet' : 'ios-glass-sheet-translucent'
        } ${
          isDragging
            ? ''
            : 'transition-[height,transform,background,backdrop-filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
        }`}
      >
        {/* Grab handle drag bar */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="relative flex shrink-0 cursor-grab touch-none select-none flex-col items-center justify-center pt-2.5 pb-2 active:cursor-grabbing after:absolute after:inset-x-0 after:-top-2 after:-bottom-4 after:content-['']"
          aria-label="Drag sheet to resize or dismiss"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={detent === 'peek' ? 0 : detent === 'medium' ? 1 : 2}
        >
          <div className="pointer-events-none h-1.25 w-[54px] rounded-full bg-slate-300/80" />
        </div>

        {/* Content viewport */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 safe-pad-bottom pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}


