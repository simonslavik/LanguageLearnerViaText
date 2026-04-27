import { useState, useEffect, useRef } from 'react'
import { fetchLanguages, translatePdf } from '../api'

function UploadForm({ onResult }) {
  const [languages, setLanguages] = useState({})
  const [file, setFile] = useState(null)
  const [targetLang, setTargetLang] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchLanguages()
      .then(setLanguages)
      .catch(() => setError('Failed to load languages.'))
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped)
      setError('')
    } else {
      setError('Only PDF files are allowed.')
    }
  }

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      setError('')
    }
  }

  const removeFile = (e) => {
    e.stopPropagation()
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !targetLang) {
      setError('Please select a PDF and a target language.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await translatePdf(file, targetLang)
      onResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Full-screen translation overlay */}
      {loading && (
        <div className="translate-overlay">
          <div className="translate-overlay-card">
            <div className="translate-spinner"></div>
            <h2>Translating your PDF…</h2>
            <p>This may take a moment depending on the file size.</p>
            <div className="translate-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="hero">
        <h1>Translate Your PDF Documents</h1>
        <p className="hero-subtitle">
          Upload a PDF file, pick a target language, and get an instant side-by-side translation.
        </p>
      </section>

      {/* Error */}
      {error && (
        <div className="flash flash-error">
          <span>{error}</span>
          <button className="flash-close" onClick={() => setError('')}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Upload Form */}
      <section className="upload-section">
        <form className="upload-form" onSubmit={handleSubmit}>
          {/* Drop Zone */}
          <div
            className={`drop-zone ${dragOver ? 'dragover' : ''}`}
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="fas fa-cloud-upload-alt drop-icon"></i>
            <p className="drop-text">Drag & drop your PDF here</p>
            <p className="drop-subtext">or click to browse</p>
            <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="file-input"
            />
            {file && (
              <div className="file-info">
                <i className="fas fa-file-pdf"></i>
                <span>{file.name}</span>
                <button type="button" className="remove-file" onClick={removeFile}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </div>

          {/* Language Select */}
          <div className="form-group">
            <label htmlFor="targetLang">
              <i className="fas fa-globe"></i> Target Language
            </label>
            <select
              id="targetLang"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              required
            >
              <option value="" disabled>Select language…</option>
              {Object.entries(languages).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <i className="fas fa-language"></i> Translate
          </button>
        </form>
      </section>

      {/* How It Works */}
      <section className="features">
        <h2>How It Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-upload"></i></div>
            <h3>1. Upload</h3>
            <p>Select or drag-and-drop a text-based PDF document.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-cogs"></i></div>
            <h3>2. Choose Language</h3>
            <p>Pick your desired target language from the dropdown.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-check-circle"></i></div>
            <h3>3. View Translation</h3>
            <p>See the original and translated text side by side.</p>
          </div>
        </div>
      </section>
    </>
  )
}

export default UploadForm
