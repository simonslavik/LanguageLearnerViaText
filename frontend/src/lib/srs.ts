// ─── Leitner spaced-repetition logic ────────────────────────────────────────
// Box 1 → review daily (always due)
// Box 2 → every 2 days, Box 3 → 4 days, Box 4 → 8 days, Box 5 → 16 days (mastered)

import type { VocabEntry } from '../types'

export const LEITNER_INTERVALS = [0, 0, 2, 4, 8, 16] // index = box number
export const MAX_BOX = 5

export interface SrsEntry {
  box: number
  lastReview: number
}

export type SrsData = Record<string, SrsEntry>

export function daysSince(timestamp: number, now: number = Date.now()): number {
  return Math.floor((now - timestamp) / (1000 * 60 * 60 * 24))
}

export function getCardKey(entry: Pick<VocabEntry, 'word' | 'translated'>): string {
  return `${entry.word}::${entry.translated}`
}

/** A card is due when enough days have passed for its box interval (new cards are always due). */
export function isDue(srsEntry: SrsEntry | undefined, now: number = Date.now()): boolean {
  if (!srsEntry) return true
  const interval = LEITNER_INTERVALS[srsEntry.box] || 0
  return daysSince(srsEntry.lastReview, now) >= interval
}

/** Correct → promote one box (capped at MAX_BOX); wrong → reset to box 1. */
export function nextBox(currentBox: number, isCorrect: boolean): number {
  return isCorrect ? Math.min(currentBox + 1, MAX_BOX) : 1
}

/** Apply a review result to the SRS map, returning a new map. */
export function reviewCard(data: SrsData, key: string, isCorrect: boolean, now: number = Date.now()): SrsData {
  const current = data[key] || { box: 1, lastReview: now }
  return { ...data, [key]: { box: nextBox(current.box, isCorrect), lastReview: now } }
}

/** Count cards per box (1–5) plus untracked cards. */
export function boxDistribution(vocab: VocabEntry[], data: SrsData): Record<number | 'unstarted', number> {
  const counts: Record<number | 'unstarted', number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unstarted: 0 }
  vocab.forEach((entry) => {
    const srs = data[getCardKey(entry)]
    if (!srs) counts.unstarted++
    else counts[srs.box] = (counts[srs.box] || 0) + 1
  })
  return counts
}
