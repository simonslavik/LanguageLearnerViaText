import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchHistory, fetchHistoryItem, deleteHistoryItem, clearHistory } from '../api'
import type { TranslationResult } from '../types'

interface HistoryProps {
  onViewResult: (data: TranslationResult) => void
  onClose: () => void
}

function formatDate(dateStr: string): string {
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

function History({ onViewResult, onClose }: HistoryProps) {
  const queryClient = useQueryClient()

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['history'],
    queryFn: fetchHistory,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteHistoryItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['history'] }),
  })

  const clearMutation = useMutation({
    mutationFn: clearHistory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['history'] }),
  })

  const viewMutation = useMutation({
    mutationFn: fetchHistoryItem,
    onSuccess: (data) => onViewResult(data),
  })

  const handleClear = () => {
    if (!window.confirm('Delete all translation history?')) return
    clearMutation.mutate()
  }

  const errorMessage =
    (error instanceof Error && error.message) ||
    (deleteMutation.error instanceof Error && deleteMutation.error.message) ||
    (clearMutation.error instanceof Error && clearMutation.error.message) ||
    (viewMutation.error instanceof Error && viewMutation.error.message) ||
    ''

  return (
    <section className="history-section">
      <div className="history-header">
        <h2><i className="fas fa-history"></i> Translation History</h2>
        <div className="history-actions">
          {items.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={handleClear} disabled={clearMutation.isPending}>
              <i className="fas fa-trash"></i> Clear All
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            <i className="fas fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flash flash-error">
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
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
                  onClick={() => viewMutation.mutate(item.id)}
                  disabled={viewMutation.isPending}
                >
                  <i className="fas fa-eye"></i> View
                </button>
                <button
                  className="btn btn-outline btn-sm btn-danger"
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
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
