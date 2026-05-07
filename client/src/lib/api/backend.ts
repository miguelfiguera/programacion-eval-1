import type {
  AnimalLookupResultDto,
  CatOfDayDto,
  MovieDiscoverResponseDto,
  MovieTaxonomyResponseDto,
  RequestLogRowDto,
  TaskRowDto,
} from '@/lib/api/dto'

/**
 * Central catalogue of every HTTP endpoint the Express server exposes under `/api`.
 * Use these paths with `fetch` from hooks only — never call third-party APIs from React.
 */
export const BackendRoutes = {
  health: '/api/health',
  tasks: '/api/tasks',
  /** GET — random cat + cat fact (TheCatAPI + CatFact.ninja) */
  catsDaily: '/api/cats/daily',
  /** GET — genre/country lists for UI selectors */
  movieTaxonomy: '/api/movies/taxonomy',
  /** GET ?genre=&country= — TMDB discover (server needs TMDB_API_KEY) */
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

export async function fetchTasks(): Promise<TaskRowDto[]> {
  const res = await fetch(BackendRoutes.tasks)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<TaskRowDto[]>
}

export async function createTask(title: string): Promise<TaskRowDto> {
  const res = await fetch(BackendRoutes.tasks, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<TaskRowDto>
}

export async function patchTaskDone(id: number, done: boolean): Promise<TaskRowDto> {
  const res = await fetch(`${BackendRoutes.tasks}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<TaskRowDto>
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${BackendRoutes.tasks}/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(await readError(res))
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

export async function fetchMovieTaxonomy(): Promise<MovieTaxonomyResponseDto> {
  const res = await fetch(BackendRoutes.movieTaxonomy)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<MovieTaxonomyResponseDto>
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
