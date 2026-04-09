# syntax=docker/dockerfile:1

# Keep in sync with .nvmrc. Override at build time: --build-arg NODE_VERSION=26
ARG NODE_VERSION=24

# ── dev ──────────────────────────────────────────────────────────────────────
# Hot-reload dev server. Intended for use with docker compose (see
# docker-compose.yml), which mounts the source tree as a volume.
FROM node:${NODE_VERSION}-alpine AS dev
RUN apk upgrade --no-cache
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
# --host binds Vite to 0.0.0.0 so the port is reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host"]

# ── builder ───────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
RUN apk upgrade --no-cache
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# BASE_PATH=/ serves from the root; the default (/bill-split/) is for GitHub Pages.
ENV BASE_PATH=/
RUN npm run build

# ── prod ──────────────────────────────────────────────────────────────────────
# Minimal nginx image that serves the static build output.
FROM nginx:alpine AS prod
RUN apk upgrade --no-cache
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
