import { useCallback, useMemo, useRef, type MouseEvent, type RefObject } from 'react'

type PanelRef = RefObject<HTMLDivElement | null>

/**
 * Cross-panel highlighting: hovering a word highlights its sentence in both
 * panels and the corresponding word(s) in the other panel (via the word map,
 * or its reverse when hovering the translated side). DOM classList mutations
 * are tracked so they can be cleared cheaply without re-scanning the document.
 */
export function useCrossHighlight(
  wordMap: Record<string, string> | undefined,
  originalPanelRef: PanelRef,
  translatedPanelRef: PanelRef,
  fsOrigPanelRef: PanelRef,
  fsTranPanelRef: PanelRef,
  isFullscreenRef: RefObject<boolean>,
) {
  const reverseMap = useMemo(() => {
    const rm: Record<string, Set<string>> = {}
    if (!wordMap) return rm
    for (const [orig, trans] of Object.entries(wordMap)) {
      if (!rm[trans]) rm[trans] = new Set()
      rm[trans].add(orig)
    }
    return rm
  }, [wordMap])

  const highlightedEls = useRef<Array<[HTMLElement, string]>>([])
  const lastHoveredWord = useRef<HTMLElement | null>(null)

  const clearHighlights = useCallback(() => {
    const els = highlightedEls.current
    for (let i = els.length - 1; i >= 0; i--) {
      const [el, cls] = els[i]
      el.classList.remove(cls)
    }
    highlightedEls.current = []
  }, [])

  const handleMouseOut = useCallback(() => {
    lastHoveredWord.current = null
    clearHighlights()
  }, [clearHighlights])

  const addHighlight = useCallback((el: HTMLElement, cls: string) => {
    el.classList.add(cls)
    highlightedEls.current.push([el, cls])
  }, [])

  const highlightSentence = useCallback((el: HTMLElement) => {
    const sentenceEl = el.closest<HTMLElement>('.sentence-block')
    if (!sentenceEl) return
    const idx = sentenceEl.dataset.sentence
    addHighlight(sentenceEl, 'sentence-highlight')
    const panels = isFullscreenRef.current
      ? [fsOrigPanelRef.current, fsTranPanelRef.current]
      : [originalPanelRef.current, translatedPanelRef.current]
    for (const panel of panels) {
      if (!panel) continue
      const match = panel.querySelector<HTMLElement>(`.sentence-block[data-sentence="${idx}"]`)
      if (match && match !== sentenceEl) addHighlight(match, 'sentence-highlight')
    }
  }, [addHighlight, isFullscreenRef, fsOrigPanelRef, fsTranPanelRef, originalPanelRef, translatedPanelRef])

  const highlightMatchingWords = useCallback((panelRef: PanelRef, targetWord: string, sentenceIdx: string | null) => {
    if (!targetWord || !panelRef.current) return
    const root = sentenceIdx != null
      ? panelRef.current.querySelector<HTMLElement>(`.sentence-block[data-sentence="${sentenceIdx}"]`)
      : panelRef.current
    if (!root) return
    const exact = root.querySelectorAll<HTMLElement>(`[data-word="${CSS.escape(targetWord)}"]`)
    if (exact.length) {
      exact.forEach((el) => addHighlight(el, 'word-cross-highlight'))
      return
    }
    targetWord.split(/\s+/).forEach((w) => {
      if (w.length < 2) return
      root.querySelectorAll<HTMLElement>(`[data-word="${CSS.escape(w)}"]`)
        .forEach((el) => addHighlight(el, 'word-cross-highlight'))
    })
  }, [addHighlight])

  const handleOriginalHover = useCallback((e: MouseEvent) => {
    const wordEl = (e.target as HTMLElement).closest<HTMLElement>('.hoverable-word')
    if (!wordEl || wordEl === lastHoveredWord.current) return
    lastHoveredWord.current = wordEl
    clearHighlights()
    highlightSentence(wordEl)
    addHighlight(wordEl, 'word-cross-highlight')
    const word = wordEl.dataset.word
    const sentEl = wordEl.closest<HTMLElement>('.sentence-block')
    const sentIdx = sentEl?.dataset.sentence ?? null
    const translated = word ? wordMap?.[word] : undefined
    if (translated) {
      const ref = isFullscreenRef.current ? fsTranPanelRef : translatedPanelRef
      highlightMatchingWords(ref, translated, sentIdx)
    }
  }, [wordMap, clearHighlights, highlightSentence, highlightMatchingWords, addHighlight, isFullscreenRef, fsTranPanelRef, translatedPanelRef])

  const handleTranslatedHover = useCallback((e: MouseEvent) => {
    const wordEl = (e.target as HTMLElement).closest<HTMLElement>('.hoverable-word')
    if (!wordEl || wordEl === lastHoveredWord.current) return
    lastHoveredWord.current = wordEl
    clearHighlights()
    highlightSentence(wordEl)
    addHighlight(wordEl, 'word-cross-highlight')
    const word = wordEl.dataset.word
    const sentEl = wordEl.closest<HTMLElement>('.sentence-block')
    const sentIdx = sentEl?.dataset.sentence ?? null
    const originals = word ? reverseMap[word] : undefined
    if (originals) {
      const ref = isFullscreenRef.current ? fsOrigPanelRef : originalPanelRef
      originals.forEach((orig) => highlightMatchingWords(ref, orig, sentIdx))
    }
  }, [reverseMap, clearHighlights, highlightSentence, highlightMatchingWords, addHighlight, isFullscreenRef, fsOrigPanelRef, originalPanelRef])

  return { handleOriginalHover, handleTranslatedHover, handleMouseOut }
}
