/**
 * Pexels image search — free API, requires API key in Authorization header.
 * @see https://www.pexels.com/api/documentation/
 */

import { recordServiceInteraction } from "./request-log.service.js";

const PEXELS_SEARCH = "https://api.pexels.com/v1/search";

export type PexelsPhoto = {
  id: number;
  url: string;
  photographer: string;
  src: { large: string; medium: string; small: string };
};

/**
 * Searches Pexels for photos matching a query. Returns the first result's
 * large image URL, or null if nothing was found / API key missing.
 */
export async function searchPexelsPhoto(
  query: string,
): Promise<{ imageUrl: string; pexelsUrl: string; photographer: string } | null> {
  const apiKey = process.env.PEXELS_API_KEY ?? "";
  const logPayload = { query, outbound: PEXELS_SEARCH };

  if (!apiKey) {
    recordServiceInteraction("PexelsService.search", logPayload, "PEXELS_API_KEY not set");
    return null;
  }

  const url = `${PEXELS_SEARCH}?query=${encodeURIComponent(query)}&per_page=1&locale=es-ES`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      recordServiceInteraction("PexelsService.search", logPayload, `HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    const photo = data.photos?.[0];
    if (!photo?.src?.large) {
      recordServiceInteraction("PexelsService.search", logPayload, "No photos found");
      return null;
    }

    recordServiceInteraction("PexelsService.search", logPayload, null);
    return {
      imageUrl: photo.src.large,
      pexelsUrl: photo.url,
      photographer: photo.photographer,
    };
  } catch (err) {
    recordServiceInteraction(
      "PexelsService.search",
      logPayload,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
