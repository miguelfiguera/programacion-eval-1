import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { fetchAnimalLookup } from '@/lib/api/backend'
import type { AnimalLookupResultDto } from '@/lib/api/dto'

const CAT_API_URL = 'https://api.thecatapi.com/v1/images/search?limit=1'
const FALLBACK_ERROR_MSG = 'Error; pero aqui tienes un gatito.'

async function clientSideCatFallback(displayName: string): Promise<AnimalLookupResultDto> {
  let imageUrl = ''
  try {
    const res = await fetch(CAT_API_URL)
    if (res.ok) {
      const data = (await res.json()) as Array<{ url?: string }>
      imageUrl = data[0]?.url ?? ''
    }
  } catch {
    // cat API also failed
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
  favoriteFromUrl?: string
}

export function useAnimalLookup(options?: UseAnimalLookupOptions) {
  const favoriteFromUrl = options?.favoriteFromUrl?.trim() ?? ''

  const [name, setName] = useState(() => favoriteFromUrl)
  const nameRef = useRef(name)
  nameRef.current = name

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
