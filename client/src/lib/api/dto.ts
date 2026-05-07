/**
 * Animal lookup response — mirrors server `AnimalLookupResult`.
 */
export type AnimalLookupResultDto = {
  displayName: string
  imageUrl: string
  usedFallback: boolean
  message: string | null
}

export type TaskRowDto = {
  id: number
  title: string
  done: number
  created_at: string
}

export type MovieSummaryDto = {
  title: string
  overview: string
  posterUrl: string | null
  releaseDate: string | null
}

export type MovieDiscoverResponseDto = {
  results: MovieSummaryDto[]
}

export type MovieTaxonomyResponseDto = {
  genres: Array<{ id: number; label: string }>
  countries: Array<{ code: string; label: string }>
}

export type RequestLogRowDto = {
  id: number
  created_at: string
  endpoint: string
  request_payload: string
  error_log: string | null
}

/** GET /api/cats/daily — imagen + texto sobre gatos */
export type CatOfDayDto = {
  imageUrl: string
  quote: string
}
