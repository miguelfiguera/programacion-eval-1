/**
 * Animal lookup orchestrator.
 *
 * Two-step pipeline:
 *   1. Search Pexels for a photo matching the animal name.
 *   2. If Pexels returns nothing, fall back to a random cat (TheCatAPI).
 */

import type { AnimalLookupResult } from "../../types/animal.types.js";
import { fetchRandomCatImageUrl } from "./cat-api.service.js";
import { searchPexelsPhoto } from "./pexels.service.js";
import { recordServiceInteraction } from "./request-log.service.js";

const FALLBACK_MSG = "Ups, no lo pudimos encontrar, pero aqui tienes un gatito.";

/**
 * Resolves an animal name to a photo + source link.
 *
 * @param name - Raw user input (e.g. "jaguar", "viuda negra").
 * @returns An object with the image URL, display name, and Pexels credit
 *          — or a cat fallback if Pexels had no results.
 */
export async function lookupAnimalByName(name: string): Promise<AnimalLookupResult> {
  const trimmed = name.trim();

  if (!trimmed) {
    recordServiceInteraction("AnimalLookup.lookup", { name: trimmed }, "Empty name");
    return catFallback(trimmed);
  }

  const hit = await searchPexelsPhoto(trimmed);
  if (hit) {
    return {
      displayName: trimmed,
      imageUrl: hit.imageUrl,
      usedFallback: false,
      message: null,
      sourceUrl: hit.pexelsUrl,
      photographer: hit.photographer,
    };
  }

  recordServiceInteraction(
    "AnimalLookup.lookup",
    { name: trimmed, source: "cat_fallback" },
    null,
  );
  return catFallback(trimmed);
}

/**
 * Builds a fallback result with a random cat image from TheCatAPI.
 * Used when Pexels returns no results or the input is empty.
 */
async function catFallback(displayName: string): Promise<AnimalLookupResult> {
  const imageUrl = (await fetchRandomCatImageUrl()) ?? "";
  return {
    displayName,
    imageUrl,
    usedFallback: true,
    message: FALLBACK_MSG,
    sourceUrl: null,
    photographer: null,
  };
}
