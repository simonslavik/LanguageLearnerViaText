import { useState, useEffect, useCallback } from 'react'
import type { VocabEntry } from '../types'

const VOCAB_KEY = 'translator_vocabulary'

function loadVocab(): VocabEntry[] {
  try {
    return (JSON.parse(localStorage.getItem(VOCAB_KEY) || 'null') as VocabEntry[]) || []
  } catch {
    return []
  }
}

/** Vocabulary notebook state, persisted to localStorage. */
export function useVocabulary(targetLang: string) {
  const [vocab, setVocab] = useState<VocabEntry[]>(loadVocab)

  useEffect(() => {
    localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab))
  }, [vocab])

  const addToVocab = useCallback((word: string, translated: string) => {
    setVocab((prev) => {
      if (prev.some((v) => v.word === word && v.translated === translated)) return prev
      return [...prev, { word, translated, targetLang, added: Date.now() }]
    })
  }, [targetLang])

  const removeFromVocab = useCallback((index: number) => {
    setVocab((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearVocab = useCallback(() => setVocab([]), [])

  return { vocab, addToVocab, removeFromVocab, clearVocab }
}
