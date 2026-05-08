/**
 * Animal lookup: searches Pexels for a photo, falls back to TheCatAPI.
 */

import type { AnimalLookupResult } from "../../types/animal.types.js";
import { fetchRandomCatImageUrl } from "./cat-api.service.js";
import { searchPexelsPhoto } from "./pexels.service.js";
import { recordServiceInteraction } from "./request-log.service.js";

const FALLBACK_MSG = "Ups, no lo pudimos encontrar, pero aqui tienes un gatito.";

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
