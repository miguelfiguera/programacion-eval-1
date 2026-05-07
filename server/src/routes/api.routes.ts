import { Router, type Request, type Response } from "express";

import {
  createTask,
  deleteTask,
  listTasks,
  setTaskDone,
  listRecentRequestLogs,
} from "../db.js";
import { lookupAnimalByName } from "../lib/services/animal-lookup.service.js";
import { getCatOfDay } from "../lib/services/cat-of-day.service.js";
import { discoverMovies } from "../lib/services/movie-tmdb.service.js";
import {
  MovieCountryIso,
  MovieGenreTmdb,
  MOVIE_COUNTRY_LABELS,
  MOVIE_GENRE_LABELS,
} from "../types/movie.enums.js";

const router = Router();

/** @returns True when value is a valid MovieGenreTmdb numeric enum member. */
function isMovieGenreTmdb(value: number): value is MovieGenreTmdb {
  return Object.values(MovieGenreTmdb).includes(value as MovieGenreTmdb);
}

/** @returns True when value is a valid MovieCountryIso string enum member. */
function isMovieCountryIso(value: string): value is MovieCountryIso {
  return Object.values(MovieCountryIso).includes(value as MovieCountryIso);
}

router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.get("/tasks", (_req: Request, res: Response) => {
  try {
    res.json(listTasks());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

router.post("/tasks", (req: Request, res: Response) => {
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

router.patch("/tasks/:id", (req: Request, res: Response) => {
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

router.delete("/tasks/:id", (req: Request, res: Response) => {
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

/**
 * JSON proxy for animal lookup — calls Wikipedia then TheCatAPI fallback.
 * Query: ?name=lion
 */
router.get("/animals/lookup", async (req: Request, res: Response) => {
  const name = typeof req.query.name === "string" ? req.query.name : "";
  if (!name.trim()) {
    return res.status(400).json({ error: "name query parameter is required" });
  }
  try {
    const result = await lookupAnimalByName(name);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Animal lookup failed" });
  }
});

/**
 * “Gato del día”: random cat image (TheCatAPI) + cat fact (CatFact.ninja, English).
 */
router.get("/cats/daily", async (_req: Request, res: Response) => {
  try {
    const payload = await getCatOfDay();
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Cat of the day failed" });
  }
});

/**
 * Returns enum definitions for Exercise 2 / client selectors (genres + countries).
 */
router.get("/movies/taxonomy", (_req: Request, res: Response) => {
  const genreIds = Object.values(MovieGenreTmdb).filter(
    (v): v is MovieGenreTmdb => typeof v === "number"
  );
  const genres = genreIds.map((id) => ({
    id,
    label: MOVIE_GENRE_LABELS[id],
  }));

  const countryCodes = Object.values(MovieCountryIso).filter(
    (v): v is MovieCountryIso => typeof v === "string"
  );
  const countries = countryCodes.map((code) => ({
    code,
    label: MOVIE_COUNTRY_LABELS[code],
  }));

  res.json({ genres, countries });
});

/**
 * TMDB discover proxy — requires TMDB_API_KEY on the server.
 * Query: ?genre=28&country=US
 */
router.get("/movies/discover", async (req: Request, res: Response) => {
  const genreRaw = Number(req.query.genre);
  const countryRaw = typeof req.query.country === "string" ? req.query.country : "";

  if (!Number.isFinite(genreRaw) || !isMovieGenreTmdb(genreRaw)) {
    return res.status(400).json({ error: "invalid or missing genre (TMDB id)" });
  }
  if (!countryRaw || !isMovieCountryIso(countryRaw)) {
    return res.status(400).json({ error: "invalid or missing country (ISO code)" });
  }

  try {
    const payload = await discoverMovies(genreRaw, countryRaw);
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Movie discover failed" });
  }
});

/**
 * Recent SQLite interaction logs (for demos / transparency).
 */
router.get("/logs/recent", (req: Request, res: Response) => {
  const limitRaw = Number(req.query.limit ?? 50);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200
      ? Math.floor(limitRaw)
      : 50;
  try {
    res.json(listRecentRequestLogs(limit));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to read logs" });
  }
});

export default router;
