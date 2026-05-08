/**
 * Normalized response after resolving an animal image (Pexels or cat fallback).
 */
export type AnimalLookupResult = {
  displayName: string;
  imageUrl: string;
  usedFallback: boolean;
  message: string | null;
  /** Pexels page URL for the photo, or null on fallback. */
  sourceUrl: string | null;
  /** Photographer credit from Pexels, or null on fallback. */
  photographer: string | null;
};

export type AnimalLookupQuery = {
  name: string;
};
