import { useCallback, useState } from 'react'

import { fetchCatOfDay } from '@/lib/api/backend'
import type { CatOfDayDto } from '@/lib/api/dto'

/**
 * Loads “Gato del día”: image via backend (TheCatAPI) and text via CatFact.ninja.
 */
export function useCatOfDay() {
  const [data, setData] = useState<CatOfDayDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const clear = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return { data, loading, error, load, clear }
}
