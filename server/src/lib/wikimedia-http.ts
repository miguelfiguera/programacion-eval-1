import { recordServiceInteraction } from "./services/request-log.service.js";

/**
 * Identifies this client to public HTTP APIs. Wikimedia asks for a descriptive UA with contact.
 */
export const HTTP_USER_AGENT =
  "EvalHomework/1.0 (educational project; contact miguelqui725@gmail.com)";

const FETCH_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 6;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch JSON API URLs on Wikipedia / Wikidata with retries on rate limits and transient errors.
 */
export async function fetchWithWikimediaRetry(
  url: string,
  logTag: string,
  logPayload: Record<string, unknown>
): Promise<Response | null> {
  let wait = 500;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": HTTP_USER_AGENT, Accept: "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      recordServiceInteraction(
        logTag,
        { ...logPayload, attempt, outbound: url },
        message
      );
      await delay(Math.min(wait, 8000));
      wait = Math.min(wait * 2, 15_000);
      continue;
    }

    if (res.status === 429 || res.status === 503) {
      const raRaw = res.headers.get("retry-after");
      const raSec = raRaw ? Number.parseInt(raRaw, 10) : Number.NaN;
      const backoffMs =
        Number.isFinite(raSec) && raSec > 0
          ? Math.min(raSec * 1000, 20_000)
          : Math.min(wait, 12_000);
      recordServiceInteraction(
        logTag,
        { ...logPayload, attempt, status: res.status, backoffMs, outbound: url },
        "Rate limited / busy; retrying"
      );
      await delay(backoffMs);
      wait = Math.min(wait * 2, 15_000);
      continue;
    }

    return res;
  }
  return null;
}
