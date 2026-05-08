import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { fetchAnimalLookup } from '@/lib/api/backend'
import type { AnimalLookupResultDto } from '@/lib/api/dto'

const CAT_API_URL = 'https://api.thecatapi.com/v1/images/search?limit=1'
const FALLBACK_ERROR_MSG = 'Error; pero aqui tienes un gatito.'

/**
 * Client-side fallback: fetches a random cat directly from TheCatAPI
 * when the backend is unreachable. Returns an AnimalLookupResultDto
 * with the fallback message so the UI can render it normally.
 */
async function clientSideCatFallback(displayName: string): Promise<AnimalLookupResultDto> {
  let imageUrl = ''
  try {
    const res = await fetch(CAT_API_URL)
    if (res.ok) {
      const data = (await res.json()) as Array<{ url?: string }>
      imageUrl = data[0]?.url ?? ''
    }
  } catch {
    // TheCatAPI also unreachable — show message without image
  }
  return {
    displayName,
    imageUrl,
    usedFallback: true,
    message: FALLBACK_ERROR_MSG,
    sourceUrl: null,
    photographer: null,
  }
}

export type UseAnimalLookupOptions = {
  /** Pre-fills the input and triggers a lookup on mount (e.g. from `?favorite=`). */
  favoriteFromUrl?: string
}

/**
 * Hook for the animal-favorito page.
 *
 * - Sends the animal name to the Express backend which queries Pexels.
 * - If the backend fails (network error, server down), falls back to a
 *   client-side cat image via TheCatAPI.
 * - When `favoriteFromUrl` is set, runs one automatic lookup on mount.
 */
export function useAnimalLookup(options?: UseAnimalLookupOptions) {
  const favoriteFromUrl = options?.favoriteFromUrl?.trim() ?? ''

  const [name, setName] = useState(() => favoriteFromUrl)
  const nameRef = useRef(name)
  nameRef.current = name

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnimalLookupResultDto | null>(null)

  // Auto-search when the URL provides a `?favorite=` value.
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
      } catch {
        if (!cancelled) {
          const fallback = await clientSideCatFallback(favoriteFromUrl)
          if (!cancelled) setResult(fallback)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [favoriteFromUrl])

  /** Submits the current name to the backend for lookup. */
  const search = useCallback(async (e?: FormEvent) => {
    e?.preventDefault()
    const q = nameRef.current.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await fetchAnimalLookup(q)
      setResult(data)
    } catch {
      const fallback = await clientSideCatFallback(q)
      setResult(fallback)
    } finally {
      setLoading(false)
    }
  }, [])

  /** Resets result and error state (e.g. before switching to "Cat of the day"). */
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
