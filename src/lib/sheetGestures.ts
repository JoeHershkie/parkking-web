import { getSheetTargetHeight, type SheetDetent } from './sheetDetents'

export type SheetDragState = {
  height: number
  translateY: number
}

export type SheetReleaseResult =
  | { action: 'dismiss' }
  | { action: 'setDetent'; detent: SheetDetent }

/**
 * Calculates real-time visual height and translateY while dragging a multi-detent bottom sheet.
 * deltaY: positive when dragging down, negative when dragging up.
 */
export function computeSheetDragState(
  currentDetent: SheetDetent,
  deltaY: number,
  vh: number = typeof window !== 'undefined' ? window.innerHeight : 800,
  canDismiss = true,
): SheetDragState {
  const minH = getSheetTargetHeight('peek', vh)
  const maxH = getSheetTargetHeight('expanded', vh)
  const startH = getSheetTargetHeight(currentDetent, vh)
  const proposedH = startH - deltaY

  if (proposedH > maxH) {
    return {
      height: Math.round(maxH + (proposedH - maxH) * 0.25),
      translateY: 0,
    }
  }

  if (proposedH >= minH) {
    return {
      height: Math.round(proposedH),
      translateY: 0,
    }
  }

  // proposedH < minH (dragging down past peek)
  if (canDismiss) {
    return {
      height: minH,
      translateY: Math.max(0, Math.round(minH - proposedH)),
    }
  }

  return {
    height: Math.round(minH - (minH - proposedH) * 0.25),
    translateY: 0,
  }
}

/**
 * Resolves final state on release after dragging a multi-detent bottom sheet.
 * deltaY: positive when dragged down, negative when dragged up.
 * velocityDown: px/ms (positive = downward swipe, negative = upward swipe).
 */
export function resolveSheetRelease(
  currentDetent: SheetDetent,
  deltaY: number,
  velocityDown: number,
  vh: number = typeof window !== 'undefined' ? window.innerHeight : 800,
  canDismiss = true,
): SheetReleaseResult {
  const minH = getSheetTargetHeight('peek', vh)
  const medH = getSheetTargetHeight('medium', vh)
  const maxH = getSheetTargetHeight('expanded', vh)
  const startH = getSheetTargetHeight(currentDetent, vh)

  // 1. Check for swipe-down dismiss
  if (canDismiss) {
    if (currentDetent === 'peek') {
      if (velocityDown > 0.35 || deltaY > 45) {
        return { action: 'dismiss' }
      }
    } else if (currentDetent === 'medium') {
      if (velocityDown > 0.85 || deltaY > medH - minH + 45) {
        return { action: 'dismiss' }
      }
    } else if (currentDetent === 'expanded') {
      if (velocityDown > 1.1 || deltaY > maxH - minH + 60) {
        return { action: 'dismiss' }
      }
    }
  }

  // 2. Check for fast flick velocity
  if (velocityDown < -0.35) {
    // Flick up
    if (currentDetent === 'peek') return { action: 'setDetent', detent: 'medium' }
    if (currentDetent === 'medium') return { action: 'setDetent', detent: 'expanded' }
    return { action: 'setDetent', detent: 'expanded' }
  }

  if (velocityDown > 0.35) {
    // Flick down (that didn't trigger dismiss)
    if (currentDetent === 'expanded') return { action: 'setDetent', detent: 'medium' }
    if (currentDetent === 'medium') return { action: 'setDetent', detent: 'peek' }
    return { action: 'setDetent', detent: 'peek' }
  }

  // 3. Proximity snapping based on final height
  const finalHeight = startH - deltaY
  const distToPeek = Math.abs(finalHeight - minH)
  const distToMed = Math.abs(finalHeight - medH)
  const distToExp = Math.abs(finalHeight - maxH)

  if (distToPeek <= distToMed && distToPeek <= distToExp) {
    return { action: 'setDetent', detent: 'peek' }
  }
  if (distToMed <= distToExp) {
    return { action: 'setDetent', detent: 'medium' }
  }
  return { action: 'setDetent', detent: 'expanded' }
}

/**
 * Resolves modal sheet drag-to-dismiss displacement and release.
 */
export function computeModalDragTranslateY(deltaY: number): number {
  if (deltaY > 0) {
    return Math.round(deltaY)
  }
  return Math.round(deltaY * 0.2)
}

export function shouldDismissModalSheet(
  deltaY: number,
  velocityDown: number,
  distanceThreshold = 70,
  velocityThreshold = 0.35,
): boolean {
  return deltaY > distanceThreshold || velocityDown > velocityThreshold
}
