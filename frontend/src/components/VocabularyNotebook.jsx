import { useState } from 'react'

function VocabularyNotebook({ vocab, onRemove, onClear, onClose }) {
  const [filter, setFilter] = useState('')

  const filtered = filter
    ? vocab.filter(
        (v) =>
          v.word.toLowerCase().includes(filter.toLowerCase()) ||
          v.translated.toLowerCase().includes(filter.toLowerCase()),
      )
    : vocab

  const exportCsv = () => {
    const header = 'Original,Translation,Language,Date Added'
    const rows = vocab.map(
      (v) =>
        `"${v.word}","${v.translated}","${v.targetLang}","${new Date(v.added).toLocaleDateString()}"`,
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vocabulary.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="notebook-drawer">
      <div className="notebook-header">
        <h2><i className="fas fa-book"></i> Vocabulary Notebook</h2>
        <div className="notebook-actions">
          {vocab.length > 0 && (
            <>
              <button className="btn-sm" onClick={exportCsv} title="Export as CSV">
                <i className="fas fa-download"></i> Export
              </button>
              <button className="btn-sm btn-danger" onClick={onClear} title="Clear all">
                <i className="fas fa-trash"></i> Clear
              </button>
            </>
          )}
          <button className="btn-sm" onClick={onClose} title="Close notebook">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      {vocab.length === 0 ? (
        <div className="notebook-empty">
          <i className="fas fa-inbox"></i>
          <p>No words saved yet.</p>
          <p className="text-muted">Click any word in the text and press <strong>Save</strong> to add it here.</p>
        </div>
      ) : (
        <>
          <div className="notebook-search">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search saved words…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <div className="notebook-list">
            <div className="notebook-list-header">
              <span>Original</span>
              <span>Translation</span>
              <span>Language</span>
              <span></span>
            </div>
            {filtered.map((entry, i) => {
              // find actual index in original vocab for correct removal
              const realIndex = vocab.indexOf(entry)
              return (
                <div key={realIndex} className="notebook-item">
                  <span className="nb-word">{entry.word}</span>
                  <span className="nb-translated">{entry.translated}</span>
                  <span className="nb-lang">{entry.targetLang}</span>
                  <button
                    className="nb-remove"
                    onClick={() => onRemove(realIndex)}
                    title="Remove"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              )
            })}
          </div>

          <div className="notebook-footer">
            {filtered.length} of {vocab.length} word{vocab.length !== 1 ? 's' : ''}
          </div>
        </>
      )}
    </section>
  )
}

export default VocabularyNotebook
