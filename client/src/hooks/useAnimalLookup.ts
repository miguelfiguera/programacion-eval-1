import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { fetchAnimalLookup } from '@/lib/api/backend'
import type { AnimalLookupResultDto } from '@/lib/api/dto'

/** Fases mostradas mientras el backend resuelve la búsqueda (orden alineado al pipeline del servidor). */
export const ANIMAL_LOOKUP_LOADING_PHASES = [
  'Paso 1/4 — Wikidata: buscando entidades por tu texto…',
  'Paso 2/4 — Wikidata: comprobando reino Animalia (solo animales confirmados)…',
  'Paso 3/4 — Obteniendo imagen y enlace (Commons o Wikipedia)…',
  'Paso 4/4 — Respaldo Wikipedia: más candidatos y validación Animalia…',
] as const

const PHASE_ADVANCE_MS = 2800

export type UseAnimalLookupOptions = {
  /** When set (e.g. from `?favorite=`), pre-fills the field and runs one lookup on load / when it changes. */
  favoriteFromUrl?: string
}

/**
 * Animal-favorito page: animal name input + fetch via Express (Wikipedia / TheCatAPI).
 */
export function useAnimalLookup(options?: UseAnimalLookupOptions) {
  const favoriteFromUrl = options?.favoriteFromUrl?.trim() ?? ''

  const [name, setName] = useState(() => favoriteFromUrl)
  const nameRef = useRef(name)
  nameRef.current = name

  const [loading, setLoading] = useState(false)
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnimalLookupResultDto | null>(null)

  useEffect(() => {
    if (!loading) {
      setLoadingPhaseIndex(0)
      return
    }
    setLoadingPhaseIndex(0)
    const id = setInterval(() => {
      setLoadingPhaseIndex((i) =>
        i < ANIMAL_LOOKUP_LOADING_PHASES.length - 1 ? i + 1 : i,
      )
    }, PHASE_ADVANCE_MS)
    return () => clearInterval(id)
  }, [loading])

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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  /** Clears search result and error (e.g. before showing “Gato del día”). */
  const clear = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return {
    name,
    setName,
    loading,
    loadingPhaseLabel: loading ? ANIMAL_LOOKUP_LOADING_PHASES[loadingPhaseIndex] : null,
    error,
    result,
    search,
    clear,
  }
}
