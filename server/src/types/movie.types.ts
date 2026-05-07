import type { MovieCountryIso, MovieGenreTmdb } from "./movie.enums.js";

/**
 * Query parameters for discovering movies on the backend.
 */
export type MovieDiscoverParams = {
  genre: MovieGenreTmdb;
  country: MovieCountryIso;
};

/**
 * Minimal movie card data returned to the React client.
 */
export type MovieSummary = {
  /** TMDB movie id (for stable keys and future calls). */
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  /** ISO `YYYY-MM-DD` from TMDB, or null. */
  releaseDate: string | null;
  /** Primary director name from `/movie/{id}/credits`, if available. */
  director: string | null;
};

/**
 * Successful discover payload.
 */
export type MovieDiscoverResponse = {
  results: MovieSummary[];
};
