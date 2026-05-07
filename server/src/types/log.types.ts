/**
 * Row shape returned when reading interaction logs from SQLite.
 */
export type RequestLogRow = {
  id: number;
  created_at: string;
  endpoint: string;
  request_payload: string;
  error_log: string | null;
};

/**
 * Payload we persist for each outbound or inbound service interaction.
 */
export type LoggableRequestPayload = Record<string, unknown>;
