import type { MovieCountryIso } from "../../types/movie.enums.js";
import { MovieGenreTmdb } from "../../types/movie.enums.js";
import type {
  MovieDiscoverResponse,
  MovieSummary,
} from "../../types/movie.types.js";
import { recordServiceInteraction } from "./request-log.service.js";
const HTTP_USER_AGENT = "EvalHomework/1.0";

const TMDB_BASE = "https://api.themoviedb.org/3";

type TmdbDiscoverJson = {
  results?: Array<{
    id?: number;
    title?: string;
    overview?: string;
    poster_path?: string | null;
    release_date?: string | null;
  }>;
};

type TmdbCreditsJson = {
  crew?: Array<{ job?: string; name?: string }>;
};

function tmdbAuthHeaders(): {
  headers: Record<string, string>;
  apiKey: string;
  bearer: string;
} {
  const apiKey = process.env.TMDB_API_KEY ?? "";
  const bearer = process.env.TMDB_READ_ACCESS_TOKEN ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": HTTP_USER_AGENT,
  };
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  return { headers, apiKey, bearer };
}

async function fetchMovieDirector(
  movieId: number,
  apiKey: string,
  bearer: string,
  baseHeaders: Record<string, string>
): Promise<string | null> {
  const params = new URLSearchParams();
  if (!bearer && apiKey) {
    params.set("api_key", apiKey);
  }
  const qs = params.toString();
  const url = `${TMDB_BASE}/movie/${movieId}/credits${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(url, { headers: baseHeaders });
    if (!res.ok) return null;
    const data = (await res.json()) as TmdbCreditsJson;
    const d = data.crew?.find((c) => c.job === "Director");
    const name = d?.name?.trim();
    return name || null;
  } catch {
    return null;
  }
}

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
  const { headers } = tmdbAuthHeaders();

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

    const { apiKey: key, bearer: token, headers: h } = tmdbAuthHeaders();

    const results: MovieSummary[] = await Promise.all(
      raw.map(async (r) => {
        const id = typeof r.id === "number" && r.id > 0 ? r.id : 0;
        const director = id > 0 ? await fetchMovieDirector(id, key, token, h) : null;
        return {
          id,
          title: r.title ?? "(sin título)",
          overview: r.overview ?? "",
          posterUrl: r.poster_path
            ? `https://image.tmdb.org/t/p/w200${r.poster_path}`
            : null,
          releaseDate: r.release_date ?? null,
          director,
        };
      })
    );

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
