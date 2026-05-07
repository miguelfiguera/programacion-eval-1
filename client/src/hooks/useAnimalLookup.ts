import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { fetchAnimalLookup } from '@/lib/api/backend'
import type { AnimalLookupResultDto } from '@/lib/api/dto'

export type UseAnimalLookupOptions = {
  /** When set (e.g. from `?favorite=`), pre-fills the field and runs one lookup on load / when it changes. */
  favoriteFromUrl?: string
}

/**
 * Drives Exercise 1: animal name input + fetch via Express (Wikipedia / TheCatAPI).
 */
export function useAnimalLookup(options?: UseAnimalLookupOptions) {
  const favoriteFromUrl = options?.favoriteFromUrl?.trim() ?? ''

  const [name, setName] = useState(() => favoriteFromUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnimalLookupResultDto | null>(null)

  useEffect(() => {
    if (!favoriteFromUrl) return

    let cancelled = false
    void (async () => {
      setName(favoriteFromUrl)
      setLoading(true)
      setError(null)
      setResult(null)
      try {
        const data = await fetchAnimalLookup(favoriteFromUrl)
        if (!cancelled) setResult(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [favoriteFromUrl])

  const search = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      const q = name.trim()
      if (!q || loading) return
      setLoading(true)
      setError(null)
      setResult(null)
      try {
        const data = await fetchAnimalLookup(q)
        setResult(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [name, loading],
  )

  /** Clears search result and error (e.g. before showing “Gato del día”). */
  const clear = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return {
    name,
    setName,
    loading,
    error,
    result,
    search,
    clear,
  }
}
