import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
