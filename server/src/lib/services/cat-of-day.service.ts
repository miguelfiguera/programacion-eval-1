import { fetchRandomCatImageUrl } from "./cat-api.service.js";
import { fetchRandomCatFact } from "./cat-fact.service.js";
import type { ServerCatOfDayPayload } from "../../types/cat-of-day.types.js";

const FALLBACK_QUOTE_ES =
  "Los gatos pueden dormir hasta 16 horas al día — un buen candidato a gato del día.";

/**
 * Loads a random cat picture (TheCatAPI) plus a cat fact (CatFact.ninja) for the “Gato del día” feature.
 * This function runs both requests in parallel and never throws; it fills safe fallbacks instead.
 * @returns Object with `imageUrl` (may be empty) and `quote` (Spanish fallback if fact API fails).
 */
export async function getCatOfDay(): Promise<ServerCatOfDayPayload> {
  const [imageUrl, factEn] = await Promise.all([
    fetchRandomCatImageUrl(),
    fetchRandomCatFact(),
  ]);

  const quote = factEn ?? FALLBACK_QUOTE_ES;

  return {
    imageUrl: imageUrl ?? "",
    quote,
  };
}
