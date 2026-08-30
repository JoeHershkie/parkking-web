export type SheetDetent = 'peek' | 'medium' | 'expanded'

// Calculate actual pixel target height based on viewport
export function getSheetTargetHeight(
  targetDetent: SheetDetent,
  vh: number = typeof window !== 'undefined' ? window.innerHeight : 800,
): number {
  switch (targetDetent) {
    case 'peek':
      return Math.max(235, Math.min(270, Math.round(vh * 0.34)))
    case 'medium':
      return Math.max(420, Math.min(520, Math.round(vh * 0.58)))
    case 'expanded':
      return Math.max(580, Math.min(760, Math.round(vh * 0.88)))
  }
}
