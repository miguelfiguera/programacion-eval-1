/**
 * Data Transfer Objects — mirror the JSON shapes returned by the Express API.
 * Keep these in sync with the server-side types in `server/src/types/`.
 */

/** GET /api/animals/lookup — animal photo from Pexels or cat fallback. */
export type AnimalLookupResultDto = {
  /** User's trimmed input shown back in the UI. */
  displayName: string
  /** HTTPS URL for the animal or cat image. */
  imageUrl: string
  /** True when Pexels returned no results and a cat was shown instead. */
  usedFallback: boolean
  /** User-facing message when fallback is used; null on success. */
  message: string | null
  /** Pexels photo page URL; null on fallback. */
  sourceUrl: string | null
  /** Photographer credit from Pexels; null on fallback. */
  photographer: string | null
}

/** Single movie card inside a discover response. */
export type MovieSummaryDto = {
  /** TMDB movie id. */
  id: number
  title: string
  overview: string
  /** Poster thumbnail URL (w200) or null. */
  posterUrl: string | null
  /** ISO YYYY-MM-DD release date or null. */
  releaseDate: string | null
  /** Primary director name or null. */
  director: string | null
}

/** GET /api/movies/discover — list of movies matching genre + country. */
export type MovieDiscoverResponseDto = {
  results: MovieSummaryDto[]
}

/** Single row from the SQLite interaction log. */
export type RequestLogRowDto = {
  id: number
  created_at: string
  endpoint: string
  request_payload: string
  error_log: string | null
}

/** GET /api/cats/daily — random cat image + fun fact text. */
export type CatOfDayDto = {
  imageUrl: string
  quote: string
}
