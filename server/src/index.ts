import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import apiRouter from "./routes/api.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load env files: monorepo root then server/ (later file wins on duplicate keys).
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.use("/api", apiRouter);

/** Legacy paths → canonical SPA route (address bar shows `/animal-favorito`). */
function redirectExercise1ToAnimalFavorito(req: Request, res: Response) {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(301, `/animal-favorito${q}`);
}
app.get("/exercise-1", redirectExercise1ToAnimalFavorito);
app.get("/exercise-1/result", redirectExercise1ToAnimalFavorito);

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));

app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
