# syntax=docker/dockerfile:1

# ── dev ──────────────────────────────────────────────────────────────────────
# Hot-reload dev server. Intended for use with docker compose (see
# docker-compose.yml), which mounts the source tree as a volume.
FROM cgr.dev/chainguard/node:latest-dev AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
# Chainguard node sets ENTRYPOINT ["node"]; clear it so this exec-form CMD runs `npm`
# directly instead of having `npm` treated as a Node script/module.
# --host binds Vite to 0.0.0.0 so the port is reachable from outside the container.
ENTRYPOINT []
CMD ["npm", "run", "dev", "--", "--host"]

# ── builder ───────────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest-dev AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# BASE_PATH=/ serves from the root; the default (/bill-split/) is for GitHub Pages.
ENV BASE_PATH=/
RUN npm run build

# ── prod ──────────────────────────────────────────────────────────────────────
# Minimal nginx image that serves the static build output.
# Chainguard nginx runs as non-root, so port 8080 is used instead of 80.
FROM cgr.dev/chainguard/nginx:latest AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/nginx.default.conf
EXPOSE 8080
