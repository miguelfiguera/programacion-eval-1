/**
 * Cat fact service — fetches random cat trivia from CatFact.ninja.
 *
 * Used by the "Cat of the day" feature as the text shown below the image.
 * Free API, no key required, returns English text.
 * @see https://catfact.ninja/
 */

import type { CatFactNinjaResponse } from "../../types/cat-of-day.types.js";
import { recordServiceInteraction } from "./request-log.service.js";

const CAT_FACT_NINJA = "https://catfact.ninja/fact";

/**
 * Fetches one random cat fact from CatFact.ninja.
 * @returns The fact string, or null if the request failed.
 */
export async function fetchRandomCatFact(): Promise<string | null> {
  const logPayload = { outbound: "GET https://catfact.ninja/fact" };
  try {
    const res = await fetch(CAT_FACT_NINJA, {
      headers: { Accept: "application/json", "User-Agent": "EvalHomework/1.0" },
    });
    if (!res.ok) {
      recordServiceInteraction("CatFactNinjaService.fetch", logPayload, `CatFact HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as CatFactNinjaResponse;
    const fact =
      typeof data.fact === "string" && data.fact.trim() ? data.fact.trim() : null;
    if (!fact) {
      recordServiceInteraction("CatFactNinjaService.fetch", logPayload, "Missing or empty fact in JSON");
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
