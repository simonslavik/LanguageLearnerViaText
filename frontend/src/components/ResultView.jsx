import { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react'
import { translateWord } from '../api'
import VocabularyNotebook from './VocabularyNotebook'
import FlashcardQuiz from './FlashcardQuiz'

const SENTENCES_PER_PAGE = 6

// ─── localStorage helpers ───────────────────────────────────────────────
const VOCAB_KEY = 'translator_vocabulary'

function loadVocab() {
  try {
    return JSON.parse(localStorage.getItem(VOCAB_KEY)) || []
  } catch {
    return []
  }
}

function saveVocab(vocab) {
  localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab))
}

// ─── Small helpers ──────────────────────────────────────────────────────
function CopyButton({ targetId }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const el = document.getElementById(targetId)
    if (!el) return
    navigator.clipboard.writeText(el.innerText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      className="btn-copy"
      onClick={handleCopy}
      title="Copy to clipboard"
      style={copied ? { color: 'var(--success)', borderColor: 'var(--success)' } : {}}
    >
      <i className={copied ? 'fas fa-check' : 'fas fa-copy'}></i>
    </button>
  )
}

/** Render text as word-level <span> elements with data-word attrs. */
const WordRenderer = memo(function WordRenderer({ text }) {
  const tokens = text.split(/([^\s]+)/)
  return tokens.map((token, i) => {
    if (!token || /^\s+$/.test(token)) return token
    const normalized = token
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .replace(/[^\p{L}\p{N}]+$/u, '')
      .toLowerCase()
    if (!normalized || normalized.length < 2) return <span key={i}>{token}</span>
    return (
      <span key={i} className="hoverable-word" data-word={normalized}>
        {token}
      </span>
    )
  })
})

/** Render sentence_pairs as sentence blocks with data-sentence index. */
const SentenceBlockRenderer = memo(function SentenceBlockRenderer({ pairs, pinnedSet }) {
  return pairs.map((pair, idx) => {
    const isPinned = pinnedSet.has(idx)
    return (
      <span
        key={idx}
        className={`sentence-block${isPinned ? ' pinned' : ''}`}
        data-sentence={idx}
        id={`sentence-${idx}`}
      >
        <WordRenderer text={pair} />
      </span>
    )
  })
})

