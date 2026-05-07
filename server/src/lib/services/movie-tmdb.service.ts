import type { MovieCountryIso } from "../../types/movie.enums.js";
import { MovieGenreTmdb } from "../../types/movie.enums.js";
import type {
  MovieDiscoverResponse,
  MovieSummary,
} from "../../types/movie.types.js";
import { recordServiceInteraction } from "./request-log.service.js";
import { HTTP_USER_AGENT } from "../wikimedia-http.js";

const TMDB_BASE = "https://api.themoviedb.org/3";

type TmdbDiscoverJson = {
  results?: Array<{
    title?: string;
    overview?: string;
    poster_path?: string | null;
    release_date?: string | null;
  }>;
};

/**
 * Builds discover URL. Uses `api_key` in the query only when no Bearer token is configured.
 * TMDB accepts either the v3 `api_key` parameter or `Authorization: Bearer <read_access_token>`.
 */
function discoverUrl(
  genre: MovieGenreTmdb,
  country: MovieCountryIso,
  apiKey: string | null
): string {
  const params = new URLSearchParams({
    with_genres: String(genre),
    with_origin_country: country,
    language: "es-ES",
    sort_by: "popularity.desc",
    page: "1",
  });
  if (apiKey) {
    params.set("api_key", apiKey);
  }
  return `${TMDB_BASE}/discover/movie?${params.toString()}`;
}

/**
 * Calls TMDB discover and maps results to our lightweight DTOs.
 * Set `TMDB_READ_ACCESS_TOKEN` (Bearer) and/or `TMDB_API_KEY` (query param) in the environment.
 */
export async function discoverMovies(
  genre: MovieGenreTmdb,
  country: MovieCountryIso
): Promise<MovieDiscoverResponse> {
  const apiKey = process.env.TMDB_API_KEY ?? "";
  const bearer = process.env.TMDB_READ_ACCESS_TOKEN ?? "";
  const logPayload = { genre: String(genre), country };

  if (!apiKey && !bearer) {
    recordServiceInteraction(
      "MovieTmdbService.discover",
      logPayload,
      "TMDB_API_KEY or TMDB_READ_ACCESS_TOKEN is not set — cannot call discover API"
    );
    return { results: [] };
  }

  const url = discoverUrl(genre, country, bearer ? null : apiKey);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": HTTP_USER_AGENT,
  };
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const msg = `TMDB HTTP ${res.status}`;
      recordServiceInteraction(
        "MovieTmdbService.discover",
        { ...logPayload, outbound: "GET /3/discover/movie" },
        msg
      );
      return { results: [] };
    }

    const data = (await res.json()) as TmdbDiscoverJson;
    const raw = Array.isArray(data.results) ? data.results : [];

    const results: MovieSummary[] = raw.map((r) => ({
      title: r.title ?? "(sin título)",
      overview: r.overview ?? "",
      posterUrl: r.poster_path
        ? `https://image.tmdb.org/t/p/w200${r.poster_path}`
        : null,
      releaseDate: r.release_date ?? null,
    }));

    recordServiceInteraction(
      "MovieTmdbService.discover",
      { ...logPayload, outbound: "GET /3/discover/movie" },
      null
    );
    return { results };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction(
      "MovieTmdbService.discover",
      { ...logPayload, outbound: "GET /3/discover/movie" },
      message
    );
    return { results: [] };
  }
}
