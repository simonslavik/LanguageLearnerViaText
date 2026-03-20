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

/** Render text as word-level <span> elements with data-word attrs.
 *  Normalise to match the backend regex: [^\W\d_][\w']* → lowercase.
 */
const WordRenderer = memo(function WordRenderer({ text }) {
  // Split into (word | non-word) tokens while keeping everything
  const tokens = text.split(/([^\s]+)/)
  return tokens.map((token, i) => {
    if (!token || /^\s+$/.test(token)) return token
    // Extract the core word (letters + digits + apostrophes, matching backend)
    const normalized = token
      .replace(/^[^\p{L}\p{N}]+/u, '')   // strip leading punctuation
      .replace(/[^\p{L}\p{N}]+$/u, '')   // strip trailing punctuation
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
const SentenceBlockRenderer = memo(function SentenceBlockRenderer({ pairs, pinnedArr }) {
  const pinnedSet = useMemo(() => new Set(pinnedArr), [pinnedArr])
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

  // Stable sorted array for SentenceBlockRenderer memo comparison
  const pinnedArr = useMemo(
    () => [...pinnedSentences].sort((a, b) => a - b),
    [pinnedSentences],
  )

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

  // ── Floating pin button ──
  const pinBtnRef = useRef(null)
  const hoveredSentenceIdx = useRef(null)
  const pinnedRef = useRef(pinnedSentences)
  pinnedRef.current = pinnedSentences

  const handlePinClick = useCallback(() => {
    const idx = hoveredSentenceIdx.current
    if (idx != null) togglePin(idx)
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

  // ── Cross-panel highlight (JS only for cross-panel; same-panel is pure CSS) ──
  const highlightedEls = useRef([])
  const lastWord = useRef(null)

  const origWordIndex = useRef(new Map())
  const transWordIndex = useRef(new Map())
  const origSentenceIndex = useRef(new Map())
  const transSentenceIndex = useRef(new Map())

  // Build indexes once after render
  useEffect(() => {
    const build = (panelRef, wIdx, sIdx) => {
      wIdx.current = new Map()
      sIdx.current = new Map()
      const panel = panelRef.current
      if (!panel) return
      for (const sb of panel.querySelectorAll('.sentence-block'))
        sIdx.current.set(sb.dataset.sentence, sb)
      for (const el of panel.querySelectorAll('.hoverable-word')) {
        const w = el.dataset.word
        const s = el.parentElement?.dataset?.sentence
        const key = s != null ? `${w}:${s}` : w
        const arr = wIdx.current.get(key) || []
        arr.push(el)
        wIdx.current.set(key, arr)
      }
    }
    build(originalPanelRef, origWordIndex, origSentenceIndex)
    build(translatedPanelRef, transWordIndex, transSentenceIndex)
  }, [originalSentences, translatedSentences])

  // Cross-panel highlight + pin button
  useEffect(() => {
    const origPanel = originalPanelRef.current
    const transPanel = translatedPanelRef.current
    if (!origPanel || !transPanel) return
    const pinBtn = pinBtnRef.current

    const clear = () => {
      const h = highlightedEls.current
      for (let i = h.length - 1; i >= 0; i--)
        h[i].classList.remove('word-cross-highlight', 'sentence-highlight')
      h.length = 0
    }

    const handleHover = (e, isOrig) => {
      const t = e.target
      if (!t.classList?.contains('hoverable-word')) return
      if (t === lastWord.current) return
      lastWord.current = t
      clear()

      const h = highlightedEls.current
      const sentEl = t.parentElement
      const si = sentEl?.dataset?.sentence

      // Cross-panel sentence highlight (same-panel sentence is handled by CSS :has())
      if (si != null) {
        const other = (isOrig ? transSentenceIndex : origSentenceIndex).current.get(si)
        if (other) { other.classList.add('sentence-highlight'); h.push(other) }
      }

      // Cross-panel word matching
      const word = t.dataset.word
      const cross = isOrig ? transWordIndex : origWordIndex
      let lookups
      if (isOrig) {
        const tr = word_map?.[word]
        if (tr) lookups = tr.split(/\s+/)
      } else {
        const origs = reverseMap[word]
        if (origs) { lookups = []; for (const o of origs) for (const p of o.split(/\s+/)) lookups.push(p) }
      }
      if (lookups) {
        for (const lw of lookups) {
          if (lw.length < 2) continue
          const els = (si != null && cross.current.get(`${lw}:${si}`)) || cross.current.get(lw)
          if (els) for (const el of els) { el.classList.add('word-cross-highlight'); h.push(el) }
        }
      }
    }

    const handleLeave = () => { lastWord.current = null; clear() }

    // Pin button — fires on original panel only
    const showPin = (e) => {
      if (!pinBtn) return
      const t = e.target
      const sentEl = t.dataset?.sentence != null ? t : t.parentElement?.dataset?.sentence != null ? t.parentElement : null
      if (!sentEl) { pinBtn.style.opacity = '0'; pinBtn.style.pointerEvents = 'none'; hoveredSentenceIdx.current = null; return }
      const idx = parseInt(sentEl.dataset.sentence, 10)
      if (idx === hoveredSentenceIdx.current) return
      hoveredSentenceIdx.current = idx
      const isPinned = pinnedRef.current.has(idx)
      pinBtn.classList.toggle('active', isPinned)
      pinBtn.title = isPinned ? 'Unpin sentence' : 'Pin sentence'
      const pr = origPanel.getBoundingClientRect()
      const sr = sentEl.getBoundingClientRect()
      pinBtn.style.top = (sr.top - pr.top + origPanel.scrollTop) + 'px'
      pinBtn.style.left = (sr.right - pr.left + origPanel.scrollLeft + 4) + 'px'
      pinBtn.style.opacity = '1'
      pinBtn.style.pointerEvents = 'auto'
    }
    const hidePin = () => { if (pinBtn) { pinBtn.style.opacity = '0'; pinBtn.style.pointerEvents = 'none'; hoveredSentenceIdx.current = null } }

    const onOrig = (e) => { handleHover(e, true); showPin(e) }
    const onTrans = (e) => handleHover(e, false)
    const onOrigLeave = () => { handleLeave(); hidePin() }

    origPanel.addEventListener('mouseover', onOrig, { passive: true })
    origPanel.addEventListener('mouseleave', onOrigLeave, { passive: true })
    transPanel.addEventListener('mouseover', onTrans, { passive: true })
    transPanel.addEventListener('mouseleave', handleLeave, { passive: true })

    return () => {
      origPanel.removeEventListener('mouseover', onOrig)
      origPanel.removeEventListener('mouseleave', onOrigLeave)
      transPanel.removeEventListener('mouseover', onTrans)
      transPanel.removeEventListener('mouseleave', handleLeave)
    }
  }, [word_map, reverseMap, originalSentences, translatedSentences])

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
            <p className="pins-empty">No pinned sentences yet. Click the <i className="fas fa-thumbtack"></i> icon next to any sentence to pin it.</p>
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
            onClick={handleWordClick}
          >
            {hasSentences
              ? <SentenceBlockRenderer pairs={originalSentences} pinnedArr={pinnedArr} />
              : <WordRenderer text={original_text} />
            }
            {tooltipJsx}
            {/* Single floating pin button */}
            <button
              ref={pinBtnRef}
              className="btn-pin-float"
              onClick={handlePinClick}
              style={{ opacity: 0, pointerEvents: 'none' }}
            >
              <i className="fas fa-thumbtack"></i>
            </button>
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
            onClick={handleWordClick}
          >
            {hasSentences
              ? <SentenceBlockRenderer pairs={translatedSentences} pinnedArr={pinnedArr} />
              : <WordRenderer text={translated_text} />
            }
          </div>
        </div>
      </section>
    </>
  )
}

export default ResultView
