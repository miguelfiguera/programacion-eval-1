import { recordServiceInteraction } from "./request-log.service.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CAT_IMAGE_ENDPOINT = "https://api.thecatapi.com/v1/images/search?limit=1";
const CATAAS_CAT_JSON = "https://cataas.com/cat?json=true";

export type CatApiImage = {
  id?: string;
  url?: string;
};

async function fetchTheCatApiOnce(): Promise<string | null> {
  const payload = { outbound: CAT_IMAGE_ENDPOINT };
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "EvalHomework/1.0",
    };
    const apiKey = process.env.CAT_API_KEY;
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const res = await fetch(CAT_IMAGE_ENDPOINT, { headers });
    if (!res.ok) {
      const msg = `Cat API HTTP ${res.status}`;
      recordServiceInteraction("CatApiService.thecatapi", payload, msg);
      return null;
    }

    const body = (await res.json()) as CatApiImage[];
    const url = Array.isArray(body) && body[0]?.url ? body[0].url : null;
    if (!url) {
      recordServiceInteraction(
        "CatApiService.thecatapi",
        payload,
        "Empty cat image list in JSON body"
      );
      return null;
    }

    recordServiceInteraction("CatApiService.thecatapi", payload, null);
    return url;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("CatApiService.thecatapi", payload, message);
    return null;
  }
}

/**
 * Public cat image API without key; used when TheCatAPI fails (rate limits, outages).
 * @see https://cataas.com
 */
async function fetchCataasCatImageUrl(): Promise<string | null> {
  const payload = { outbound: CATAAS_CAT_JSON };
  try {
    const res = await fetch(CATAAS_CAT_JSON, {
      headers: { Accept: "application/json", "User-Agent": "EvalHomework/1.0" },
    });
    if (!res.ok) {
      recordServiceInteraction("CatApiService.cataas", payload, `HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { url?: string };
    const url = typeof body.url === "string" && /^https?:\/\//.test(body.url) ? body.url : null;
    if (!url) {
      recordServiceInteraction("CatApiService.cataas", payload, "No image url in Cataas JSON");
      return null;
    }
    recordServiceInteraction("CatApiService.cataas", payload, null);
    return url;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("CatApiService.cataas", payload, message);
    return null;
  }
}

/**
 * Fetches one random cat image URL: TheCatAPI (with optional API key), then Cataas as backup.
 * @returns The image URL string, or null if every source failed.
 */
export async function fetchRandomCatImageUrl(): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = await fetchTheCatApiOnce();
    if (url) return url;
    await delay(200 * (attempt + 1));
  }
  return fetchCataasCatImageUrl();
}
