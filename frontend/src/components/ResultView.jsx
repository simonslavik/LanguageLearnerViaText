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

  // ── Floating pin button (single DOM element, positioned on hover) ──
  const pinBtnRef = useRef(null)
  const hoveredSentenceIdx = useRef(null)

  useEffect(() => {
    const panel = originalPanelRef.current
    if (!panel) return
    const pinBtn = pinBtnRef.current
    if (!pinBtn) return

    const showPin = (e) => {
      const target = e.target
      // Walk up at most 2 levels to find sentence-block (word → sentence)
      const sentEl = target.dataset?.sentence != null ? target
        : target.parentElement?.dataset?.sentence != null ? target.parentElement
        : null
      if (!sentEl) {
        pinBtn.style.opacity = '0'
        pinBtn.style.pointerEvents = 'none'
        hoveredSentenceIdx.current = null
        return
      }
      const idx = parseInt(sentEl.dataset.sentence, 10)
      if (idx === hoveredSentenceIdx.current) return
      hoveredSentenceIdx.current = idx
      const isPinned = pinnedSentences.has(idx)
      pinBtn.classList.toggle('active', isPinned)
      pinBtn.title = isPinned ? 'Unpin sentence' : 'Pin sentence'
      // Position relative to panel
      const panelRect = panel.getBoundingClientRect()
      const sentRect = sentEl.getBoundingClientRect()
      pinBtn.style.top = (sentRect.top - panelRect.top + panel.scrollTop) + 'px'
      pinBtn.style.left = (sentRect.right - panelRect.left + panel.scrollLeft + 4) + 'px'
      pinBtn.style.opacity = '1'
      pinBtn.style.pointerEvents = 'auto'
    }

    const hidePin = () => {
      pinBtn.style.opacity = '0'
      pinBtn.style.pointerEvents = 'none'
      hoveredSentenceIdx.current = null
    }

    panel.addEventListener('mouseover', showPin, { passive: true })
    panel.addEventListener('mouseleave', hidePin, { passive: true })
    return () => {
      panel.removeEventListener('mouseover', showPin)
      panel.removeEventListener('mouseleave', hidePin)
    }
  }, [pinnedSentences])

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

  // ── Cross-panel highlight — native events + pre-built maps ──
  const highlightedEls = useRef([])
  const lastHoveredWord = useRef(null)
  const rafId = useRef(0)

  // Pre-built word→elements maps per panel (avoids querySelectorAll on hover)
  const origWordIndex = useRef(new Map())  // Map<"word:sentenceIdx", Element[]>
  const transWordIndex = useRef(new Map())
  const origSentenceIndex = useRef(new Map()) // Map<sentenceIdx, Element>
  const transSentenceIndex = useRef(new Map())

  // Build indexes after DOM renders
  useEffect(() => {
    const buildIndex = (panelRef, wordIdx, sentIdx) => {
      wordIdx.current = new Map()
      sentIdx.current = new Map()
      const panel = panelRef.current
      if (!panel) return
      panel.querySelectorAll('.sentence-block').forEach((el) => {
        sentIdx.current.set(el.dataset.sentence, el)
      })
      panel.querySelectorAll('.hoverable-word').forEach((el) => {
        const w = el.dataset.word
        const s = el.closest('.sentence-block')?.dataset.sentence
        const key = s != null ? `${w}:${s}` : w
        let arr = wordIdx.current.get(key)
        if (!arr) { arr = []; wordIdx.current.set(key, arr) }
        arr.push(el)
      })
    }
    // Small timeout to ensure DOM is flushed
    const t = setTimeout(() => {
      buildIndex(originalPanelRef, origWordIndex, origSentenceIndex)
      buildIndex(translatedPanelRef, transWordIndex, transSentenceIndex)
    }, 50)
    return () => clearTimeout(t)
  }, [originalSentences, translatedSentences])

  const clearHighlights = () => {
    const els = highlightedEls.current
    for (let i = els.length - 1; i >= 0; i--) {
      els[i].classList.remove('word-cross-highlight', 'sentence-highlight')
    }
    highlightedEls.current = []
  }

  const mark = (el, cls) => {
    el.classList.add(cls)
    highlightedEls.current.push(el)
  }

  const lookupWords = (wordIdx, word, sentenceIdx) => {
    // Try exact key with sentence scope first
    if (sentenceIdx != null) {
      const els = wordIdx.current.get(`${word}:${sentenceIdx}`)
      if (els) return els
    }
    // Fallback: collect all sentences for this word
    const out = []
    for (const [k, v] of wordIdx.current) {
      if (k === word || k.startsWith(word + ':')) out.push(...v)
    }
    return out
  }

  // Attach native events (bypass React synthetic events)
  useEffect(() => {
    const origPanel = originalPanelRef.current
    const transPanel = translatedPanelRef.current
    if (!origPanel || !transPanel) return

    const handleHover = (e, isOriginal) => {
      const target = e.target
      // Fast exit: if target has no dataset it's a text node parent or panel
      if (!target.dataset) return
      // Only proceed if target IS a hoverable-word (avoid closest() traversal)
      const wordEl = target.classList?.contains('hoverable-word') ? target : null
      if (!wordEl || wordEl === lastHoveredWord.current) return
      lastHoveredWord.current = wordEl
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        clearHighlights()
        // Sentence highlight
        const sentEl = wordEl.parentElement  // sentence-block is direct parent
        const sentIdx = sentEl?.dataset?.sentence
        if (sentEl && sentIdx != null) {
          mark(sentEl, 'sentence-highlight')
          const otherSentMap = isOriginal ? transSentenceIndex : origSentenceIndex
          const otherSent = otherSentMap.current.get(sentIdx)
          if (otherSent) mark(otherSent, 'sentence-highlight')
        }
        // Word highlight — hovered word
        mark(wordEl, 'word-cross-highlight')
        const word = wordEl.dataset.word
        // Cross-panel word matching
        if (isOriginal) {
          const translated = word_map?.[word]
          if (translated) {
            const words = translated.split(/\s+/)
            for (const tw of words) {
              if (tw.length < 2) continue
              const els = lookupWords(transWordIndex, tw, sentIdx)
              for (const el of els) mark(el, 'word-cross-highlight')
            }
          }
        } else {
          const originals = reverseMap[word]
          if (originals) {
            for (const orig of originals) {
              const words = orig.split(/\s+/)
              for (const ow of words) {
                if (ow.length < 2) continue
                const els = lookupWords(origWordIndex, ow, sentIdx)
                for (const el of els) mark(el, 'word-cross-highlight')
              }
            }
          }
        }
      })
    }

    const handleLeave = () => {
      lastHoveredWord.current = null
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(clearHighlights)
    }

    const onOrigOver = (e) => handleHover(e, true)
    const onTransOver = (e) => handleHover(e, false)

    // Use mouseover — only fires on element boundary crossing, not every pixel
    origPanel.addEventListener('mouseover', onOrigOver, { passive: true })
    origPanel.addEventListener('mouseleave', handleLeave, { passive: true })
    transPanel.addEventListener('mouseover', onTransOver, { passive: true })
    transPanel.addEventListener('mouseleave', handleLeave, { passive: true })

    return () => {
      origPanel.removeEventListener('mouseover', onOrigOver)
      origPanel.removeEventListener('mouseleave', handleLeave)
      transPanel.removeEventListener('mouseover', onTransOver)
      transPanel.removeEventListener('mouseleave', handleLeave)
      cancelAnimationFrame(rafId.current)
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
