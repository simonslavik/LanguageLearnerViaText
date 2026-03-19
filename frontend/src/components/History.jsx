import { useState, useEffect } from 'react'
import { fetchHistory, fetchHistoryItem, deleteHistoryItem, clearHistory } from '../api'

function History({ onViewResult, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await fetchHistory()
      setItems(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadHistory() }, [])

  const handleView = async (id) => {
    try {
      const data = await fetchHistoryItem(id)
      onViewResult(data)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteHistoryItem(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleClear = async () => {
    if (!window.confirm('Delete all translation history?')) return
    try {
      await clearHistory()
      setItems([])
    } catch (err) {
      setError(err.message)
    }
  }

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <section className="history-section">
      <div className="history-header">
        <h2><i className="fas fa-history"></i> Translation History</h2>
        <div className="history-actions">
          {items.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={handleClear}>
              <i className="fas fa-trash"></i> Clear All
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            <i className="fas fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      {error && (
        <div className="flash flash-error">
          <span>{error}</span>
          <button className="flash-close" onClick={() => setError('')}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {loading ? (
        <div className="history-loading">
          <span className="spinner"></span> Loading history…
        </div>
      ) : items.length === 0 ? (
        <div className="history-empty">
          <i className="fas fa-inbox"></i>
          <p>No translations yet</p>
          <p className="text-muted">Your translated documents will appear here</p>
        </div>
      ) : (
        <div className="history-list">
          {items.map((item) => (
            <div key={item.id} className="history-card">
              <div className="history-card-info">
                <div className="history-card-title">
                  <i className="fas fa-file-pdf"></i>
                  <span>{item.filename}</span>
                </div>
                <div className="history-card-meta">
                  <span><i className="fas fa-globe"></i> {item.target_lang}</span>
                  <span><i className="fas fa-clock"></i> {formatDate(item.created_at)}</span>
                </div>
              </div>
              <div className="history-card-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleView(item.id)}
                >
                  <i className="fas fa-eye"></i> View
                </button>
                <button
                  className="btn btn-outline btn-sm btn-danger"
                  onClick={() => handleDelete(item.id)}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default History
