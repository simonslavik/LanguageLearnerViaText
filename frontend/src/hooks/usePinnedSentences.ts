import { useState, useEffect, useCallback } from 'react'

const PINS_KEY = 'translator_pinned_sentences'

function loadPins(): Set<number> {
  try {
    return new Set((JSON.parse(sessionStorage.getItem(PINS_KEY) || 'null') as number[]) || [])
  } catch {
    return new Set()
  }
}

/** Pinned-sentence indices, persisted to sessionStorage. */
export function usePinnedSentences() {
  const [pinnedSentences, setPinnedSentences] = useState<Set<number>>(loadPins)

  useEffect(() => {
    sessionStorage.setItem(PINS_KEY, JSON.stringify([...pinnedSentences]))
  }, [pinnedSentences])

  const togglePin = useCallback((idx: number) => {
    setPinnedSentences((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  return { pinnedSentences, togglePin }
}
