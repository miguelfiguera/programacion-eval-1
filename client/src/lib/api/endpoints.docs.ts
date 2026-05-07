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
    path: '/api/animals/lookup',
    description:
      'Resolve an animal photo: optional API Ninjas name check, en/es Wikipedia (Wikidata Animalia), TheCatAPI fallback.',
    notes:
      'Query `name`. With `API_NINJAS_KEY` on the server, calls https://api.api-ninjas.com/v1/animals first so queries like brands do not resolve to Wikipedia companies. Then Wikipedia (English then Spanish), Wikidata check for kingdom Animalia, then random cat. Response: `{ displayName, imageUrl, usedFallback, message }`.',
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
]
