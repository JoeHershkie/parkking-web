import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { getSheetTargetHeight, type SheetDetent } from '../lib/sheetDetents'

export type { SheetDetent }

type BottomSheetProps = {
  open: boolean
  detent: SheetDetent
  onDetentChange: (detent: SheetDetent) => void
  onClose?: () => void
  children: ReactNode
}

export function BottomSheet({
  open,
  detent,
  onDetentChange,
  children,
}: BottomSheetProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  const getTargetHeight = useCallback(
    (targetDetent: SheetDetent): number => {
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800
      return getSheetTargetHeight(targetDetent, vh)
    },
    [],
  )

  const currentTargetHeight = getTargetHeight(detent)

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    setIsDragging(true)
    setDragOffset(0)
  }

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const deltaY = touchStartY.current - e.touches[0].clientY
    let adjusted = deltaY
    const maxH = getTargetHeight('expanded')
    const minH = getTargetHeight('peek')
    const proposed = currentTargetHeight + deltaY

    if (proposed > maxH) {
      adjusted = maxH - currentTargetHeight + (proposed - maxH) * 0.25
    } else if (proposed < minH) {
      adjusted = minH - currentTargetHeight + (proposed - minH) * 0.25
    }

    setDragOffset(adjusted)
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    setIsDragging(false)

    const finalHeight = currentTargetHeight + dragOffset
    const dt = Math.max(1, Date.now() - touchStartTime.current)
    const velocity = dragOffset / dt // px/ms (positive = upwards swipe)

    setDragOffset(0)

    const peekH = getTargetHeight('peek')
    const medH = getTargetHeight('medium')
    const expH = getTargetHeight('expanded')

    // Fast flick handling
    if (velocity > 0.45) {
      if (detent === 'peek') onDetentChange('medium')
      else if (detent === 'medium') onDetentChange('expanded')
      return
    } else if (velocity < -0.45) {
      if (detent === 'expanded') onDetentChange('medium')
      else if (detent === 'medium') onDetentChange('peek')
      return
    }

    // Proximity snapping
    const distToPeek = Math.abs(finalHeight - peekH)
    const distToMed = Math.abs(finalHeight - medH)
    const distToExp = Math.abs(finalHeight - expH)

    if (distToPeek <= distToMed && distToPeek <= distToExp) {
      onDetentChange('peek')
    } else if (distToMed <= distToExp) {
      onDetentChange('medium')
    } else {
      onDetentChange('expanded')
    }
  }

  if (!open) return null

  const activeHeight = Math.max(200, currentTargetHeight + (isDragging ? dragOffset : 0))

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
      <div
        ref={sheetRef}
        style={{ height: `${activeHeight}px` }}
        className={`pointer-events-auto flex w-full max-w-[var(--overlay-max)] flex-col overflow-hidden rounded-t-[var(--radius-sheet)] ios-glass-sheet shadow-sheet ${
          isDragging ? '' : 'transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
        }`}
      >
        {/* Grab handle drag bar */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="flex shrink-0 cursor-grab touch-none flex-col items-center justify-center pt-2.5 pb-1 active:cursor-grabbing"
          aria-label="Drag sheet"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={detent === 'peek' ? 0 : detent === 'medium' ? 1 : 2}
        >
          <div className="h-1.25 w-9 rounded-full bg-slate-300/80" />
        </div>

        {/* Content viewport */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 safe-pad-x safe-pad-bottom pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}
