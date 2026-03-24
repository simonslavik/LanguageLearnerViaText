import { useState, useCallback, useMemo, useEffect, useRef } from 'react'

// ─── Leitner spaced-repetition helpers ──────────────────────────────────
// Box 1 → review daily  (interval: 0 — always due)
// Box 2 → review every 2 days
// Box 3 → review every 4 days
// Box 4 → review every 8 days
// Box 5 → review every 16 days  (mastered)

const LEITNER_INTERVALS = [0, 0, 2, 4, 8, 16] // index = box number
const MAX_BOX = 5
const SRS_KEY = 'translator_srs_data'

function loadSrs() {
  try {
    return JSON.parse(localStorage.getItem(SRS_KEY)) || {}
  } catch {
    return {}
  }
}

function saveSrs(data) {
  localStorage.setItem(SRS_KEY, JSON.stringify(data))
}

function daysSince(timestamp) {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
}

function getCardKey(entry) {
  return `${entry.word}::${entry.translated}`
}

function isDue(srsEntry) {
  if (!srsEntry) return true
  const interval = LEITNER_INTERVALS[srsEntry.box] || 0
  return daysSince(srsEntry.lastReview) >= interval
}

// ─── Quiz modes ─────────────────────────────────────────────────────────
const MODES = {
  FLASHCARD: 'flashcard',
  MULTIPLE_CHOICE: 'multiple_choice',
  TYPING: 'typing',
}

const MODE_LABELS = {
  [MODES.FLASHCARD]: 'Flashcards',
  [MODES.MULTIPLE_CHOICE]: 'Multiple Choice',
  [MODES.TYPING]: 'Type Answer',
}

const MODE_ICONS = {
  [MODES.FLASHCARD]: 'fas fa-clone',
  [MODES.MULTIPLE_CHOICE]: 'fas fa-list-ol',
  [MODES.TYPING]: 'fas fa-keyboard',
}

// ═══════════════════════════════════════════════════════════════════════════
// FlashcardQuiz
// ═══════════════════════════════════════════════════════════════════════════

