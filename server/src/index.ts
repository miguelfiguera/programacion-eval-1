import cors from "cors";
import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTask, deleteTask, listTasks, setTaskDone } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get("/api/tasks", (_req: Request, res: Response) => {
  try {
    res.json(listTasks());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

app.post("/api/tasks", (req: Request, res: Response) => {
  const title = (req.body as { title?: unknown } | undefined)?.title;
  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "title is required" });
  }
  try {
    const row = createTask(title);
    if (!row) {
      return res.status(500).json({ error: "Failed to create task" });
    }
    res.status(201).json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.patch("/api/tasks/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "invalid id" });
  }
  const done = (req.body as { done?: unknown } | undefined)?.done;
  if (typeof done !== "boolean") {
    return res.status(400).json({ error: "done must be a boolean" });
  }
  try {
    const row = setTaskDone(id, done);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete("/api/tasks/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "invalid id" });
  }
  try {
    const removed = deleteTask(id);
    if (!removed) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));

app.get(
  "*",
  (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next();
    });
  }
);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
