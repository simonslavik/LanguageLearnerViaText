// ─── Shared domain types ────────────────────────────────────────────────────

export interface User {
  id?: string
  name: string
  email: string
}

export interface AuthResponse {
  token: string
  user: User
}

/** CEFR difficulty estimate for a body of text. */
export interface CefrInfo {
  level: string
  score: number
  rare_pct: number
}

/** A single original/translated sentence pair. */
export interface SentencePair {
  original: string
  translated: string
}

/** Frequency tier CSS-class keyed by normalized word. */
export type FreqTiers = Record<string, string>

/** The full translation payload returned by POST /api/translate. */
export interface TranslationResult {
  target_lang: string
  target_lang_code: string
  source_lang_code?: string
  original_text: string
  translated_text: string
  word_map?: Record<string, string>
  word_freq_tiers?: FreqTiers
  translated_word_freq_tiers?: FreqTiers
  original_cefr?: CefrInfo | null
  translated_cefr?: CefrInfo | null
  sentence_pairs?: SentencePair[]
}

export interface WordTranslation {
  word: string
  translated: string
  target_lang?: string
}

export interface HistoryItem {
  id: string
  filename: string
  target_lang: string
  created_at: string
}

/** A word saved to the vocabulary notebook. */
export interface VocabEntry {
  word: string
  translated: string
  targetLang: string
  added: number
}

/** Map of language code → display name. */
export type LanguageMap = Record<string, string>
