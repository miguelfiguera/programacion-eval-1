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
  title: string;
  overview: string;
  posterUrl: string | null;
  releaseDate: string | null;
};

/**
 * Successful discover payload.
 */
export type MovieDiscoverResponse = {
  results: MovieSummary[];
};
