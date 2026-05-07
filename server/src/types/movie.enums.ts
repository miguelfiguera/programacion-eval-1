/**
 * Movie genre identifiers as defined by The Movie Database (TMDB) API.
 * Used with discover endpoint parameter `with_genres`.
 * @see https://developer.themoviedb.org/reference/discover-movie
 */
export enum MovieGenreTmdb {
  Action = 28,
  Adventure = 12,
  Animation = 16,
  Comedy = 35,
  Drama = 18,
  Horror = 27,
  ScienceFiction = 878,
}

/**
 * Production country filter (ISO 3166-1 alpha-2) for TMDB discover.
 * Maps to `with_origin_country` query parameter.
 */
export enum MovieCountryIso {
  UnitedStates = "US",
  Mexico = "MX",
  Spain = "ES",
  France = "FR",
  Japan = "JP",
  UnitedKingdom = "GB",
}

/** Human-readable labels for Exercise 2 UI (Spanish). */
export const MOVIE_GENRE_LABELS: Record<MovieGenreTmdb, string> = {
  [MovieGenreTmdb.Action]: "Acción",
  [MovieGenreTmdb.Adventure]: "Aventura",
  [MovieGenreTmdb.Animation]: "Animación",
  [MovieGenreTmdb.Comedy]: "Comedia",
  [MovieGenreTmdb.Drama]: "Drama",
  [MovieGenreTmdb.Horror]: "Terror",
  [MovieGenreTmdb.ScienceFiction]: "Ciencia ficción",
};

/** Human-readable labels for countries (Spanish). */
export const MOVIE_COUNTRY_LABELS: Record<MovieCountryIso, string> = {
  [MovieCountryIso.UnitedStates]: "Estados Unidos",
  [MovieCountryIso.Mexico]: "México",
  [MovieCountryIso.Spain]: "España",
  [MovieCountryIso.France]: "Francia",
  [MovieCountryIso.Japan]: "Japón",
  [MovieCountryIso.UnitedKingdom]: "Reino Unido",
};
