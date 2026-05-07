/**
 * See server/src/types/movie.enums.ts — values must stay aligned for TMDB queries.
 * This enum drives Exercise 2 (movie genre selection).
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
 * ISO country codes for TMDB discover filters (with_origin_country).
 */
export enum MovieCountryIso {
  UnitedStates = 'US',
  Mexico = 'MX',
  Spain = 'ES',
  France = 'FR',
  Japan = 'JP',
  UnitedKingdom = 'GB',
}

export const MOVIE_GENRE_LABELS: Record<MovieGenreTmdb, string> = {
  [MovieGenreTmdb.Action]: 'Acción',
  [MovieGenreTmdb.Adventure]: 'Aventura',
  [MovieGenreTmdb.Animation]: 'Animación',
  [MovieGenreTmdb.Comedy]: 'Comedia',
  [MovieGenreTmdb.Drama]: 'Drama',
  [MovieGenreTmdb.Horror]: 'Terror',
  [MovieGenreTmdb.ScienceFiction]: 'Ciencia ficción',
}

export const MOVIE_COUNTRY_LABELS: Record<MovieCountryIso, string> = {
  [MovieCountryIso.UnitedStates]: 'Estados Unidos',
  [MovieCountryIso.Mexico]: 'México',
  [MovieCountryIso.Spain]: 'España',
  [MovieCountryIso.France]: 'Francia',
  [MovieCountryIso.Japan]: 'Japón',
  [MovieCountryIso.UnitedKingdom]: 'Reino Unido',
}
