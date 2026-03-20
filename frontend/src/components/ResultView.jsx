import { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react'
import { translateWord } from '../api'
import VocabularyNotebook from './VocabularyNotebook'

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

// ═══════════════════════════════════════════════════════════════════════════
// ResultView
// ═══════════════════════════════════════════════════════════════════════════

function ResultView({ result, onBack }) {
  const {
    filename,
    target_lang,
    target_lang_code,
    source_lang_code,
    original_text,
    translated_text,
    word_map,
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

  // ── Pinned Sentences ──
  const PINS_KEY = 'translator_pinned_sentences'
  const [pinnedSentences, setPinnedSentences] = useState(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(PINS_KEY)) || [])
    } catch { return new Set() }
  })
  const [pinsOpen, setPinsOpen] = useState(false)

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
    const el = document.getElementById(`sentence-${idx}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('sentence-flash')
      setTimeout(() => el.classList.remove('sentence-flash'), 1500)
    }
  }, [])

  // ── Right-click to pin a sentence (no floating button = no lag) ──
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
  const [tooltip, setTooltip] = useState(null)
  const [tooltipLoading, setTooltipLoading] = useState(false)
  const [tooltipPanel, setTooltipPanel] = useState('original') // which panel the tooltip is in

  // ── Click a word → translate tooltip + save button ──
  const handleWordClick = useCallback(async (e) => {
    const wordEl = e.target.closest('.hoverable-word')
    if (!wordEl) return

    const normalized = wordEl.dataset.word
    if (!normalized) return
    const displayWord = wordEl.textContent.replace(/[^\p{L}\p{N}'-]/gu, '').trim()
    if (!displayWord) return

    const container = wordEl.closest('.panel-body') || originalPanelRef.current
    const isTranslated = container === translatedPanelRef.current
    const containerRect = container.getBoundingClientRect()
    const rect = wordEl.getBoundingClientRect()
    const x = rect.left - containerRect.left + container.scrollLeft + rect.width / 2
    const y = rect.top - containerRect.top + container.scrollTop

    setTooltipPanel(isTranslated ? 'translated' : 'original')
    setTooltip({ word: displayWord, translated: null, x, y })
    setTooltipLoading(true)

    // Reverse direction when clicking in the translated panel
    const toLang = isTranslated ? (source_lang_code || 'en') : target_lang_code
    const fromLang = isTranslated ? target_lang_code : 'auto'

    try {
      const data = await translateWord(displayWord, toLang, fromLang)
      setTooltip({ word: displayWord, translated: data.translated, x, y })
    } catch {
      setTooltip({ word: displayWord, translated: '⚠ Failed', x, y })
    } finally {
      setTooltipLoading(false)
    }
  }, [target_lang_code, source_lang_code])

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

  // ── Cross-panel word + sentence highlight (same approach as pre-pin version) ──
  const clearHighlights = useCallback(() => {
    document.querySelectorAll('.word-cross-highlight')
      .forEach((el) => el.classList.remove('word-cross-highlight'))
    document.querySelectorAll('.sentence-highlight')
      .forEach((el) => el.classList.remove('sentence-highlight'))
  }, [])

  const highlightSentence = useCallback((el) => {
    const sentenceEl = el.closest('.sentence-block')
    if (!sentenceEl) return
    const idx = sentenceEl.dataset.sentence
    sentenceEl.classList.add('sentence-highlight')
    document.querySelectorAll(`.sentence-block[data-sentence="${idx}"]`)
      .forEach((s) => s.classList.add('sentence-highlight'))
  }, [])

  const highlightMatchingWords = useCallback((panelSelector, targetWord) => {
    if (!targetWord) return
    const escapedWord = CSS.escape(targetWord)
    const exact = document.querySelectorAll(
      `${panelSelector} [data-word="${escapedWord}"]`
    )
    if (exact.length) {
      exact.forEach((el) => el.classList.add('word-cross-highlight'))
      return
    }
    const words = targetWord.split(/\s+/)
    words.forEach((w) => {
      if (w.length < 2) return
      document.querySelectorAll(`${panelSelector} [data-word="${CSS.escape(w)}"]`)
        .forEach((el) => el.classList.add('word-cross-highlight'))
    })
  }, [])

  const handleOriginalHover = useCallback((e) => {
    const wordEl = e.target.closest('.hoverable-word')
    if (!wordEl) return
    clearHighlights()
    highlightSentence(wordEl)
    wordEl.classList.add('word-cross-highlight')
    const word = wordEl.dataset.word
    const translated = word_map?.[word]
    if (translated) {
      highlightMatchingWords('.translated-panel', translated)
    }
  }, [word_map, clearHighlights, highlightSentence, highlightMatchingWords])

  const handleTranslatedHover = useCallback((e) => {
    const wordEl = e.target.closest('.hoverable-word')
    if (!wordEl) return
    clearHighlights()
    highlightSentence(wordEl)
    wordEl.classList.add('word-cross-highlight')
    const word = wordEl.dataset.word
    const originals = reverseMap[word]
    if (originals) {
      originals.forEach((orig) => {
        highlightMatchingWords('.original-panel', orig)
      })
    }
  }, [reverseMap, clearHighlights, highlightSentence, highlightMatchingWords])

  // ── Tooltip JSX ──
  const tooltipJsx = tooltip && (
    <>
      <div className="word-tooltip-backdrop" onClick={closeTooltip} />
      <div className="word-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
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
        <h1>Translation Result</h1>
        <p className="result-meta">
          <span><i className="fas fa-file-pdf"></i> {filename}</span>
          <span><i className="fas fa-arrow-right"></i></span>
          <span><i className="fas fa-globe"></i> {target_lang}</span>
        </p>
        <p className="result-hint">
          <i className="fas fa-mouse-pointer"></i> Hover words to highlight &middot; Click for translation &middot; Right-click a sentence to pin it
        </p>

        <div className="result-toolbar">
          <div className="toolbar-actions">
            <button
              className={`btn-notebook-toggle ${pinsOpen ? 'active' : ''}`}
              onClick={() => setPinsOpen((v) => !v)}
            >
              <i className="fas fa-thumbtack"></i>
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
            <button className="btn btn-outline" onClick={onBack}>
              <i className="fas fa-arrow-left"></i> Translate Another
            </button>
          </div>
        </div>
      </section>

      {/* ──── Pinned Sentences Drawer ──── */}
      {pinsOpen && (
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
                    <button
                      className="pins-list-btn"
                      onClick={() => scrollToSentence(idx)}
                      title="Scroll to sentence"
                    >
                      <span className="pins-list-number">#{idx + 1}</span>
                      <span className="pins-list-text">{text.length > 80 ? text.slice(0, 80) + '…' : text}</span>
                    </button>
                    <button
                      className="pins-list-remove"
                      onClick={() => togglePin(idx)}
                      title="Unpin"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* ──── Vocabulary Notebook Drawer ──── */}
      {notebookOpen && (
        <VocabularyNotebook
          vocab={vocab}
          onRemove={removeFromVocab}
          onClear={clearVocab}
          onClose={() => setNotebookOpen(false)}
        />
      )}

      {/* ════ SIDE-BY-SIDE VIEW WITH SENTENCE BORDERS ════ */}
      <section className="translation-container">
        <div className="text-panel original-panel">
          <div className="panel-header">
            <h2><i className="fas fa-file-alt"></i> Original Text</h2>
            <CopyButton targetId="originalText" />
          </div>
          <div
            className="panel-body interactive-text"
            id="originalText"
            ref={originalPanelRef}
            onMouseOver={handleOriginalHover}
            onMouseOut={clearHighlights}
            onClick={handleWordClick}
            onContextMenu={handleContextMenu}
          >
            {hasSentences
              ? <SentenceBlockRenderer pairs={originalSentences} pinnedSet={pinnedSentences} />
              : <WordRenderer text={original_text} />
            }
            {tooltipPanel === 'original' && tooltipJsx}
          </div>
        </div>

        <div className="text-panel translated-panel">
          <div className="panel-header">
            <h2><i className="fas fa-language"></i> Translated ({target_lang})</h2>
            <CopyButton targetId="translatedText" />
          </div>
          <div
            className="panel-body interactive-text"
            id="translatedText"
            ref={translatedPanelRef}
            onMouseOver={handleTranslatedHover}
            onMouseOut={clearHighlights}
            onClick={handleWordClick}
            onContextMenu={handleContextMenu}
          >
            {hasSentences
              ? <SentenceBlockRenderer pairs={translatedSentences} pinnedSet={pinnedSentences} />
              : <WordRenderer text={translated_text} />
            }
            {tooltipPanel === 'translated' && tooltipJsx}
          </div>
        </div>
      </section>
    </>
  )
}

export default ResultView
