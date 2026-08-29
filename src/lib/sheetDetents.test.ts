import { describe, expect, it } from 'vitest'
import { getSheetTargetHeight } from './sheetDetents'

describe('sheetDetents', () => {
  it('calculates peek height within bounds', () => {
    expect(getSheetTargetHeight('peek', 800)).toBe(270)
    expect(getSheetTargetHeight('peek', 600)).toBe(235)
    expect(getSheetTargetHeight('peek', 1200)).toBe(270)
  })

  it('calculates medium height within bounds', () => {
    expect(getSheetTargetHeight('medium', 800)).toBe(464)
    expect(getSheetTargetHeight('medium', 600)).toBe(420)
    expect(getSheetTargetHeight('medium', 1200)).toBe(520)
  })

  it('calculates expanded height within bounds', () => {
    expect(getSheetTargetHeight('expanded', 800)).toBe(704)
    expect(getSheetTargetHeight('expanded', 600)).toBe(580)
    expect(getSheetTargetHeight('expanded', 1200)).toBe(760)
  })
})
