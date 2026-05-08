import { useCallback, useState, type FormEvent } from 'react'

import { fetchMovieDiscover } from '@/lib/api/backend'
import type { MovieDiscoverResponseDto } from '@/lib/api/dto'
import {
  MovieCountryIso,
  MovieGenreTmdb,
  MOVIE_COUNTRY_LABELS,
  MOVIE_GENRE_LABELS,
} from '@/lib/types/movie.enums'

/**
 * Hook for Exercise 2 — movie discovery via TMDB.
 *
 * Manages the selected genre/country filters and calls the backend
 * discover endpoint. Also exposes the enum entries (id + label) so the
 * view can render <select> options without importing enums directly.
 */
export function useMovieExercise() {
  const [genre, setGenre] = useState<MovieGenreTmdb>(MovieGenreTmdb.Action)
  const [country, setCountry] = useState<MovieCountryIso>(
    MovieCountryIso.Spain,
  )

  const [movies, setMovies] = useState<MovieDiscoverResponseDto | null>(null)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)

  /** Calls GET /api/movies/discover with the current genre + country filters. */
  const discover = useCallback(
    async (e?: FormEvent) => {
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
    },
    [genre, country],
  )

  /** Genre enum entries as `{ id, label }` pairs for <select> rendering. */
  const enumGenreEntries = (
    Object.values(MovieGenreTmdb).filter(
      (v): v is MovieGenreTmdb => typeof v === 'number',
    ) as MovieGenreTmdb[]
  ).map((id) => ({
    id,
    label: MOVIE_GENRE_LABELS[id],
  }))

  /** Country enum entries as `{ code, label }` pairs for <select> rendering. */
  const enumCountryEntries = (
    Object.values(MovieCountryIso).filter(
      (v): v is MovieCountryIso => typeof v === 'string',
    ) as MovieCountryIso[]
  ).map((code) => ({
    code,
    label: MOVIE_COUNTRY_LABELS[code],
  }))

  return {
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
