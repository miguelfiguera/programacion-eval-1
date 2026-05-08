/**
 * "Cat of the day" — combines a random cat image with a fun cat fact.
 *
 * Runs both requests (TheCatAPI + CatFact.ninja) in parallel.
 * Never throws; fills safe fallback values if either source fails.
 */

import { fetchRandomCatImageUrl } from "./cat-api.service.js";
import { fetchRandomCatFact } from "./cat-fact.service.js";
import type { ServerCatOfDayPayload } from "../../types/cat-of-day.types.js";

const FALLBACK_QUOTE_ES =
  "Los gatos pueden dormir hasta 16 horas al día — un buen candidato a gato del día.";

/**
 * Loads a random cat picture + a cat fact for the "Gato del día" feature.
 *
 * @returns `{ imageUrl, quote }` — imageUrl may be empty if both cat
 *          image sources failed; quote falls back to a Spanish default.
 */
export async function getCatOfDay(): Promise<ServerCatOfDayPayload> {
  const [imageUrl, factEn] = await Promise.all([
    fetchRandomCatImageUrl(),
    fetchRandomCatFact(),
  ]);

  return {
    imageUrl: imageUrl ?? "",
    quote: factEn ?? FALLBACK_QUOTE_ES,
  };
}