/** Render one book page — a slice of sentences for one panel side. */
const BookPageRenderer = memo(function BookPageRenderer({ sentences, globalOffset, pinnedSet }) {
  return sentences.map((text, i) => {
    const idx = globalOffset + i
    return (
      <span
        key={idx}
        className={`sentence-block${pinnedSet.has(idx) ? ' pinned' : ''}`}
        data-sentence={idx}
      >
        <WordRenderer text={text} />
      </span>
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ResultView
// ═══════════════════════════════════════════════════════════════════════════

function ResultView({ result, onBack }) {
  const {
    target_lang,
    target_lang_code,
    source_lang_code,
    original_text,
    translated_text,
    word_map,
    word_freq_tiers,
    translated_word_freq_tiers,
    original_cefr,
    translated_cefr,
    sentence_pairs,
  } = result

  // ── Extract sentence text arrays from pairs ──
  const originalSentences = useMemo(
    () => (sentence_pairs || []).map((p) => p.original || ''),
    [sentence_pairs],
  )
  const translatedSentences = useMemo(
    () => (sentence_pairs || []).map((p) => p.translated || ''),
    [sentence_pairs],
  )
  const hasSentences = originalSentences.length > 0

  // ── Find context sentences for a word ──
  const findContextSentences = useCallback((word, isTranslatedPanel) => {
    if (!sentence_pairs || !word) return []
    const needle = word.toLowerCase()
    const matches = []
    for (let i = 0; i < sentence_pairs.length && matches.length < 3; i++) {
      const src = isTranslatedPanel
        ? (sentence_pairs[i].translated || '')
        : (sentence_pairs[i].original || '')
      // Match as a whole word (surrounded by non-letter chars or boundaries)
      const re = new RegExp(`(?<![\\p{L}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu')
      if (re.test(src)) {
        matches.push({
          original: sentence_pairs[i].original || '',
          translated: sentence_pairs[i].translated || '',
          index: i,
        })
      }
    }
    return matches
  }, [sentence_pairs])

  // ── Word Frequency Tiers (from backend, based on real language frequency data) ──
  const wordFreqTiers = useMemo(() => word_freq_tiers || {}, [word_freq_tiers])
  const translatedFreqTiers = useMemo(() => translated_word_freq_tiers || {}, [translated_word_freq_tiers])

  // ── Pinned Sentences ──
  const PINS_KEY = 'translator_pinned_sentences'
  const [pinnedSentences, setPinnedSentences] = useState(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(PINS_KEY)) || [])
    } catch { return new Set() }
  })
  const [pinsOpen, setPinsOpen] = useState(false)
  const [pinMode, setPinMode] = useState(false)
  const [freqHighlight, setFreqHighlight] = useState(false)

  useEffect(() => {
    sessionStorage.setItem(PINS_KEY, JSON.stringify([...pinnedSentences]))
  }, [pinnedSentences])

  const togglePin = useCallback((idx) => {
    setPinnedSentences((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const scrollToSentence = useCallback((idx) => {
    const roots = isFullscreenRef.current
      ? [fsOrigPanelRef.current, fsTranPanelRef.current]
      : [originalPanelRef.current, translatedPanelRef.current]
    for (const root of roots) {
      if (!root) continue
      const el = root.querySelector(`.sentence-block[data-sentence="${idx}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('sentence-flash')
        setTimeout(() => el.classList.remove('sentence-flash'), 1500)
      }
    }
  }, [])

  // ── Right-click OR inline pin button to pin a sentence ──
  const handleContextMenu = useCallback((e) => {
    const sentEl = e.target.closest('.sentence-block')
    if (!sentEl) return
    e.preventDefault()
    const idx = parseInt(sentEl.dataset.sentence, 10)
    if (!isNaN(idx)) togglePin(idx)
  }, [togglePin])

  // ── Vocabulary Notebook ──
  const [vocab, setVocab] = useState(loadVocab)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)

  useEffect(() => { saveVocab(vocab) }, [vocab])

  const addToVocab = useCallback((word, translated) => {
    setVocab((prev) => {
      const exists = prev.some((v) => v.word === word && v.translated === translated)
      if (exists) return prev
      return [...prev, { word, translated, targetLang: target_lang, added: Date.now() }]
    })
  }, [target_lang])

  const removeFromVocab = useCallback((index) => {
    setVocab((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearVocab = useCallback(() => setVocab([]), [])

  // ── Refs & tooltip ──
  const originalPanelRef = useRef(null)
  const translatedPanelRef = useRef(null)
  const fsOrigPanelRef = useRef(null)
  const fsTranPanelRef = useRef(null)
  const isFullscreenRef = useRef(false)
  const isFsSyncing = useRef(false)
  const [tooltip, setTooltip] = useState(null)
  const [tooltipLoading, setTooltipLoading] = useState(false)

  // ── Fullscreen mode ──
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => { isFullscreenRef.current = fullscreen }, [fullscreen])

  // ── Book mode ──
  const [bookMode, setBookMode] = useState(false)
  const [bookPage, setBookPage] = useState(0)
  const [bookFlipDir, setBookFlipDir] = useState(null) // 'forward' | 'backward'

  const bookSentences = useMemo(() =>
    hasSentences ? originalSentences : original_text.split(/\n{2,}/),
  [hasSentences, originalSentences, original_text])
  const totalBookPages = Math.max(1, Math.ceil(bookSentences.length / SENTENCES_PER_PAGE))

  const goBookPage = useCallback((dir) => {
    setBookFlipDir(dir)
    setBookPage((p) => dir === 'forward'
      ? Math.min(p + 1, totalBookPages - 1)
      : Math.max(p - 1, 0)
    )
    setTimeout(() => setBookFlipDir(null), 400)
  }, [totalBookPages])

  useEffect(() => {
    if (!fullscreen || !bookMode) return
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goBookPage('forward')
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goBookPage('backward')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fullscreen, bookMode, goBookPage])

  useEffect(() => { if (bookMode) setBookPage(0) }, [bookMode])

  // ── Synchronized scrolling (sentence-aligned) ──
  const [syncScroll, setSyncScroll] = useState(true)
  const isSyncing = useRef(false)

  useEffect(() => {
    if (!syncScroll) return
    const origEl = originalPanelRef.current
    const transEl = translatedPanelRef.current
    if (!origEl || !transEl) return

    const syncFrom = (source, target) => () => {
      if (isSyncing.current) return
      isSyncing.current = true

      // Find the topmost visible sentence in the source panel
      const sentences = source.querySelectorAll('.sentence-block[data-sentence]')
      const sourceTop = source.getBoundingClientRect().top
      let topIdx = 0
      let topOffset = 0

      for (const s of sentences) {
        const rect = s.getBoundingClientRect()
        // First sentence whose bottom is below the panel top
        if (rect.bottom > sourceTop) {
          topIdx = parseInt(s.dataset.sentence, 10)
          // How far this sentence is scrolled past the top (0 = just at top, 1 = fully scrolled past)
          const sentHeight = rect.height || 1
          topOffset = Math.max(0, (sourceTop - rect.top) / sentHeight)
          break
        }
      }

      // Find the matching sentence in the target panel
      const match = target.querySelector(`.sentence-block[data-sentence="${topIdx}"]`)
      if (match) {
        const targetPanelTop = target.getBoundingClientRect().top
        const matchRect = match.getBoundingClientRect()
        const currentOffset = matchRect.top - targetPanelTop + target.scrollTop
        target.scrollTop = currentOffset - target.clientTop + (topOffset * matchRect.height)
      }

      requestAnimationFrame(() => { isSyncing.current = false })
    }

    const onOrigScroll = syncFrom(origEl, transEl)
    const onTransScroll = syncFrom(transEl, origEl)

    origEl.addEventListener('scroll', onOrigScroll, { passive: true })
    transEl.addEventListener('scroll', onTransScroll, { passive: true })

    return () => {
      origEl.removeEventListener('scroll', onOrigScroll)
      transEl.removeEventListener('scroll', onTransScroll)
    }
  }, [syncScroll])

  // ── Fullscreen sync scroll ──
  useEffect(() => {
    if (!fullscreen || !syncScroll) return
    const origEl = fsOrigPanelRef.current
    const transEl = fsTranPanelRef.current
    if (!origEl || !transEl) return

    const syncFrom = (source, target) => () => {
      if (isFsSyncing.current) return
      isFsSyncing.current = true
      const sentences = source.querySelectorAll('.sentence-block[data-sentence]')
      const sourceTop = source.getBoundingClientRect().top
      let topIdx = 0
      let topOffset = 0
      for (const s of sentences) {
        const rect = s.getBoundingClientRect()
        if (rect.bottom > sourceTop) {
          topIdx = parseInt(s.dataset.sentence, 10)
          const sentHeight = rect.height || 1
          topOffset = Math.max(0, (sourceTop - rect.top) / sentHeight)
          break
        }
      }
      const match = target.querySelector(`.sentence-block[data-sentence="${topIdx}"]`)
      if (match) {
        const targetPanelTop = target.getBoundingClientRect().top
        const matchRect = match.getBoundingClientRect()
        const currentOffset = matchRect.top - targetPanelTop + target.scrollTop
        target.scrollTop = currentOffset - target.clientTop + (topOffset * matchRect.height)
      }
      requestAnimationFrame(() => { isFsSyncing.current = false })
    }

    const onOrigScroll = syncFrom(origEl, transEl)
    const onTransScroll = syncFrom(transEl, origEl)
    origEl.addEventListener('scroll', onOrigScroll, { passive: true })
    transEl.addEventListener('scroll', onTransScroll, { passive: true })
    return () => {
      origEl.removeEventListener('scroll', onOrigScroll)
      transEl.removeEventListener('scroll', onTransScroll)
    }
  }, [fullscreen, syncScroll])

  // ── Frequency highlighting (DOM-based to avoid re-rendering all spans) ──
  useEffect(() => {
    const freqClasses = ['freq-very-common', 'freq-common', 'freq-uncommon', 'freq-rare']
    const origWords = document.querySelectorAll('.original-panel .hoverable-word[data-word]')
    const transWords = document.querySelectorAll('.translated-panel .hoverable-word[data-word]')
    if (!freqHighlight) {
      origWords.forEach((el) => el.classList.remove(...freqClasses))
      transWords.forEach((el) => el.classList.remove(...freqClasses))
      return
    }
    origWords.forEach((el) => {
      const w = el.dataset.word
      el.classList.remove(...freqClasses)
      const tier = wordFreqTiers[w]
      if (tier) el.classList.add(tier)
    })
    transWords.forEach((el) => {
      const w = el.dataset.word
      el.classList.remove(...freqClasses)
      const tier = translatedFreqTiers[w]
      if (tier) el.classList.add(tier)
    })
  }, [freqHighlight, wordFreqTiers, translatedFreqTiers])

  // ── Click a word → translate tooltip + save button ──
  const handleWordClick = useCallback(async (e) => {
    const wordEl = e.target.closest('.hoverable-word')
    if (!wordEl) return

    const normalized = wordEl.dataset.word
    if (!normalized) return
    const displayWord = wordEl.textContent.replace(/[^\p{L}\p{N}'-]/gu, '').trim()
    if (!displayWord) return

    const panelEl = wordEl.closest('[data-panel]')
    const isTranslated = panelEl?.dataset.panel === 'translated'
    const rect = wordEl.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    // Flip tooltip below the word when it's near the top of the viewport
    const flipped = rect.top < 120
    const yPos = flipped ? rect.bottom : rect.top

    const contextExamples = findContextSentences(normalized, isTranslated)

    setTooltip({ word: displayWord, translated: null, x, y: yPos, flipped, contextExamples })
    setTooltipLoading(true)
    setContextOpen(false)

    // Reverse direction when clicking in the translated panel
    const toLang = isTranslated ? (source_lang_code || 'en') : target_lang_code
    const fromLang = isTranslated ? target_lang_code : 'auto'

    try {
      const data = await translateWord(displayWord, toLang, fromLang)
      setTooltip((prev) => prev ? { ...prev, translated: data.translated } : null)
    } catch {
      setTooltip((prev) => prev ? { ...prev, translated: '⚠ Failed' } : null)
    } finally {
      setTooltipLoading(false)
    }
  }, [target_lang_code, source_lang_code, findContextSentences])

  const handlePanelClick = useCallback((e) => {
    // In pin mode, clicking a sentence pins/unpins it
    if (pinMode) {
      const sentEl = e.target.closest('.sentence-block')
      if (sentEl) {
        const idx = parseInt(sentEl.dataset.sentence, 10)
        if (!isNaN(idx)) togglePin(idx)
      }
      return
    }
    // Otherwise handle word click for tooltip
    handleWordClick(e)
  }, [pinMode, togglePin, handleWordClick])

  const closeTooltip = () => setTooltip(null)

  // ── Reverse word map ──
  const reverseMap = useMemo(() => {
    const rm = {}
    if (!word_map) return rm
    for (const [orig, trans] of Object.entries(word_map)) {
      if (!rm[trans]) rm[trans] = new Set()
      rm[trans].add(orig)
    }
    return rm
  }, [word_map])

  // ── Cross-panel word + sentence highlight ──
  // Track highlighted elements to avoid expensive full-DOM scans on every hover
  const highlightedEls = useRef([])
  const lastHoveredWord = useRef(null)

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

  const addHighlight = useCallback((el, cls) => {
    el.classList.add(cls)
    highlightedEls.current.push([el, cls])
  }, [])

  const highlightSentence = useCallback((el) => {
    const sentenceEl = el.closest('.sentence-block')
    if (!sentenceEl) return
    const idx = sentenceEl.dataset.sentence
    addHighlight(sentenceEl, 'sentence-highlight')
    const panels = isFullscreenRef.current
      ? [fsOrigPanelRef.current, fsTranPanelRef.current]
      : [originalPanelRef.current, translatedPanelRef.current]
    for (const panel of panels) {
      if (!panel) continue
      const match = panel.querySelector(`.sentence-block[data-sentence="${idx}"]`)
      if (match && match !== sentenceEl) addHighlight(match, 'sentence-highlight')
    }
  }, [addHighlight])

  const highlightMatchingWords = useCallback((panelRef, targetWord, sentenceIdx) => {
    if (!targetWord || !panelRef.current) return
    // Scope to the matching sentence in the other panel
    const root = sentenceIdx != null
      ? panelRef.current.querySelector(`.sentence-block[data-sentence="${sentenceIdx}"]`)
      : panelRef.current
    if (!root) return
    const escapedWord = CSS.escape(targetWord)
    const exact = root.querySelectorAll(`[data-word="${escapedWord}"]`)
    if (exact.length) {
      exact.forEach((el) => addHighlight(el, 'word-cross-highlight'))
      return
    }
    const words = targetWord.split(/\s+/)
    words.forEach((w) => {
      if (w.length < 2) return
      root.querySelectorAll(`[data-word="${CSS.escape(w)}"]`)
        .forEach((el) => addHighlight(el, 'word-cross-highlight'))
    })
  }, [addHighlight])

  const handleOriginalHover = useCallback((e) => {
    const wordEl = e.target.closest('.hoverable-word')
    if (!wordEl || wordEl === lastHoveredWord.current) return
    lastHoveredWord.current = wordEl
    clearHighlights()
    highlightSentence(wordEl)
    addHighlight(wordEl, 'word-cross-highlight')
    const word = wordEl.dataset.word
    const sentEl = wordEl.closest('.sentence-block')
    const sentIdx = sentEl ? sentEl.dataset.sentence : null
    const translated = word_map?.[word]
    if (translated) {
      const ref = isFullscreenRef.current ? fsTranPanelRef : translatedPanelRef
      highlightMatchingWords(ref, translated, sentIdx)
    }
  }, [word_map, clearHighlights, highlightSentence, highlightMatchingWords, addHighlight])

  const handleTranslatedHover = useCallback((e) => {
    const wordEl = e.target.closest('.hoverable-word')
    if (!wordEl || wordEl === lastHoveredWord.current) return
    lastHoveredWord.current = wordEl
    clearHighlights()
    highlightSentence(wordEl)
    addHighlight(wordEl, 'word-cross-highlight')
    const word = wordEl.dataset.word
    const sentEl = wordEl.closest('.sentence-block')
    const sentIdx = sentEl ? sentEl.dataset.sentence : null
    const originals = reverseMap[word]
    if (originals) {
      const ref = isFullscreenRef.current ? fsOrigPanelRef : originalPanelRef
      originals.forEach((orig) => {
        highlightMatchingWords(ref, orig, sentIdx)
      })
    }
  }, [reverseMap, clearHighlights, highlightSentence, highlightMatchingWords, addHighlight])

  // ── Tooltip JSX ──
  const [contextOpen, setContextOpen] = useState(false)

  /** Highlight occurrences of `word` inside `text` using <mark> */
  const highlightWordInText = useCallback((text, word) => {
    if (!word || !text) return text
    try {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(${escaped})`, 'gi')
      const parts = text.split(re)
      if (parts.length === 1) return text
      return parts.map((part, i) =>
        re.test(part) ? <mark key={i} className="context-highlight">{part}</mark> : part
      )
    } catch {
      return text
    }
  }, [])

  const tooltipJsx = tooltip && (
    <>
      <div className="word-tooltip-backdrop" onClick={closeTooltip} />
      <div
        className={`word-tooltip word-tooltip-fixed${tooltip.flipped ? ' word-tooltip-flipped' : ''}`}
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        <button className="word-tooltip-close" onClick={closeTooltip}>
          <i className="fas fa-times"></i>
        </button>
        <div className="word-tooltip-original">{tooltip.word}</div>
        <div className="word-tooltip-divider"></div>
        {tooltipLoading ? (
          <div className="word-tooltip-loading"><span className="spinner-sm"></span></div>
        ) : (
          <>
            <div className="word-tooltip-translated">{tooltip.translated}</div>
            <button
              className="word-tooltip-save"
              title="Save to vocabulary notebook"
              onClick={(e) => {
                e.stopPropagation()
                addToVocab(tooltip.word, tooltip.translated)
                closeTooltip()
              }}
            >
              <i className="fas fa-plus"></i> Save
            </button>
          </>
        )}
        {tooltip.contextExamples && tooltip.contextExamples.length > 0 && (
          <div className="word-tooltip-context">
            <button
              className="word-tooltip-context-toggle"
              onClick={(e) => { e.stopPropagation(); setContextOpen((v) => !v) }}
            >
              <i className={`fas fa-chevron-${contextOpen ? 'up' : 'down'}`}></i>
              <i className="fas fa-quote-left"></i>
              {contextOpen ? 'Hide' : 'Show'} examples ({tooltip.contextExamples.length})
            </button>
            {contextOpen && tooltip.contextExamples.map((ex) => (
              <div key={ex.index} className="word-tooltip-context-item">
                <div className="context-original">{highlightWordInText(ex.original, tooltip.word)}</div>
                <div className="context-translated">{highlightWordInText(ex.translated, tooltip.translated)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* ──── Header ──── */}
      <section className="result-header">
        {/* CEFR Difficulty Badges */}
        {(original_cefr || translated_cefr) && (
          <div className="cefr-bar">
            {original_cefr && (
              <div className={`cefr-badge cefr-${original_cefr.level?.toLowerCase()}`}>
                <span className="cefr-level">{original_cefr.level}</span>
                <span className="cefr-desc">
                  Original &middot; avg&nbsp;freq&nbsp;{original_cefr.score} &middot; {original_cefr.rare_pct}% rare/uncommon
                </span>
              </div>
            )}
            {translated_cefr && (
              <div className={`cefr-badge cefr-${translated_cefr.level?.toLowerCase()}`}>
                <span className="cefr-level">{translated_cefr.level}</span>
                <span className="cefr-desc">
                  Translated &middot; avg&nbsp;freq&nbsp;{translated_cefr.score} &middot; {translated_cefr.rare_pct}% rare/uncommon
                </span>
              </div>
            )}
          </div>
        )}

        <p className="result-hint">
          {pinMode && <span style={{ color: 'var(--warning)', fontWeight: 600 }}> &middot; Pin mode ON — click any sentence to pin/unpin</span>}
        </p>

        <div className="result-toolbar">
          <div className="toolbar-actions">
            <button
              className={`btn-notebook-toggle ${pinMode ? 'active' : ''}`}
              onClick={() => setPinMode((v) => !v)}
              title={pinMode ? 'Exit pin mode' : 'Enter pin mode — click sentences to pin them'}
            >
              <i className="fas fa-thumbtack"></i>
              {pinMode ? 'Exit Pin Mode' : 'Pin Mode'}
            </button>
            <button
              className={`btn-notebook-toggle ${pinsOpen ? 'active' : ''}`}
              onClick={() => setPinsOpen((v) => !v)}
            >
              <i className="fas fa-list"></i>
              Pins
              {pinnedSentences.size > 0 && <span className="vocab-badge">{pinnedSentences.size}</span>}
            </button>
            <button
              className={`btn-notebook-toggle ${notebookOpen ? 'active' : ''}`}
              onClick={() => setNotebookOpen((v) => !v)}
            >
              <i className="fas fa-book"></i>
              Vocabulary
              {vocab.length > 0 && <span className="vocab-badge">{vocab.length}</span>}
            </button>
            <button
              className={`btn-notebook-toggle ${quizOpen ? 'active' : ''}`}
              onClick={() => setQuizOpen((v) => !v)}
            >
              <i className="fas fa-brain"></i>
              Quiz
              {vocab.length > 0 && <span className="vocab-badge">{vocab.length}</span>}
            </button>
            <button
              className={`btn-notebook-toggle ${syncScroll ? 'active' : ''}`}
              onClick={() => setSyncScroll((v) => !v)}
              title="Sync scroll between panels"
            >
              <i className="fas fa-arrows-alt-v"></i>
              Sync Scroll
            </button>
            <button
              className={`btn-notebook-toggle ${freqHighlight ? 'active' : ''}`}
              onClick={() => setFreqHighlight((v) => !v)}
              title="Highlight words by frequency"
            >
              <i className="fas fa-paint-brush"></i>
              Word Freq
            </button>
            <button className="btn btn-outline" onClick={onBack}>
              <i className="fas fa-arrow-left"></i> Translate Another
            </button>
            <button
              className="btn-expand"
              onClick={() => setFullscreen(true)}
              title="Open both panels fullscreen"
            >
              <i className="fas fa-expand"></i> Fullscreen
            </button>
          </div>
        </div>
      </section>

      {/* ──── Drawers & Legend (normal view only) ──── */}
      {!fullscreen && pinsOpen && (
        <div className="pins-drawer">
          <div className="pins-drawer-header">
            <h3><i className="fas fa-thumbtack"></i> Pinned Sentences</h3>
            <button className="btn-close-drawer" onClick={() => setPinsOpen(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          {pinnedSentences.size === 0 ? (
            <p className="pins-empty">No pinned sentences yet. Right-click any sentence to pin it.</p>
          ) : (
            <ul className="pins-list">
              {[...pinnedSentences].sort((a, b) => a - b).map((idx) => {
                const text = originalSentences[idx] || `Sentence ${idx + 1}`
                return (
                  <li key={idx} className="pins-list-item">
                    <button className="pins-list-btn" onClick={() => scrollToSentence(idx)} title="Scroll to sentence">
                      <span className="pins-list-number">#{idx + 1}</span>
                      <span className="pins-list-text">{text.length > 80 ? text.slice(0, 80) + '…' : text}</span>
                    </button>
                    <button className="pins-list-remove" onClick={() => togglePin(idx)} title="Unpin">
                      <i className="fas fa-times"></i>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {!fullscreen && quizOpen && (
        <FlashcardQuiz vocab={vocab} onClose={() => setQuizOpen(false)} />
      )}
      {!fullscreen && notebookOpen && (
        <VocabularyNotebook vocab={vocab} onRemove={removeFromVocab} onClear={clearVocab} onClose={() => setNotebookOpen(false)} />
      )}
      {!fullscreen && freqHighlight && (
        <div className="freq-legend">
          <span className="freq-legend-title"><i className="fas fa-paint-brush"></i> Word Frequency:</span>
          <span className="freq-legend-item freq-very-common">Very Common</span>
          <span className="freq-legend-item freq-common">Common</span>
          <span className="freq-legend-item freq-uncommon">Uncommon</span>
          <span className="freq-legend-item freq-rare">Rare</span>
        </div>
      )}

      {/* ════ SIDE-BY-SIDE VIEW WITH SENTENCE BORDERS ════ */}
      <section className="translation-container">
        <div className="text-panel original-panel">
          <div className="panel-header">
            <h2><i className="fas fa-file-alt"></i> Original Text</h2>
            <div className="panel-header-actions">
              <CopyButton targetId="originalText" />
            </div>
          </div>
          <div
            className={`panel-body interactive-text${pinMode ? ' pin-mode' : ''}`}
            id="originalText"
            data-panel="original"
            ref={originalPanelRef}
            onMouseOver={handleOriginalHover}
            onMouseLeave={handleMouseOut}
            onClick={handlePanelClick}
            onContextMenu={handleContextMenu}
          >
            {hasSentences
              ? <SentenceBlockRenderer pairs={originalSentences} pinnedSet={pinnedSentences} />
              : <WordRenderer text={original_text} />
            }
          </div>
        </div>

        <div className="text-panel translated-panel">
          <div className="panel-header">
            <h2><i className="fas fa-language"></i> Translated ({target_lang})</h2>
            <div className="panel-header-actions">
              <CopyButton targetId="translatedText" />
            </div>
          </div>
          <div
            className={`panel-body interactive-text${pinMode ? ' pin-mode' : ''}`}
            id="translatedText"
            data-panel="translated"
            ref={translatedPanelRef}
            onMouseOver={handleTranslatedHover}
            onMouseLeave={handleMouseOut}
            onClick={handlePanelClick}
            onContextMenu={handleContextMenu}
          >
            {hasSentences
              ? <SentenceBlockRenderer pairs={translatedSentences} pinnedSet={pinnedSentences} />
              : <WordRenderer text={translated_text} />
            }
          </div>
        </div>
      </section>

      {/* Tooltip (normal view) */}
      {!fullscreen && tooltipJsx}

      {/* ──── Fullscreen Mode ──── */}
      {fullscreen && (
        <div className="fullscreen-overlay">
          <div className="fullscreen-modal">

            {/* ── Toolbar ── */}
            <div className="fullscreen-toolbar">
              <div className="fullscreen-toolbar-left">
                <i className="fas fa-expand-arrows-alt"></i>
                <span>Fullscreen</span>
                {pinMode && (
                  <span className="fs-pin-hint">
                    <i className="fas fa-thumbtack"></i> Pin mode ON
                  </span>
                )}
              </div>
              <div className="fullscreen-toolbar-actions">
                <button className={`btn-notebook-toggle ${pinMode ? 'active' : ''}`} onClick={() => setPinMode((v) => !v)}>
                  <i className="fas fa-thumbtack"></i> {pinMode ? 'Exit Pin' : 'Pin Mode'}
                </button>
                <button className={`btn-notebook-toggle ${pinsOpen ? 'active' : ''}`} onClick={() => setPinsOpen((v) => !v)}>
                  <i className="fas fa-list"></i> Pins
                  {pinnedSentences.size > 0 && <span className="vocab-badge">{pinnedSentences.size}</span>}
                </button>
                <button className={`btn-notebook-toggle ${notebookOpen ? 'active' : ''}`} onClick={() => setNotebookOpen((v) => !v)}>
                  <i className="fas fa-book"></i> Vocabulary
                  {vocab.length > 0 && <span className="vocab-badge">{vocab.length}</span>}
                </button>
                <button className={`btn-notebook-toggle ${quizOpen ? 'active' : ''}`} onClick={() => setQuizOpen((v) => !v)}>
                  <i className="fas fa-brain"></i> Quiz
                  {vocab.length > 0 && <span className="vocab-badge">{vocab.length}</span>}
                </button>
                <button className={`btn-notebook-toggle ${syncScroll ? 'active' : ''}`} onClick={() => setSyncScroll((v) => !v)} title="Sync scroll">
                  <i className="fas fa-arrows-alt-v"></i> Sync
                </button>
                <button className={`btn-notebook-toggle ${freqHighlight ? 'active' : ''}`} onClick={() => setFreqHighlight((v) => !v)} title="Word frequency">
                  <i className="fas fa-paint-brush"></i> Freq
                </button>
                <button className={`btn-notebook-toggle ${bookMode ? 'active' : ''}`} onClick={() => setBookMode((v) => !v)} title="Book reading mode">
                  <i className="fas fa-book-open"></i> Book
                </button>
                <button className="btn-expand" onClick={() => setFullscreen(false)} title="Exit fullscreen">
                  <i className="fas fa-compress"></i> Exit
                </button>
              </div>
            </div>

            {/* ── Drawers inside fullscreen ── */}
            {pinsOpen && (
              <div className="fs-drawer-area">
                <div className="pins-drawer">
                  <div className="pins-drawer-header">
                    <h3><i className="fas fa-thumbtack"></i> Pinned Sentences</h3>
                    <button className="btn-close-drawer" onClick={() => setPinsOpen(false)}><i className="fas fa-times"></i></button>
                  </div>
                  {pinnedSentences.size === 0 ? (
                    <p className="pins-empty">No pinned sentences yet. Right-click any sentence to pin it.</p>
                  ) : (
                    <ul className="pins-list">
                      {[...pinnedSentences].sort((a, b) => a - b).map((idx) => {
                        const text = originalSentences[idx] || `Sentence ${idx + 1}`
                        return (
                          <li key={idx} className="pins-list-item">
                            <button className="pins-list-btn" onClick={() => scrollToSentence(idx)}>
                              <span className="pins-list-number">#{idx + 1}</span>
                              <span className="pins-list-text">{text.length > 80 ? text.slice(0, 80) + '…' : text}</span>
                            </button>
                            <button className="pins-list-remove" onClick={() => togglePin(idx)}>
                              <i className="fas fa-times"></i>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {quizOpen && <FlashcardQuiz vocab={vocab} onClose={() => setQuizOpen(false)} />}
            {notebookOpen && <VocabularyNotebook vocab={vocab} onRemove={removeFromVocab} onClear={clearVocab} onClose={() => setNotebookOpen(false)} />}
            {freqHighlight && (
              <div className="freq-legend">
                <span className="freq-legend-title"><i className="fas fa-paint-brush"></i> Word Frequency:</span>
                <span className="freq-legend-item freq-very-common">Very Common</span>
                <span className="freq-legend-item freq-common">Common</span>
                <span className="freq-legend-item freq-uncommon">Uncommon</span>
                <span className="freq-legend-item freq-rare">Rare</span>
              </div>
            )}

            {/* ── Side-by-side panels OR Book mode ── */}
            {bookMode ? (
              <div className="book-reader">
                <div className={`book-spread${bookFlipDir ? ` book-flip-${bookFlipDir}` : ''}`}>
                  {/* Left page — Original */}
                  <div className="book-page book-page-left">
                    <div className="book-page-label"><i className="fas fa-file-alt"></i> Original</div>
                    <div
                      className={`book-page-body interactive-text original-panel${pinMode ? ' pin-mode' : ''}`}
                      data-panel="original"
                      onMouseOver={handleOriginalHover}
                      onMouseLeave={handleMouseOut}
                      onClick={handlePanelClick}
                      onContextMenu={handleContextMenu}
                    >
                      <BookPageRenderer
                        sentences={(hasSentences ? originalSentences : original_text.split(/\n{2,}/)).slice(
                          bookPage * SENTENCES_PER_PAGE, (bookPage + 1) * SENTENCES_PER_PAGE
                        )}
                        globalOffset={bookPage * SENTENCES_PER_PAGE}
                        pinnedSet={pinnedSentences}
                      />
                    </div>
                    <div className="book-page-number">{bookPage * 2 + 1}</div>
                  </div>

                  <div className="book-spine" />

                  {/* Right page — Translated */}
                  <div className="book-page book-page-right">
                    <div className="book-page-label"><i className="fas fa-language"></i> {target_lang}</div>
                    <div
                      className={`book-page-body interactive-text translated-panel${pinMode ? ' pin-mode' : ''}`}
                      data-panel="translated"
                      onMouseOver={handleTranslatedHover}
                      onMouseLeave={handleMouseOut}
                      onClick={handlePanelClick}
                      onContextMenu={handleContextMenu}
                    >
                      <BookPageRenderer
                        sentences={(hasSentences ? translatedSentences : translated_text.split(/\n{2,}/)).slice(
                          bookPage * SENTENCES_PER_PAGE, (bookPage + 1) * SENTENCES_PER_PAGE
                        )}
                        globalOffset={bookPage * SENTENCES_PER_PAGE}
                        pinnedSet={pinnedSentences}
                      />
                    </div>
                    <div className="book-page-number">{bookPage * 2 + 2}</div>
                  </div>
                </div>

                <div className="book-nav">
                  <button className="book-nav-btn" onClick={() => goBookPage('backward')} disabled={bookPage === 0} title="Previous page (←)">
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <span className="book-nav-info">Page {bookPage + 1} / {totalBookPages}</span>
                  <button className="book-nav-btn" onClick={() => goBookPage('forward')} disabled={bookPage >= totalBookPages - 1} title="Next page (→)">
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            ) : (
            <div className="fullscreen-split-body">
              <div className="fullscreen-split-panel">
                <div className="fullscreen-split-panel-header">
                  <h2><i className="fas fa-file-alt"></i> Original Text</h2>
                  <CopyButton targetId="fs-originalText" />
                </div>
                <div
                  className={`fullscreen-modal-body interactive-text original-panel${pinMode ? ' pin-mode' : ''}`}
                  id="fs-originalText"
                  data-panel="original"
                  ref={fsOrigPanelRef}
                  onMouseOver={handleOriginalHover}
                  onMouseLeave={handleMouseOut}
                  onClick={handlePanelClick}
                  onContextMenu={handleContextMenu}
                >
                  {hasSentences
                    ? <SentenceBlockRenderer pairs={originalSentences} pinnedSet={pinnedSentences} />
                    : <WordRenderer text={original_text} />}
                </div>
              </div>

              <div className="fullscreen-split-divider" />

              <div className="fullscreen-split-panel">
                <div className="fullscreen-split-panel-header">
                  <h2><i className="fas fa-language"></i> Translated ({target_lang})</h2>
                  <CopyButton targetId="fs-translatedText" />
                </div>
                <div
                  className={`fullscreen-modal-body interactive-text translated-panel${pinMode ? ' pin-mode' : ''}`}
                  id="fs-translatedText"
                  data-panel="translated"
                  ref={fsTranPanelRef}
                  onMouseOver={handleTranslatedHover}
                  onMouseLeave={handleMouseOut}
                  onClick={handlePanelClick}
                  onContextMenu={handleContextMenu}
                >
                  {hasSentences
                    ? <SentenceBlockRenderer pairs={translatedSentences} pinnedSet={pinnedSentences} />
                    : <WordRenderer text={translated_text} />}
                </div>
              </div>
            </div>
            )}{/* end book mode ternary */}

            {/* Tooltip inside fullscreen */}
            {tooltipJsx}
          </div>
        </div>
      )}
    </>
  )
}

export default ResultView
