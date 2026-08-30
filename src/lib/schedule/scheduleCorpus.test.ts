import { describe, expect, it } from 'vitest'
import corpus from '../../fixtures/schedule_corpus.json'
import { overlapsMembership } from './membership'
import type { Schedule, Slot } from './types'

type CorpusCase = {
  id: string
  schedule: Schedule
  slot: Slot
  expected: boolean
}

describe('Schedule corpus golden parity', () => {
  it('loads the expected number of golden cases', () => {
    expect(corpus.cases.length).toBe(23)
  })

  it.each(corpus.cases as CorpusCase[])(
    'matches golden expectation for case: $id',
    ({ schedule, slot, expected }) => {
      const actual = overlapsMembership(schedule, slot)
      expect(actual).toBe(expected)
    },
  )
})