function FlashcardQuiz({ vocab, onClose }) {
  const [srsData, setSrsData] = useState(loadSrs)
  const [mode, setMode] = useState(MODES.FLASHCARD)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 })
  const [sessionDone, setSessionDone] = useState(false)
  const [practiceAll, setPracticeAll] = useState(false)
  const [direction, setDirection] = useState('wordToTranslation') // or 'translationToWord'

  // Multiple choice state
  const [mcSelected, setMcSelected] = useState(null)

  // Typing state
  const [typedAnswer, setTypedAnswer] = useState('')
  const [typingResult, setTypingResult] = useState(null) // null | 'correct' | 'incorrect'

  // Persist SRS data
  useEffect(() => { saveSrs(srsData) }, [srsData])

  // ── Build the session queue: only due cards (or all if practiceAll) ──
  const dueCards = useMemo(() => {
    if (practiceAll) return [...vocab]
    return vocab.filter((entry) => {
      const key = getCardKey(entry)
      return isDue(srsData[key])
    })
  }, [vocab, srsData, practiceAll])

  // ── Current card ──
  const card = dueCards[currentIndex] || null

  const getPrompt = useCallback((c) => {
    if (!c) return ''
    return direction === 'wordToTranslation' ? c.word : c.translated
  }, [direction])

  const getAnswer = useCallback((c) => {
    if (!c) return ''
    return direction === 'wordToTranslation' ? c.translated : c.word
  }, [direction])

  // ── Generate MC options (derived — recomputed per card) ──
  const mcOptionsForCard = useMemo(() => {
    if (!card) return []
    const correctAnswer = getAnswer(card)
    const distractors = vocab
      .filter((v) => getAnswer(v) !== correctAnswer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((v) => getAnswer(v))
    return [correctAnswer, ...distractors].sort(() => Math.random() - 0.5)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, card, vocab, getAnswer])

  // When the card changes, reset interactive state
  const prevIndexRef = useRef(currentIndex)
  if (prevIndexRef.current !== currentIndex) {
    prevIndexRef.current = currentIndex
    // These are safe synchronous resets before render
    if (typedAnswer !== '') setTypedAnswer('')
    if (typingResult !== null) setTypingResult(null)
    if (flipped) setFlipped(false)
    if (mcSelected !== null) setMcSelected(null)
  }

  // ── SRS promotion / demotion ──
  const recordAnswer = useCallback((isCorrect) => {
    if (!card) return
    const key = getCardKey(card)
    setSrsData((prev) => {
      const current = prev[key] || { box: 1, lastReview: Date.now() }
      const newBox = isCorrect
        ? Math.min(current.box + 1, MAX_BOX)
        : 1 // wrong → back to box 1
      return {
        ...prev,
        [key]: { box: newBox, lastReview: Date.now() },
      }
    })
    setSessionStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (isCorrect ? 0 : 1),
    }))
  }, [card])

  const advance = useCallback(() => {
    if (currentIndex + 1 >= dueCards.length) {
      setSessionDone(true)
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }, [currentIndex, dueCards.length])

  // ── Flashcard handlers ──
  const handleFlip = () => setFlipped((v) => !v)

  const handleKnew = () => {
    recordAnswer(true)
    advance()
  }

  const handleDidntKnow = () => {
    recordAnswer(false)
    advance()
  }

  // ── MC handlers ──
  const handleMcSelect = (option) => {
    if (mcSelected !== null) return // already answered
    setMcSelected(option)
    const correct = option === getAnswer(card)
    recordAnswer(correct)
    setTimeout(() => advance(), correct ? 800 : 1500)
  }

  // ── Typing handlers ──
  const handleTypingSubmit = (e) => {
    e.preventDefault()
    if (typingResult !== null) return
    const correct =
      typedAnswer.trim().toLowerCase() === getAnswer(card).toLowerCase()
    setTypingResult(correct ? 'correct' : 'incorrect')
    recordAnswer(correct)
  }

  const handleTypingNext = () => advance()

  // ── Restart ──
  const handleRestart = (forceAll = false) => {
    if (forceAll) setPracticeAll(true)
    setCurrentIndex(0)
    setSessionStats({ correct: 0, incorrect: 0 })
    setSessionDone(false)
    setFlipped(false)
    setMcSelected(null)
    setTypedAnswer('')
    setTypingResult(null)
  }

  // ── Box stats ──
  const boxCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unstarted: 0 }
    vocab.forEach((entry) => {
      const key = getCardKey(entry)
      const srs = srsData[key]
      if (!srs) counts.unstarted++
      else counts[srs.box] = (counts[srs.box] || 0) + 1
    })
    return counts
  }, [vocab, srsData])

  // ═════════════════════════════════════════════════════════════════════
  // NO CARDS
  // ═════════════════════════════════════════════════════════════════════
  if (vocab.length === 0) {
    return (
      <section className="flashcard-drawer">
        <div className="flashcard-header">
          <h2><i className="fas fa-brain"></i> Flashcard Quiz</h2>
          <button className="btn-sm" onClick={onClose} title="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="flashcard-empty">
          <i className="fas fa-inbox"></i>
          <p>No vocabulary saved yet.</p>
          <p className="text-muted">Save words from the text to start practising.</p>
        </div>
      </section>
    )
  }

  // ═════════════════════════════════════════════════════════════════════
  // SESSION COMPLETE
  // ═════════════════════════════════════════════════════════════════════
  if (sessionDone || dueCards.length === 0) {
    const total = sessionStats.correct + sessionStats.incorrect
    const pct = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0

    return (
      <section className="flashcard-drawer">
        <div className="flashcard-header">
          <h2><i className="fas fa-brain"></i> Flashcard Quiz</h2>
          <button className="btn-sm" onClick={onClose} title="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="flashcard-summary">
          {total === 0 ? (
            <>
              <div className="summary-icon"><i className="fas fa-check-circle"></i></div>
              <h3>All caught up!</h3>
              <p>No cards are due for review right now. Come back later!</p>
            </>
          ) : (
            <>
              <div className="summary-icon">
                <i className={`fas ${pct >= 70 ? 'fa-trophy' : 'fa-chart-bar'}`}></i>
              </div>
              <h3>Session Complete!</h3>
              <div className="summary-stats">
                <div className="stat-item stat-correct">
                  <span className="stat-number">{sessionStats.correct}</span>
                  <span className="stat-label">Correct</span>
                </div>
                <div className="stat-item stat-incorrect">
                  <span className="stat-number">{sessionStats.incorrect}</span>
                  <span className="stat-label">Incorrect</span>
                </div>
                <div className="stat-item stat-pct">
                  <span className="stat-number">{pct}%</span>
                  <span className="stat-label">Accuracy</span>
                </div>
              </div>
            </>
          )}

          {/* Box distribution */}
          <div className="leitner-boxes">
            <h4>Leitner Box Distribution</h4>
            <div className="box-grid">
              {[1, 2, 3, 4, 5].map((box) => (
                <div key={box} className={`box-cell box-${box}`}>
                  <div className="box-count">{boxCounts[box]}</div>
                  <div className="box-label">Box {box}</div>
                  <div className="box-interval">
                    {LEITNER_INTERVALS[box] === 0 ? 'Daily' : `${LEITNER_INTERVALS[box]}d`}
                  </div>
                </div>
              ))}
            </div>
            {boxCounts.unstarted > 0 && (
              <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
                + {boxCounts.unstarted} new word{boxCounts.unstarted !== 1 ? 's' : ''} not yet reviewed
              </p>
            )}
          </div>

          <div className="summary-actions">
            <button className="btn btn-primary" onClick={() => handleRestart(true)}>
              <i className="fas fa-redo"></i> Practice Again
            </button>
            <button className="btn btn-outline" onClick={onClose}>
              <i className="fas fa-times"></i> Close
            </button>
          </div>
        </div>
      </section>
    )
  }

  // ═════════════════════════════════════════════════════════════════════
  // ACTIVE SESSION
  // ═════════════════════════════════════════════════════════════════════
  const cardBox = srsData[getCardKey(card)]?.box || 1
  const progress = `${currentIndex + 1} / ${dueCards.length}`

  return (
    <section className="flashcard-drawer">
      {/* Header */}
      <div className="flashcard-header">
        <h2><i className="fas fa-brain"></i> Flashcard Quiz</h2>
        <div className="flashcard-header-actions">
          <span className="flashcard-progress">{progress}</span>
          <button className="btn-sm" onClick={onClose} title="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      {/* Settings bar */}
      <div className="flashcard-settings">
        <div className="mode-selector">
          {Object.entries(MODES).map(([, value]) => (
            <button
              key={value}
              className={`mode-btn ${mode === value ? 'active' : ''}`}
              onClick={() => { setMode(value); setPracticeAll(false); handleRestart() }}
              title={MODE_LABELS[value]}
            >
              <i className={MODE_ICONS[value]}></i>
              <span className="mode-btn-label">{MODE_LABELS[value]}</span>
            </button>
          ))}
        </div>
        <button
          className="btn-sm direction-btn"
          onClick={() => setDirection((d) => d === 'wordToTranslation' ? 'translationToWord' : 'wordToTranslation')}
          title="Swap quiz direction"
        >
          <i className="fas fa-exchange-alt"></i>
          {direction === 'wordToTranslation' ? 'Word → Trans' : 'Trans → Word'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="flashcard-progress-bar">
        <div
          className="flashcard-progress-fill"
          style={{ width: `${((currentIndex) / dueCards.length) * 100}%` }}
        />
      </div>

      {/* Card area */}
      <div className="flashcard-body">
        {/* Box indicator */}
        <div className="card-box-indicator">
          <span className={`box-badge box-${cardBox}`}>Box {cardBox}</span>
          {card.targetLang && (
            <span className="card-lang">{card.targetLang}</span>
          )}
        </div>

        {/* ──── FLASHCARD MODE ──── */}
        {mode === MODES.FLASHCARD && (
          <div className="flashcard-card-wrapper">
            <div
              className={`flashcard-card ${flipped ? 'flipped' : ''}`}
              onClick={handleFlip}
            >
              <div className="flashcard-face flashcard-front">
                <span className="flashcard-label">
                  {direction === 'wordToTranslation' ? 'Original' : 'Translation'}
                </span>
                <span className="flashcard-word">{getPrompt(card)}</span>
                <span className="flashcard-hint">Click to reveal</span>
              </div>
              <div className="flashcard-face flashcard-back">
                <span className="flashcard-label">
                  {direction === 'wordToTranslation' ? 'Translation' : 'Original'}
                </span>
                <span className="flashcard-word">{getAnswer(card)}</span>
              </div>
            </div>

            {flipped && (
              <div className="flashcard-actions">
                <button className="btn quiz-btn-incorrect" onClick={handleDidntKnow}>
                  <i className="fas fa-times"></i> Didn&apos;t Know
                </button>
                <button className="btn quiz-btn-correct" onClick={handleKnew}>
                  <i className="fas fa-check"></i> Knew It
                </button>
              </div>
            )}
          </div>
        )}

        {/* ──── MULTIPLE CHOICE MODE ──── */}
        {mode === MODES.MULTIPLE_CHOICE && (
          <div className="mc-wrapper">
            <div className="mc-prompt">
              <span className="flashcard-label">
                {direction === 'wordToTranslation' ? 'Original' : 'Translation'}
              </span>
              <span className="flashcard-word">{getPrompt(card)}</span>
            </div>
            <div className="mc-options">
              {mcOptionsForCard.map((option, i) => {
                const isCorrect = option === getAnswer(card)
                const isSelected = mcSelected === option
                let cls = 'mc-option'
                if (mcSelected !== null) {
                  if (isCorrect) cls += ' mc-correct'
                  else if (isSelected && !isCorrect) cls += ' mc-incorrect'
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => handleMcSelect(option)}
                    disabled={mcSelected !== null}
                  >
                    <span className="mc-option-letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ──── TYPING MODE ──── */}
        {mode === MODES.TYPING && (
          <div className="typing-wrapper">
            <div className="mc-prompt">
              <span className="flashcard-label">
                {direction === 'wordToTranslation' ? 'Original' : 'Translation'}
              </span>
              <span className="flashcard-word">{getPrompt(card)}</span>
            </div>
            <form className="typing-form" onSubmit={handleTypingSubmit}>
              <input
                type="text"
                className={`typing-input ${typingResult || ''}`}
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                placeholder="Type the translation…"
                autoFocus
                disabled={typingResult !== null}
              />
              {typingResult === null ? (
                <button type="submit" className="btn btn-primary" disabled={!typedAnswer.trim()}>
                  <i className="fas fa-check"></i> Check
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={handleTypingNext}>
                  <i className="fas fa-arrow-right"></i> Next
                </button>
              )}
            </form>
            {typingResult === 'incorrect' && (
              <div className="typing-correction">
                <span>Correct answer: </span>
                <strong>{getAnswer(card)}</strong>
              </div>
            )}
            {typingResult === 'correct' && (
              <div className="typing-correct-msg">
                <i className="fas fa-check-circle"></i> Correct!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session mini-stats */}
      <div className="flashcard-footer">
        <span className="mini-stat correct">
          <i className="fas fa-check"></i> {sessionStats.correct}
        </span>
        <span className="mini-stat incorrect">
          <i className="fas fa-times"></i> {sessionStats.incorrect}
        </span>
        <span className="mini-stat due">
          <i className="fas fa-clock"></i> {dueCards.length - currentIndex - 1} remaining
        </span>
      </div>
    </section>
  )
}

export default FlashcardQuiz
