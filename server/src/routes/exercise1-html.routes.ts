import { Router, type Request, type Response } from "express";

import { lookupAnimalByName } from "../lib/services/animal-lookup.service.js";

const router = Router();

/**
 * Escapes text for safe insertion into HTML (prevents XSS in reflected name).
 * @returns The escaped string safe for text nodes and attributes in templates.
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * View 1 — form that asks for the user's favorite animal (Exercise 1).
 * This handler returns static HTML with a POST form targeting the same path prefix.
 */
router.get("/animal", (_req: Request, res: Response) => {
  res
    .status(200)
    .type("html")
    .send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ejercicio 1 — Animal favorito</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 2rem auto; padding: 0 1rem; }
    label { display: block; margin-bottom: .5rem; font-weight: 600; }
    input { width: 100%; padding: .5rem; box-sizing: border-box; }
    button { margin-top: 1rem; padding: .5rem 1rem; }
  </style>
</head>
<body>
  <h1>Ejercicio 1</h1>
  <p>¿Cuál es tu <strong>animal favorito</strong>?</p>
  <form method="post" action="/ex1/animal">
    <label for="favoriteAnimal">Nombre del animal</label>
    <input id="favoriteAnimal" name="favoriteAnimal" required autocomplete="off" />
    <button type="submit">Enviar</button>
  </form>
  <p><a href="/">Volver a la app React</a></p>
</body>
</html>`);
});

/**
 * Intercepts the POST, then redirects the browser to View 2 with the name in the query string.
 * Node issues a full navigation so the user lands on a different HTML document.
 */
router.post("/animal", (req: Request, res: Response) => {
  const name = (req.body as { favoriteAnimal?: unknown })?.favoriteAnimal;
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).type("html").send("favoriteAnimal is required");
    return;
  }
  const q = encodeURIComponent(name.trim());
  res.redirect(303, `/ex1/animal/result?favorite=${q}`);
});

/**
 * View 2 — shows the submitted name and a photo resolved by the animal lookup service.
 */
router.get("/animal/result", async (req: Request, res: Response) => {
  const raw = req.query.favorite;
  const name = typeof raw === "string" ? raw : "";
  if (!name.trim()) {
    res.redirect(302, "/ex1/animal");
    return;
  }

  try {
    const result = await lookupAnimalByName(name);
    const safeName = escapeHtml(result.displayName);
    const safeMsg = result.message ? escapeHtml(result.message) : "";
    const img = result.imageUrl
      ? `<img src="${escapeHtml(result.imageUrl)}" alt="${safeName}" width="320" style="max-width:100%;border-radius:8px;" />`
      : "<p>(Sin imagen disponible)</p>";

    res.status(200).type("html").send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resultado — ${safeName}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 36rem; margin: 2rem auto; padding: 0 1rem; }
    .msg { margin: 1rem 0; color: #555; }
  </style>
</head>
<body>
  <h1>Tu animal favorito</h1>
  <p><strong>${safeName}</strong></p>
  ${result.usedFallback && safeMsg ? `<p class="msg">${safeMsg}</p>` : ""}
  ${img}
  <p><a href="/ex1/animal">Volver al formulario</a></p>
  <p><a href="/">Volver a la app React</a></p>
</body>
</html>`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).type("html").send(`<pre>Error: ${escapeHtml(message)}</pre>`);
  }
});

export default router;
