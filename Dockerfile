# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package manifests first for better layer caching
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

RUN npm ci

# Copy source code
COPY client/ client/
COPY server/ server/

RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine

WORKDIR /app

# Install build tools for native modules (better-sqlite3 needs rebuild)
RUN apk add --no-cache python3 make g++

# Copy root manifests
COPY package.json package-lock.json ./
COPY server/package.json server/

# Install production dependencies only
RUN npm ci --omit=dev -w server && apk del python3 make g++

# Copy built artifacts from build stage
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist

# Create data directory for SQLite
RUN mkdir -p server/data

# Optional build-time API keys (prefer `docker run --env-file .env` or Compose `env_file` so
# secrets are not baked into layers when you omit --build-arg).
ARG CAT_API_KEY=""
ARG TMDB_API_KEY=""
ARG TMDB_READ_ACCESS_TOKEN=""
ENV CAT_API_KEY=${CAT_API_KEY}
ENV TMDB_API_KEY=${TMDB_API_KEY}
ENV TMDB_READ_ACCESS_TOKEN=${TMDB_READ_ACCESS_TOKEN}

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/dist/index.js"]
