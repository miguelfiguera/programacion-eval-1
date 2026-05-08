/**
 * Service interaction logger — thin wrapper around the SQLite insert.
 *
 * Every outbound HTTP call (Pexels, TheCatAPI, TMDB, etc.) should call
 * `recordServiceInteraction` on completion so the API reference page
 * can display a live tail of backend activity.
 */

import { insertRequestLog } from "../../db.js";
import type { LoggableRequestPayload } from "../../types/log.types.js";

/**
 * Persists one service interaction to SQLite.
 *
 * @param endpoint  - Logical tag (e.g. "PexelsService.search").
 * @param payload   - Arbitrary context to store as JSON.
 * @param errorLog  - Human-readable error string, or null on success.
 * @returns The auto-incremented row id, or 0 if the insert itself failed.
 */
export function recordServiceInteraction(
  endpoint: string,
  requestPayload: LoggableRequestPayload,
  errorLog: string | null
): number {
  try {
    return insertRequestLog(endpoint, requestPayload, errorLog);
  } catch (err) {
    console.error("SQLite request log insert failed (request continues):", err);
    return 0;
  }
}
