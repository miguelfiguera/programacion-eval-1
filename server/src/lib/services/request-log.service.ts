import { insertRequestLog } from "../../db.js";
import type { LoggableRequestPayload } from "../../types/log.types.js";

/**
 * Records a single backend interaction in SQLite (success or failure).
 * errorLog should be null on success, or a human-readable error description on failure.
 * @returns The database row id created for this log entry.
 */
export function recordServiceInteraction(
  endpoint: string,
  requestPayload: LoggableRequestPayload,
  errorLog: string | null
): number {
  return insertRequestLog(endpoint, requestPayload, errorLog);
}
