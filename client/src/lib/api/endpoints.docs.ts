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
      'Resolve an animal photo: en/es Wikipedia, iNaturalist (Animalia only), TheCatAPI.',
    notes:
      'Query `name`. Normalizes Unicode; tries en/es Wikipedia (+ OpenSearch), then iNaturalist Animalia-only taxa (no key), then random cat. Response: `{ displayName, imageUrl, usedFallback, message }`.',
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
