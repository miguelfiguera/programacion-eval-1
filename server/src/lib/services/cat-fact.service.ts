import { recordServiceInteraction } from "./request-log.service.js";
import type { CatFactNinjaResponse } from "../../types/cat-of-day.types.js";

const CAT_FACT_NINJA = "https://catfact.ninja/fact";
const USER_AGENT = "EvalHomework/1.0 (educational; contact student)";

/**
 * Fetches one random cat-related fact from CatFact.ninja (suitable as a “quote” line under the image).
 * @returns The fact string, or null if the HTTP response or JSON is invalid.
 */
export async function fetchRandomCatFact(): Promise<string | null> {
  const logPayload = { outbound: "GET https://catfact.ninja/fact" };
  try {
    const res = await fetch(CAT_FACT_NINJA, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      recordServiceInteraction(
        "CatFactNinjaService.fetch",
        logPayload,
        `CatFact HTTP ${res.status}`
      );
      return null;
    }
    const data = (await res.json()) as CatFactNinjaResponse;
    const fact =
      typeof data.fact === "string" && data.fact.trim() ? data.fact.trim() : null;
    if (!fact) {
      recordServiceInteraction(
        "CatFactNinjaService.fetch",
        logPayload,
        "Missing or empty fact in JSON"
      );
      return null;
    }
    recordServiceInteraction("CatFactNinjaService.fetch", logPayload, null);
    return fact;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("CatFactNinjaService.fetch", logPayload, message);
    return null;
  }
}
