import { useState, useRef, useCallback, useMemo } from 'react'
import { translateWord } from '../api'

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

/** Render text as word-level <span> elements with data-word attributes. */
function WordRenderer({ text }) {
  const tokens = text.split(/(\s+)/)
  return tokens.map((token, i) => {
    if (/^\s+$/.test(token)) return token
    const normalized = token.replace(/[^\p{L}\p{N}'-]/gu, '').toLowerCase()
    // Pure punctuation tokens get no data-word — they won't trigger interactions
    if (!normalized) return <span key={i}>{token}</span>
    return (
      <span key={i} className="hoverable-word" data-word={normalized}>
        {token}
      </span>
    )
  })
}

function ResultView({ result, onBack }) {
  const {
    filename,
    target_lang,
    target_lang_code,
    original_text,
    translated_text,
    word_map,
  } = result

  const originalPanelRef = useRef(null)
  const translatedPanelRef = useRef(null)

  // ---------- Click-to-translate tooltip (original panel only) ----------
  const [tooltip, setTooltip] = useState(null)
  const [tooltipLoading, setTooltipLoading] = useState(false)

  const handleWordClick = useCallback(async (e) => {
    const wordEl = e.target.closest('.hoverable-word')
    if (!wordEl) return

    // Use the pre-normalized data-word attribute for the check
    const normalized = wordEl.dataset.word
    if (!normalized) return

    // Display the visible text (cleaned of surrounding punctuation)
    const displayWord = wordEl.textContent.replace(/[^\p{L}\p{N}'-]/gu, '').trim()
    if (!displayWord) return

    const containerRect = originalPanelRef.current.getBoundingClientRect()
    const rect = wordEl.getBoundingClientRect()
    const x = rect.left - containerRect.left + rect.width / 2
    const y = rect.top - containerRect.top

    setTooltip({ word: displayWord, translated: null, x, y })
    setTooltipLoading(true)

    try {
      const data = await translateWord(displayWord, target_lang_code)
      setTooltip({ word: displayWord, translated: data.translated, x, y })
    } catch {
      setTooltip({ word: displayWord, translated: '⚠ Translation failed', x, y })
    } finally {
      setTooltipLoading(false)
    }
  }, [target_lang_code])

  const closeTooltip = () => setTooltip(null)

  // ---------- Reverse map: translated_word → Set<original_words> ----------
  const reverseMap = useMemo(() => {
    const rm = {}
    if (!word_map) return rm
    for (const [orig, trans] of Object.entries(word_map)) {
      if (!rm[trans]) rm[trans] = new Set()
      rm[trans].add(orig)
    }
    return rm
  }, [word_map])

  // ---------- Cross-panel highlight helpers (DOM-based, no re-render) ----------
  const clearHighlights = useCallback(() => {
    originalPanelRef.current
      ?.querySelectorAll('.word-cross-highlight')
      .forEach((el) => el.classList.remove('word-cross-highlight'))
    translatedPanelRef.current
      ?.querySelectorAll('.word-cross-highlight')
      .forEach((el) => el.classList.remove('word-cross-highlight'))
  }, [])

  // Hover over a word in the ORIGINAL panel → highlight translation in TRANSLATED panel
  const handleOriginalHover = useCallback(
    (e) => {
      const wordEl = e.target.closest('.hoverable-word')
      if (!wordEl) return
      clearHighlights()

      const word = wordEl.dataset.word
      wordEl.classList.add('word-cross-highlight')

      const translated = word_map?.[word]
      if (translated && translatedPanelRef.current) {
        translatedPanelRef.current
          .querySelectorAll(`[data-word="${CSS.escape(translated)}"]`)
          .forEach((el) => el.classList.add('word-cross-highlight'))
      }
    },
    [word_map, clearHighlights],
  )

  // Hover over a word in the TRANSLATED panel → highlight original in ORIGINAL panel
  const handleTranslatedHover = useCallback(
    (e) => {
      const wordEl = e.target.closest('.hoverable-word')
      if (!wordEl) return
      clearHighlights()

      const word = wordEl.dataset.word
      wordEl.classList.add('word-cross-highlight')

      const originals = reverseMap[word]
      if (originals && originalPanelRef.current) {
        originals.forEach((orig) => {
          originalPanelRef.current
            .querySelectorAll(`[data-word="${CSS.escape(orig)}"]`)
            .forEach((el) => el.classList.add('word-cross-highlight'))
        })
      }
    },
    [reverseMap, clearHighlights],
  )

  return (
    <>
      <section className="result-header">
        <h1>Translation Result</h1>
        <p className="result-meta">
          <span><i className="fas fa-file-pdf"></i> {filename}</span>
          <span><i className="fas fa-arrow-right"></i></span>
          <span><i className="fas fa-globe"></i> {target_lang}</span>
        </p>
        <p className="result-hint">
          <i className="fas fa-mouse-pointer"></i> Hover any word to highlight its match &middot; Click a word in the original for detailed translation
        </p>
        <button className="btn btn-outline" onClick={onBack}>
          <i className="fas fa-arrow-left"></i> Translate Another
        </button>
      </section>

      <section className="translation-container">
        {/* ---- Original Panel ---- */}
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
            <WordRenderer text={original_text} />

            {tooltip && (
              <>
                <div className="word-tooltip-backdrop" onClick={closeTooltip} />
                <div
                  className="word-tooltip"
                  style={{ left: tooltip.x, top: tooltip.y }}
                >
                  <button className="word-tooltip-close" onClick={closeTooltip}>
                    <i className="fas fa-times"></i>
                  </button>
                  <div className="word-tooltip-original">{tooltip.word}</div>
                  <div className="word-tooltip-divider"></div>
                  {tooltipLoading ? (
                    <div className="word-tooltip-loading">
                      <span className="spinner-sm"></span>
                    </div>
                  ) : (
                    <div className="word-tooltip-translated">{tooltip.translated}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---- Translated Panel ---- */}
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
          >
            <WordRenderer text={translated_text} />
          </div>
        </div>
      </section>
    </>
  )
}

export default ResultView
