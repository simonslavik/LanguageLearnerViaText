const API_BASE = '/api'

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
    body: formData,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.detail || data.error || 'Translation failed')
  }

  return data
}

export async function translateWord(word, targetLang) {
  const formData = new FormData()
  formData.append('word', word)
  formData.append('target_lang', targetLang)

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
