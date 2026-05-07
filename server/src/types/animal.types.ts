/**
 * Normalized response after resolving an animal image (Wikipedia or cat fallback).
 */
export type AnimalLookupResult = {
  /** Display name chosen for the user (trimmed input or Wikipedia title). */
  displayName: string;
  /** HTTPS URL suitable for an <img src>. */
  imageUrl: string;
  /** True when Wikipedia (or primary source) did not yield a usable image. */
  usedFallback: boolean;
  /**
   * User-facing message when fallback is used (Spanish copy for the exercise).
   * Null when the primary lookup succeeded.
   */
  message: string | null;
  /** Article URL when `imageUrl` came from Wikipedia; otherwise null. */
  wikipediaUrl: string | null;
};

/**
 * Query params accepted by GET /api/animals/lookup
 */
export type AnimalLookupQuery = {
  name: string;
};
