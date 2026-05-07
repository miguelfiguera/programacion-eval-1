import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import apiRouter from "./routes/api.routes.js";
import exercise1Router from "./routes/exercise1-html.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load env files: monorepo root then server/ (later file wins on duplicate keys).
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/ex1", exercise1Router);
app.use("/api", apiRouter);

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));

app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/ex1")) {
    return next();
  }
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
