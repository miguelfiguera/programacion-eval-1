# programacion-eval-1

Aplicacion fullstack Express + SQLite + React para ejercicios de programacion (API proxy + vistas en React).

## Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Express 4 + TypeScript
- **Base de datos:** SQLite (better-sqlite3)
- **Monorepo:** npm workspaces (`client/` y `server/`)

## Requisitos

- Node.js >= 18

## Desarrollo

```bash
npm install
npm run dev
```

Esto levanta el servidor Express en `http://localhost:3001` y el cliente Vite en `http://localhost:5173` (con proxy a la API).

## Build y produccion

```bash
npm run build
npm start
```

El build compila el cliente a `client/dist/` y el servidor a `server/dist/`. Express sirve los archivos estaticos del cliente y la API desde el puerto 3001.

## Documentacion visual

Capturas de pantalla del flujo en **docs/capturas/** (`docs/capturas/README.md`).

## API

| Metodo | Ruta                     | Descripcion                                                         |
| ------ | ------------------------ | ------------------------------------------------------------------- |
| `GET`  | `/api/health`            | Health check                                                        |
| `GET`  | `/api/animals/lookup`    | Foto de animal (Wikidata Animalia + P18/Commons, Wikipedia de respaldo, gato) |
| `GET`  | `/api/cats/daily`        | Gato aleatorio + dato (TheCatAPI + CatFact)      |
| `GET`  | `/api/movies/discover`   | Peliculas TMDB (genre + country)                 |
| `GET`  | `/api/logs/recent`       | Ultimos logs de peticiones en SQLite             |

## Variables de entorno

| Variable          | Default                  | Descripcion                                              |
| ----------------- | ------------------------ | -------------------------------------------------------- |
| `PORT`            | `3001`                   | Puerto del servidor                                      |
| `SQLITE_PATH`     | `server/data/app.db`     | Ruta al archivo SQLite                                   |
| `CAT_API_KEY`     | —                        | Opcional: TheCatAPI; si falla, se usa Cataas como respaldo |

Las peticiones HTTP salientes usan un `User-Agent` con contacto (`miguelqui725@gmail.com`) para APIs públicas (Wikimedia, etc.).
