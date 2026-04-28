const API_BASE = '/api'

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchLanguages() {
  const res = await fetch(`${API_BASE}/languages`)
  if (!res.ok) throw new Error('Failed to fetch languages')
  return res.json()
}

export async function translatePdf(file, targetLang) {
  const formData = new FormData()
  formData.append('pdf_file', file)
  formData.append('target_lang', targetLang)

  const res = await fetch(`${API_BASE}/translate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.detail || 'Translation failed')
  }

  return data
}

export async function translateWord(word, targetLang, sourceLang = 'auto') {
  const formData = new FormData()
  formData.append('word', word)
  formData.append('target_lang', targetLang)
  formData.append('source_lang', sourceLang)

  const res = await fetch(`${API_BASE}/translate-word`, {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.detail || 'Word translation failed')
  }

  return data
}

// ── Auth ─────────────────────────────────────────────────────────────────
export async function registerUser(name, email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Registration failed')
  return data
}

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Login failed')
  return data
}

export async function googleLogin(credential) {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Google login failed')
  return data
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Not authenticated')
  return res.json()
}

// ── History ──────────────────────────────────────────────────────────────
export async function fetchHistory() {
  const res = await fetch(`${API_BASE}/history`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export async function fetchHistoryItem(id) {
  const res = await fetch(`${API_BASE}/history/${id}`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to fetch translation')
  return res.json()
}

export async function deleteHistoryItem(id) {
  const res = await fetch(`${API_BASE}/history/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete')
  return res.json()
}

export async function clearHistory() {
  const res = await fetch(`${API_BASE}/history`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error('Failed to clear history')
  return res.json()
}

// ── Anki Export ──────────────────────────────────────────────────────────
export async function exportAnki(vocab, deckName = 'PDF Translator Vocabulary') {
  const res = await fetch(`${API_BASE}/export-anki`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vocab, deck_name: deckName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Anki export failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${deckName}.apkg`
  a.click()
  URL.revokeObjectURL(url)
}
