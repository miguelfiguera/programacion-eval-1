import { recordServiceInteraction } from "./request-log.service.js";

const CAT_IMAGE_ENDPOINT = "https://api.thecatapi.com/v1/images/search?limit=1";
const USER_AGENT = "EvalHomework/1.0 (educational; contact student)";

export type CatApiImage = {
  id?: string;
  url?: string;
};

/**
 * Fetches one random cat image URL from TheCatAPI.
 * @returns The image URL string, or null if the API response is unusable.
 */
export async function fetchRandomCatImageUrl(): Promise<string | null> {
  const payload = { outbound: CAT_IMAGE_ENDPOINT };
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    };
    const apiKey = process.env.CAT_API_KEY;
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const res = await fetch(CAT_IMAGE_ENDPOINT, { headers });
    if (!res.ok) {
      const msg = `Cat API HTTP ${res.status}`;
      recordServiceInteraction("CatApiService.fetchRandom", payload, msg);
      return null;
    }

    const body = (await res.json()) as CatApiImage[];
    const url = Array.isArray(body) && body[0]?.url ? body[0].url : null;
    if (!url) {
      recordServiceInteraction(
        "CatApiService.fetchRandom",
        payload,
        "Empty cat image list in JSON body"
      );
      return null;
    }

    recordServiceInteraction("CatApiService.fetchRandom", payload, null);
    return url;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("CatApiService.fetchRandom", payload, message);
    return null;
  }
}
