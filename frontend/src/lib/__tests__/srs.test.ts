import { describe, it, expect } from 'vitest'
import {
  LEITNER_INTERVALS,
  MAX_BOX,
  boxDistribution,
  daysSince,
  getCardKey,
  isDue,
  nextBox,
  reviewCard,
  type SrsData,
} from '../srs'
import type { VocabEntry } from '../../types'

const DAY = 1000 * 60 * 60 * 24
const NOW = 1_700_000_000_000

const entry = (word: string, translated: string): VocabEntry => ({
  word,
  translated,
  targetLang: 'es',
  added: NOW,
})

describe('daysSince', () => {
  it('counts whole days elapsed', () => {
    expect(daysSince(NOW - 3 * DAY, NOW)).toBe(3)
    expect(daysSince(NOW, NOW)).toBe(0)
  })
})

describe('getCardKey', () => {
  it('combines word and translation', () => {
    expect(getCardKey(entry('hola', 'hello'))).toBe('hola::hello')
  })
})

describe('isDue', () => {
  it('treats unseen cards as due', () => {
    expect(isDue(undefined, NOW)).toBe(true)
  })

  it('keeps box 1 cards always due (interval 0)', () => {
    expect(isDue({ box: 1, lastReview: NOW }, NOW)).toBe(true)
  })

  it('respects the box interval', () => {
    // Box 3 → 4 day interval
    expect(LEITNER_INTERVALS[3]).toBe(4)
    expect(isDue({ box: 3, lastReview: NOW - 2 * DAY }, NOW)).toBe(false)
    expect(isDue({ box: 3, lastReview: NOW - 5 * DAY }, NOW)).toBe(true)
  })
})

describe('nextBox', () => {
  it('promotes on correct, capped at MAX_BOX', () => {
    expect(nextBox(1, true)).toBe(2)
    expect(nextBox(MAX_BOX, true)).toBe(MAX_BOX)
  })

  it('resets to box 1 on incorrect', () => {
    expect(nextBox(4, false)).toBe(1)
  })
})

describe('reviewCard', () => {
  it('creates a box-2 entry when a new card is answered correctly', () => {
    const next = reviewCard({}, 'a::b', true, NOW)
    expect(next['a::b']).toEqual({ box: 2, lastReview: NOW })
  })

  it('demotes an existing card to box 1 on a wrong answer', () => {
    const data: SrsData = { 'a::b': { box: 4, lastReview: NOW - DAY } }
    const next = reviewCard(data, 'a::b', false, NOW)
    expect(next['a::b']).toEqual({ box: 1, lastReview: NOW })
  })

  it('does not mutate the original map', () => {
    const data: SrsData = { 'a::b': { box: 2, lastReview: NOW } }
    reviewCard(data, 'a::b', true, NOW)
    expect(data['a::b'].box).toBe(2)
  })
})

describe('boxDistribution', () => {
  it('counts cards per box and untracked cards', () => {
    const vocab = [entry('a', '1'), entry('b', '2'), entry('c', '3')]
    const data: SrsData = {
      'a::1': { box: 2, lastReview: NOW },
      'b::2': { box: 2, lastReview: NOW },
    }
    const dist = boxDistribution(vocab, data)
    expect(dist[2]).toBe(2)
    expect(dist.unstarted).toBe(1)
    expect(dist[5]).toBe(0)
  })
})
