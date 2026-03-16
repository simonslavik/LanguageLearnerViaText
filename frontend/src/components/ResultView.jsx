import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
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
function WordRenderer({ text }) {
  const tokens = text.split(/(\s+)/)
  return tokens.map((token, i) => {
    if (/^\s+$/.test(token)) return token
    const normalized = token.replace(/[^\p{L}\p{N}'-]/gu, '').toLowerCase()
    if (!normalized) return <span key={i}>{token}</span>
    return (
      <span key={i} className="hoverable-word" data-word={normalized}>
        {token}
      </span>
    )
  })
}

/** Render sentence_pairs as bordered sentence blocks with data-sentence index. */
function SentenceBlockRenderer({ pairs }) {
  return pairs.map((pair, idx) => (
    <span key={idx} className="sentence-block" data-sentence={idx}>
      <WordRenderer text={pair} />
    </span>
  ))
}

// ═══════════════════════════════════════════════════════════════════════════
// ResultView
// ═══════════════════════════════════════════════════════════════════════════

function ResultView({ result, onBack }) {
  const {
    filename,
    target_lang,
    target_lang_code,
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

  // ── Click a word → translate tooltip + save button ──
  const handleWordClick = useCallback(async (e) => {
    const wordEl = e.target.closest('.hoverable-word')
    if (!wordEl) return

    const normalized = wordEl.dataset.word
    if (!normalized) return
    const displayWord = wordEl.textContent.replace(/[^\p{L}\p{N}'-]/gu, '').trim()
    if (!displayWord) return

    const container = wordEl.closest('.panel-body') || originalPanelRef.current
    const containerRect = container.getBoundingClientRect()
    const rect = wordEl.getBoundingClientRect()
    const x = rect.left - containerRect.left + rect.width / 2
    const y = rect.top - containerRect.top

    setTooltip({ word: displayWord, translated: null, x, y })
    setTooltipLoading(true)

    try {
      const data = await translateWord(displayWord, target_lang_code)
      setTooltip({ word: displayWord, translated: data.translated, x, y })
    } catch {
      setTooltip({ word: displayWord, translated: '⚠ Failed', x, y })
    } finally {
      setTooltipLoading(false)
    }
  }, [target_lang_code])

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

  // ── Cross-panel word + sentence highlight (DOM-based) ──
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
    // Highlight matching sentence in the OTHER panel
    document.querySelectorAll(`.sentence-block[data-sentence="${idx}"]`)
      .forEach((s) => s.classList.add('sentence-highlight'))
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
      document.querySelectorAll(`[data-word="${CSS.escape(translated)}"]`)
        .forEach((el) => el.classList.add('word-cross-highlight'))
    }
  }, [word_map, clearHighlights, highlightSentence])

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
        document.querySelectorAll(`[data-word="${CSS.escape(orig)}"]`)
          .forEach((el) => el.classList.add('word-cross-highlight'))
      })
    }
  }, [reverseMap, clearHighlights, highlightSentence])

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
          <i className="fas fa-mouse-pointer"></i> Hover words to highlight matches &amp; sentences &middot; Click a word for translation &amp; save
        </p>

        <div className="result-toolbar">
          <div className="toolbar-actions">
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
          >
            {hasSentences
              ? <SentenceBlockRenderer pairs={originalSentences} />
              : <WordRenderer text={original_text} />
            }
            {tooltipJsx}
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
          >
            {hasSentences
              ? <SentenceBlockRenderer pairs={translatedSentences} />
              : <WordRenderer text={translated_text} />
            }
          </div>
        </div>
      </section>
    </>
  )
}

export default ResultView
