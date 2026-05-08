/**
 * Typed fetch helpers for every Express backend endpoint.
 * All functions throw on HTTP errors so callers can catch in one place.
 */

import type {
  AnimalLookupResultDto,
  CatOfDayDto,
  MovieDiscoverResponseDto,
  RequestLogRowDto,
} from '@/lib/api/dto'

/**
 * Central map of backend route paths.
 * Every fetch helper below references these constants instead of hard-coding URLs.
 */
export const BackendRoutes = {
  health: '/api/health',
  catsDaily: '/api/cats/daily',
  animalLookup: '/api/animals/lookup',
  movieDiscover: '/api/movies/discover',
  logsRecent: '/api/logs/recent',
} as const

export type BackendRoutesMap = typeof BackendRoutes

/** Checks if the server is alive. Returns `{ ok: true }` on success. */
export async function fetchHealth(): Promise<{ ok: boolean }> {
  const res = await fetch(BackendRoutes.health)
  if (!res.ok) throw new Error(`health: ${res.status}`)
  return res.json() as Promise<{ ok: boolean }>
}

/**
 * Searches for an animal photo via the backend (Pexels → cat fallback).
 * Throws if the server is unreachable or returns a non-2xx status.
 */
export async function fetchAnimalLookup(name: string): Promise<AnimalLookupResultDto> {
  const q = new URLSearchParams({ name })
  const res = await fetch(`${BackendRoutes.animalLookup}?${q}`)
  if (!res.ok) throw new Error(await readError(res))
  const text = await res.text()
  try {
    return JSON.parse(text) as AnimalLookupResultDto
  } catch {
    throw new Error(
      'La API no devolvió JSON. Comprueba que el servidor esté en marcha y que la petición llegue a /api/animals/lookup.',
    )
  }
}

/** Fetches a random cat image + fun fact for the "Cat of the day" feature. */
export async function fetchCatOfDay(): Promise<CatOfDayDto> {
  const res = await fetch(BackendRoutes.catsDaily)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<CatOfDayDto>
}

/**
 * Discovers movies from TMDB filtered by genre and country.
 * The backend proxies the request so the API key stays server-side.
 */
export async function fetchMovieDiscover(
  genre: number,
  country: string,
): Promise<MovieDiscoverResponseDto> {
  const q = new URLSearchParams({
    genre: String(genre),
    country,
  })
  const res = await fetch(`${BackendRoutes.movieDiscover}?${q}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<MovieDiscoverResponseDto>
}

/** Fetches the most recent service interaction logs stored in SQLite. */
export async function fetchRecentLogs(limit = 50): Promise<RequestLogRowDto[]> {
  const q = new URLSearchParams({ limit: String(limit) })
  const res = await fetch(`${BackendRoutes.logsRecent}?${q}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<RequestLogRowDto[]>
}

/**
 * Extracts a human-readable error message from a failed response.
 * Tries to parse `{ error: "..." }` JSON first, falls back to statusText.
 */
async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error ?? res.statusText
  } catch {
    return res.statusText
  }
}
