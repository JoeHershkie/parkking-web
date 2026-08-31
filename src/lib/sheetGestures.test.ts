import { describe, expect, it } from 'vitest'
import {
  computeModalDragTranslateY,
  computeSheetDragState,
  resolveSheetRelease,
  shouldDismissModalSheet,
} from './sheetGestures'

describe('sheetGestures', () => {
  const vh = 800
  // In vh=800: peek = 270, medium = 464, expanded = 704

  describe('computeSheetDragState', () => {
    it('handles upward dragging from peek toward medium', () => {
      // deltaY = -100 (dragged up 100px)
      const state = computeSheetDragState('peek', -100, vh, true)
      expect(state.height).toBe(370)
      expect(state.translateY).toBe(0)
    })

    it('rubber-bands above expanded height', () => {
      // deltaY = -100 from expanded (704 + 100 = 804, over by 100)
      const state = computeSheetDragState('expanded', -100, vh, true)
      expect(state.height).toBe(704 + 25) // 729
      expect(state.translateY).toBe(0)
    })

    it('translates downward when dragged below peek with canDismiss = true', () => {
      // deltaY = +50 from peek (270 - 50 = 220 < 270)
      const state = computeSheetDragState('peek', 50, vh, true)
      expect(state.height).toBe(270)
      expect(state.translateY).toBe(50)
    })

    it('rubber-bands downward when dragged below peek with canDismiss = false', () => {
      // deltaY = +100 from peek
      const state = computeSheetDragState('peek', 100, vh, false)
      expect(state.height).toBe(270 - 25) // 245
      expect(state.translateY).toBe(0)
    })
  })

  describe('resolveSheetRelease', () => {
    it('dismisses from peek when dragged down > 45px', () => {
      const result = resolveSheetRelease('peek', 50, 0, vh, true)
      expect(result).toEqual({ action: 'dismiss' })
    })

    it('dismisses from peek on fast downward flick', () => {
      const result = resolveSheetRelease('peek', 20, 0.4, vh, true)
      expect(result).toEqual({ action: 'dismiss' })
    })

    it('does not dismiss from peek when canDismiss is false and deltaY > 45', () => {
      const result = resolveSheetRelease('peek', 50, 0, vh, false)
      expect(result).toEqual({ action: 'setDetent', detent: 'peek' })
    })

    it('flicks up from peek to medium', () => {
      const result = resolveSheetRelease('peek', -20, -0.4, vh, true)
      expect(result).toEqual({ action: 'setDetent', detent: 'medium' })
    })

    it('flicks up from medium to expanded', () => {
      const result = resolveSheetRelease('medium', -20, -0.4, vh, true)
      expect(result).toEqual({ action: 'setDetent', detent: 'expanded' })
    })

    it('flicks down from medium to peek when not full dismiss', () => {
      const result = resolveSheetRelease('medium', 40, 0.4, vh, true)
      expect(result).toEqual({ action: 'setDetent', detent: 'peek' })
    })

    it('dismisses from medium on high downward velocity or deep drag', () => {
      const result = resolveSheetRelease('medium', 250, 0.9, vh, true)
      expect(result).toEqual({ action: 'dismiss' })
    })

    it('snaps to closest detent based on final proximity', () => {
      // peek is 270, medium is 464. Dragged from peek to height 400 (deltaY = -130)
      const result = resolveSheetRelease('peek', -130, 0.05, vh, true)
      expect(result).toEqual({ action: 'setDetent', detent: 'medium' })
    })
  })

  describe('modal sheet gestures', () => {
    it('computes modal drag displacement correctly', () => {
      expect(computeModalDragTranslateY(50)).toBe(50)
      expect(computeModalDragTranslateY(-50)).toBe(-10)
    })

    it('decides dismissal based on distance or velocity', () => {
      expect(shouldDismissModalSheet(80, 0)).toBe(true)
      expect(shouldDismissModalSheet(30, 0.4)).toBe(true)
      expect(shouldDismissModalSheet(40, 0.1)).toBe(false)
    })
  })
})
