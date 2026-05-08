import { useCallback, useEffect, useState } from 'react'

import { fetchRecentLogs } from '@/lib/api/backend'
import type { RequestLogRowDto } from '@/lib/api/dto'

/**
 * Hook for the API reference page — fetches the latest SQLite interaction
 * logs on mount and exposes a reload() function for manual refresh.
 */
export function useRecentLogs(limit = 40) {
  const [rows, setRows] = useState<RequestLogRowDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Fetches the latest `limit` log rows from GET /api/logs/recent. */
  const reload = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchRecentLogs(limit)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  // Fetch logs automatically on mount.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setError(null)
      setLoading(true)
      try {
        const data = await fetchRecentLogs(limit)
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [limit])

  return { rows, loading, error, reload }
}
