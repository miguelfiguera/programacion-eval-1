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

## API

| Metodo | Ruta                     | Descripcion                                                         |
| ------ | ------------------------ | ------------------------------------------------------------------- |
| `GET`  | `/api/health`            | Health check                                                        |
| `GET`  | `/api/animals/lookup`    | Foto de animal (API Ninjas si hay clave, Wikipedia en/es, gato) |
| `GET`  | `/api/cats/daily`        | Gato aleatorio + dato (TheCatAPI + CatFact)      |
| `GET`  | `/api/movies/discover`   | Peliculas TMDB (genre + country)                 |
| `GET`  | `/api/logs/recent`       | Ultimos logs de peticiones en SQLite             |

## Variables de entorno

| Variable          | Default                  | Descripcion                                              |
| ----------------- | ------------------------ | -------------------------------------------------------- |
| `PORT`            | `3001`                   | Puerto del servidor                                      |
| `SQLITE_PATH`     | `server/data/app.db`     | Ruta al archivo SQLite                                   |
| `API_NINJAS_KEY`  | —                        | Opcional y recomendada: valida nombres de animales reales |
