/**
 * JSON response body from https://catfact.ninja/fact (no API key, free).
 */
export type CatFactNinjaResponse = {
  fact?: string;
  length?: number;
};

/**
 * Payload returned by GET /api/cats/daily — random cat image + cat-related text.
 */
export type ServerCatOfDayPayload = {
  imageUrl: string;
  quote: string;
};
