import type {
  AnimalLookupResultDto,
  CatOfDayDto,
  MovieDiscoverResponseDto,
  RequestLogRowDto,
} from '@/lib/api/dto'

/**
 * Central catalogue of every HTTP endpoint the Express server exposes under `/api`.
 * Use these paths with `fetch` from hooks only — never call third-party APIs from React.
 */
export const BackendRoutes = {
  health: '/api/health',
  /** GET — random cat + cat fact (TheCatAPI + CatFact.ninja) */
  catsDaily: '/api/cats/daily',
  /** GET ?name= — animal image via Wikipedia + TheCatAPI fallback */
  animalLookup: '/api/animals/lookup',
  /** GET ?genre=&country= — TMDB discover (server needs TMDB API / Bearer token) */
  movieDiscover: '/api/movies/discover',
  /** GET ?limit= — recent SQLite service logs */
  logsRecent: '/api/logs/recent',
} as const

export type BackendRoutesMap = typeof BackendRoutes

/**
 * Typed request helpers — all network failures bubble as thrown Errors with message text.
 */
export async function fetchHealth(): Promise<{ ok: boolean }> {
  const res = await fetch(BackendRoutes.health)
  if (!res.ok) throw new Error(`health: ${res.status}`)
  return res.json() as Promise<{ ok: boolean }>
}

export async function fetchAnimalLookup(name: string): Promise<AnimalLookupResultDto> {
  const q = new URLSearchParams({ name })
  const res = await fetch(`${BackendRoutes.animalLookup}?${q}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<AnimalLookupResultDto>
}

export async function fetchCatOfDay(): Promise<CatOfDayDto> {
  const res = await fetch(BackendRoutes.catsDaily)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<CatOfDayDto>
}

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

export async function fetchRecentLogs(limit = 50): Promise<RequestLogRowDto[]> {
  const q = new URLSearchParams({ limit: String(limit) })
  const res = await fetch(`${BackendRoutes.logsRecent}?${q}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<RequestLogRowDto[]>
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error ?? res.statusText
  } catch {
    return res.statusText
  }
}
