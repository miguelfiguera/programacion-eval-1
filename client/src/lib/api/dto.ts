/**
 * Animal lookup response — mirrors server `AnimalLookupResult`.
 */
export type AnimalLookupResultDto = {
  displayName: string
  imageUrl: string
  usedFallback: boolean
  message: string | null
}

/**
 * Minimal movie card — mirrors server `MovieSummary`.
 */
export type MovieSummaryDto = {
  title: string
  overview: string
  posterUrl: string | null
  releaseDate: string | null
}

export type MovieDiscoverResponseDto = {
  results: MovieSummaryDto[]
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
