import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { LoggableRequestPayload, RequestLogRow } from "./types/log.types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.SQLITE_PATH ?? join(dataDir, "app.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    endpoint TEXT NOT NULL,
    request_payload TEXT NOT NULL,
    error_log TEXT
  );
`);

/**
 * Persists one service/API interaction with timestamp for auditing (SQLite).
 * @returns The integer id of the inserted log row.
 */
export function insertRequestLog(
  endpoint: string,
  requestPayload: LoggableRequestPayload,
  errorLog: string | null
): number {
  const stmt = db.prepare(
    `INSERT INTO request_logs (endpoint, request_payload, error_log)
     VALUES (@endpoint, @request_payload, @error_log)`
  );
  const info = stmt.run({
    endpoint,
    request_payload: JSON.stringify(requestPayload),
    error_log: errorLog,
  });
  return Number(info.lastInsertRowid);
}

/**
 * Returns the most recent interaction logs (newest first).
 */
export function listRecentRequestLogs(limit = 50): RequestLogRow[] {
  const stmt = db.prepare(
    `SELECT id, created_at, endpoint, request_payload, error_log
     FROM request_logs
     ORDER BY id DESC
     LIMIT ?`
  );
  return stmt.all(limit) as RequestLogRow[];
}
