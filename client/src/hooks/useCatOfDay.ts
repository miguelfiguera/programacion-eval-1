import { useCallback, useState } from 'react'

import { fetchCatOfDay } from '@/lib/api/backend'
import type { CatOfDayDto } from '@/lib/api/dto'

/**
 * Hook for the "Cat of the day" feature.
 *
 * Calls GET /api/cats/daily which returns a random cat image (TheCatAPI)
 * combined with a fun cat fact (CatFact.ninja). The load() function can
 * be called on demand — it is not automatic on mount.
 */
export function useCatOfDay() {
  const [data, setData] = useState<CatOfDayDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Fetches a new random cat image + fact from the backend. */
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const payload = await fetchCatOfDay()
      setData(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  /** Clears the current cat data and any error. */
  const clear = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return { data, loading, error, load, clear }
}
