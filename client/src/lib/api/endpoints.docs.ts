/**
 * Typed documentation of the Node/Express API for quick reference in the React app.
 * Method + path + description — keep in sync with `server/src/routes/api.routes.ts`.
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export type DocumentedEndpoint = {
  method: HttpMethod
  /** Express path relative to origin (includes /api prefix). */
  path: string
  /** Short explanation for developers. */
  description: string
  /** Query or body notes (free text). */
  notes?: string
}

export const documentedExpressEndpoints: DocumentedEndpoint[] = [
  {
    method: 'GET',
    path: '/api/health',
    description: 'Liveness probe — returns `{ ok: true }`.',
  },
  {
    method: 'GET',
    path: '/api/tasks',
    description: 'List all todo rows from SQLite.',
  },
  {
    method: 'POST',
    path: '/api/tasks',
    description: 'Create a task. JSON body `{ title: string }`.',
    notes: 'Returns 201 + row JSON.',
  },
  {
    method: 'PATCH',
    path: '/api/tasks/:id',
    description: 'Toggle done flag. JSON body `{ done: boolean }`.',
  },
  {
    method: 'DELETE',
    path: '/api/tasks/:id',
    description: 'Delete a task by id. Returns 204 on success.',
  },
  {
    method: 'GET',
    path: '/api/animals/lookup',
    description:
      'Resolve an animal photo (Wikipedia thumbnail) with TheCatAPI fallback.',
    notes: 'Query `name`. Response: `{ displayName, imageUrl, usedFallback, message }`.',
  },
  {
    method: 'GET',
    path: '/api/cats/daily',
    description:
      'Random cat image (TheCatAPI) plus a cat fact from CatFact.ninja (free, English).',
    notes: 'Response: `{ imageUrl, quote }`.',
  },
  {
    method: 'GET',
    path: '/api/movies/taxonomy',
    description: 'Lists movie genres + countries available for Exercise 2.',
    notes: 'Aligned with TMDB discover filters.',
  },
  {
    method: 'GET',
    path: '/api/movies/discover',
    description: 'TMDB discover proxy — filtered movies for genre + country.',
    notes: 'Query `genre` (numeric TMDB id) and `country` (ISO 3166-1 alpha-2). Requires `TMDB_API_KEY` on server.',
  },
  {
    method: 'GET',
    path: '/api/logs/recent',
    description: 'Recent service interaction logs from SQLite.',
    notes: 'Optional query `limit` (default 50, max 200).',
  },
  {
    method: 'GET',
    path: '/ex1/animal',
    description: 'Exercise 1 view 1 — HTML form (favorite animal).',
  },
  {
    method: 'POST',
    path: '/ex1/animal',
    description: 'Exercise 1 — accepts `favoriteAnimal` (urlencoded) and redirects to result page.',
  },
  {
    method: 'GET',
    path: '/ex1/animal/result',
    description: 'Exercise 1 view 2 — shows animal name + resolved image.',
    notes: 'Query `favorite` populated after POST redirect.',
  },
]
