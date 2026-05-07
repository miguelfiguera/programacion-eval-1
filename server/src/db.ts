import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { LoggableRequestPayload, RequestLogRow } from "./types/log.types.js";

export type TaskRow = {
  id: number;
  title: string;
  done: number;
  created_at: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.SQLITE_PATH ?? join(dataDir, "app.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    endpoint TEXT NOT NULL,
    request_payload TEXT NOT NULL,
    error_log TEXT
  );
`);

export function listTasks(): TaskRow[] {
  return db
    .prepare("SELECT id, title, done, created_at FROM tasks ORDER BY id DESC")
    .all() as TaskRow[];
}

export function createTask(title: string): TaskRow | undefined {
  const stmt = db.prepare(
    "INSERT INTO tasks (title) VALUES (?) RETURNING id, title, done, created_at"
  );
  return stmt.get(String(title).trim()) as TaskRow | undefined;
}

export function setTaskDone(
  id: number,
  done: boolean
): TaskRow | undefined {
  const stmt = db.prepare(
    "UPDATE tasks SET done = ? WHERE id = ? RETURNING id, title, done, created_at"
  );
  return stmt.get(done ? 1 : 0, id) as TaskRow | undefined;
}

export function deleteTask(id: number): boolean {
  const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
  const info = stmt.run(id);
  return info.changes > 0;
}

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
