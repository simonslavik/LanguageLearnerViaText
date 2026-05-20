import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translatePdf, translateWord, fetchLanguages } from '../api'

// Mock the global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  localStorage.clear()
})

describe('fetchLanguages', () => {
  it('returns language map on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ en: 'English', fr: 'French' }),
    })
    const langs = await fetchLanguages()
    expect(langs).toEqual({ en: 'English', fr: 'French' })
  })

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    await expect(fetchLanguages()).rejects.toThrow('Failed to fetch languages')
  })
})

describe('translatePdf', () => {
  it('returns translation data on success', async () => {
    const payload = { original_text: 'Hello', translated_text: 'Hola' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => payload,
    })
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })
    const result = await translatePdf(file, 'es')
    expect(result).toEqual(payload)
  })

  it('throws with detail message on 4xx', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'File too large.' }),
    })
    const file = new File(['x'], 'test.pdf', { type: 'application/pdf' })
    await expect(translatePdf(file, 'es')).rejects.toThrow('File too large.')
  })

  it('falls back to generic message when no detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })
    const file = new File(['x'], 'test.pdf', { type: 'application/pdf' })
    await expect(translatePdf(file, 'es')).rejects.toThrow('Translation failed')
  })

  it('includes Authorization header when token stored', async () => {
    localStorage.setItem('token', 'mytoken')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    const file = new File(['x'], 'test.pdf', { type: 'application/pdf' })
    await translatePdf(file, 'es')
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers).toEqual({ Authorization: 'Bearer mytoken' })
  })
})

describe('translateWord', () => {
  it('returns translated word on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ word: 'hello', translated: 'hola', target_lang: 'Spanish' }),
    })
    const result = await translateWord('hello', 'es')
    expect(result.translated).toBe('hola')
  })

  it('throws on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Word translation failed.' }),
    })
    await expect(translateWord('hello', 'es')).rejects.toThrow()
  })
})
