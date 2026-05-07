import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { fetchMovieDiscover, fetchMovieTaxonomy } from '@/lib/api/backend'
import type {
  MovieDiscoverResponseDto,
  MovieTaxonomyResponseDto,
} from '@/lib/api/dto'
import {
  MovieCountryIso,
  MovieGenreTmdb,
  MOVIE_COUNTRY_LABELS,
  MOVIE_GENRE_LABELS,
} from '@/lib/types/movie.enums'

/**
 * Loads taxonomy enum data from backend and runs discover with user-selected filters.
 */
export function useMovieExercise() {
  const [taxonomy, setTaxonomy] = useState<MovieTaxonomyResponseDto | null>(null)
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
  const [loadingTaxonomy, setLoadingTaxonomy] = useState(true)

  const [genre, setGenre] = useState<MovieGenreTmdb>(MovieGenreTmdb.Action)
  const [country, setCountry] = useState<MovieCountryIso>(
    MovieCountryIso.Spain,
  )

  const [movies, setMovies] = useState<MovieDiscoverResponseDto | null>(null)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setTaxonomyError(null)
      setLoadingTaxonomy(true)
      try {
        const data = await fetchMovieTaxonomy()
        if (!cancelled) setTaxonomy(data)
      } catch (e) {
        if (!cancelled) {
          setTaxonomyError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setLoadingTaxonomy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const discover = useCallback(async (e?: FormEvent) => {
    e?.preventDefault()
    setDiscoverLoading(true)
    setDiscoverError(null)
    setMovies(null)
    try {
      const payload = await fetchMovieDiscover(genre, country)
      setMovies(payload)
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : String(err))
    } finally {
      setDiscoverLoading(false)
    }
  }, [genre, country])

  /** Static enum listing for Exercise 2 (TypeScript definitions). */
  const enumGenreEntries = (
    Object.values(MovieGenreTmdb).filter(
      (v): v is MovieGenreTmdb => typeof v === 'number',
    ) as MovieGenreTmdb[]
  ).map((id) => ({
    id,
    label: MOVIE_GENRE_LABELS[id],
  }))

  const enumCountryEntries = (
    Object.values(MovieCountryIso).filter(
      (v): v is MovieCountryIso => typeof v === 'string',
    ) as MovieCountryIso[]
  ).map((code) => ({
    code,
    label: MOVIE_COUNTRY_LABELS[code],
  }))

  return {
    taxonomy,
    taxonomyError,
    loadingTaxonomy,
    enumGenreEntries,
    enumCountryEntries,
    genre,
    setGenre,
    country,
    setCountry,
    movies,
    discoverLoading,
    discoverError,
    discover,
  }
}
