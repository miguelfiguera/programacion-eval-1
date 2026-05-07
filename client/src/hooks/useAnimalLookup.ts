import { useCallback, useState, type FormEvent } from 'react'

import { fetchAnimalLookup } from '@/lib/api/backend'
import type { AnimalLookupResultDto } from '@/lib/api/dto'

/**
 * Drives the animal lookup demo: name input + one shot fetch through our Express API.
 */
export function useAnimalLookup() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnimalLookupResultDto | null>(null)

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
