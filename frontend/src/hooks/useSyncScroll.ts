import { useEffect, useRef, type RefObject } from 'react'

/**
 * Keep two scrollable panels sentence-aligned. When the user scrolls one panel,
 * the matching `.sentence-block[data-sentence]` is brought to the same offset in
 * the other. A re-entrancy guard prevents the two scroll handlers from looping.
 */
export function useSyncScroll(
  sourceRef: RefObject<HTMLDivElement | null>,
  targetRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const isSyncing = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const a = sourceRef.current
    const b = targetRef.current
    if (!a || !b) return

    const syncFrom = (source: HTMLDivElement, target: HTMLDivElement) => () => {
      if (isSyncing.current) return
      isSyncing.current = true

      const sentences = source.querySelectorAll<HTMLElement>('.sentence-block[data-sentence]')
      const sourceTop = source.getBoundingClientRect().top
      let topIdx = 0
      let topOffset = 0

      for (const s of sentences) {
        const rect = s.getBoundingClientRect()
        if (rect.bottom > sourceTop) {
          topIdx = parseInt(s.dataset.sentence ?? '0', 10)
          const sentHeight = rect.height || 1
          topOffset = Math.max(0, (sourceTop - rect.top) / sentHeight)
          break
        }
      }

      const match = target.querySelector<HTMLElement>(`.sentence-block[data-sentence="${topIdx}"]`)
      if (match) {
        const targetPanelTop = target.getBoundingClientRect().top
        const matchRect = match.getBoundingClientRect()
        const currentOffset = matchRect.top - targetPanelTop + target.scrollTop
        target.scrollTop = currentOffset - target.clientTop + topOffset * matchRect.height
      }

      requestAnimationFrame(() => { isSyncing.current = false })
    }

    const onA = syncFrom(a, b)
    const onB = syncFrom(b, a)
    a.addEventListener('scroll', onA, { passive: true })
    b.addEventListener('scroll', onB, { passive: true })

    return () => {
      a.removeEventListener('scroll', onA)
      b.removeEventListener('scroll', onB)
    }
  }, [enabled, sourceRef, targetRef])
}
