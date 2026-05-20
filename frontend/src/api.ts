import type {
  AuthResponse,
  HistoryItem,
  LanguageMap,
  TranslationResult,
  User,
  VocabEntry,
  WordTranslation,
} from './types'

const API_BASE = '/api'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON body — serialized automatically with the right Content-Type. */
  json?: unknown
  /** Raw body (e.g. FormData) passed straight through. */
  body?: BodyInit
  /** Send the stored bearer token. Defaults to true. */
  auth?: boolean
  /** Fallback message thrown when the response carries no `detail`. */
  errorMessage?: string
}

/**
 * Thin fetch wrapper: attaches auth, serializes JSON, and turns non-2xx
 * responses into thrown Errors using the backend's `detail` when present.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, body, auth = true, errorMessage = 'Request failed', headers, ...rest } = options

  const finalHeaders: Record<string, string> = {
    ...(auth ? getAuthHeaders() : {}),
    ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(headers as Record<string, string> | undefined),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : body,
  })

  if (!res.ok) {
    let detail: string | undefined
    try {
      detail = ((await res.json()) as { detail?: string }).detail
    } catch {
      /* response has no JSON body */
    }
    throw new Error(detail || errorMessage)
  }

  return res.json() as Promise<T>
}

// ── Translation ────────────────────────────────────────────────────────────
export function fetchLanguages(): Promise<LanguageMap> {
  return request<LanguageMap>('/languages', { auth: false, errorMessage: 'Failed to fetch languages' })
}

export function translatePdf(file: File, targetLang: string): Promise<TranslationResult> {
  const formData = new FormData()
  formData.append('pdf_file', file)
  formData.append('target_lang', targetLang)
  return request<TranslationResult>('/translate', {
    method: 'POST',
    body: formData,
    errorMessage: 'Translation failed',
  })
}

export function translateWord(
  word: string,
  targetLang: string,
  sourceLang = 'auto',
): Promise<WordTranslation> {
  const formData = new FormData()
  formData.append('word', word)
  formData.append('target_lang', targetLang)
  formData.append('source_lang', sourceLang)
  return request<WordTranslation>('/translate-word', {
    method: 'POST',
    body: formData,
    auth: false,
    errorMessage: 'Word translation failed',
  })
}

// ── Auth ─────────────────────────────────────────────────────────────────
export function registerUser(name: string, email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    json: { name, email, password },
    auth: false,
    errorMessage: 'Registration failed',
  })
}

export function loginUser(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    json: { email, password },
    auth: false,
    errorMessage: 'Login failed',
  })
}

export function googleLogin(credential: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/google', {
    method: 'POST',
    json: { credential },
    auth: false,
    errorMessage: 'Google login failed',
  })
}

export function fetchMe(): Promise<User> {
  return request<User>('/auth/me', { errorMessage: 'Not authenticated' })
}

// ── History ──────────────────────────────────────────────────────────────
export function fetchHistory(): Promise<HistoryItem[]> {
  return request<HistoryItem[]>('/history', { errorMessage: 'Failed to fetch history' })
}

export function fetchHistoryItem(id: string): Promise<TranslationResult> {
  return request<TranslationResult>(`/history/${id}`, { errorMessage: 'Failed to fetch translation' })
}

export function deleteHistoryItem(id: string): Promise<{ ok?: boolean }> {
  return request(`/history/${id}`, { method: 'DELETE', errorMessage: 'Failed to delete' })
}

export function clearHistory(): Promise<{ ok?: boolean }> {
  return request('/history', { method: 'DELETE', errorMessage: 'Failed to clear history' })
}

// ── Anki Export ──────────────────────────────────────────────────────────
export async function exportAnki(
  vocab: VocabEntry[],
  deckName = 'PDF Translator Vocabulary',
): Promise<void> {
  const res = await fetch(`${API_BASE}/export-anki`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vocab, deck_name: deckName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || 'Anki export failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${deckName}.apkg`
  a.click()
  URL.revokeObjectURL(url)
}
