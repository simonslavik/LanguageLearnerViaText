import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePinnedSentences } from '../usePinnedSentences'

beforeEach(() => {
  sessionStorage.clear()
})

describe('usePinnedSentences', () => {
  it('toggles a sentence on and off', () => {
    const { result } = renderHook(() => usePinnedSentences())
    expect(result.current.pinnedSentences.has(3)).toBe(false)

    act(() => result.current.togglePin(3))
    expect(result.current.pinnedSentences.has(3)).toBe(true)

    act(() => result.current.togglePin(3))
    expect(result.current.pinnedSentences.has(3)).toBe(false)
  })

  it('persists pins to sessionStorage', () => {
    const { result } = renderHook(() => usePinnedSentences())
    act(() => result.current.togglePin(1))
    act(() => result.current.togglePin(5))
    expect(JSON.parse(sessionStorage.getItem('translator_pinned_sentences') || '[]').sort()).toEqual([1, 5])
  })

  it('hydrates initial state from sessionStorage', () => {
    sessionStorage.setItem('translator_pinned_sentences', JSON.stringify([7, 9]))
    const { result } = renderHook(() => usePinnedSentences())
    expect(result.current.pinnedSentences.has(7)).toBe(true)
    expect(result.current.pinnedSentences.has(9)).toBe(true)
  })
})
