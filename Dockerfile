# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Only production deps; --ignore-scripts skips the husky prepare hook (dev-only)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# MCP servers communicate over stdio — no port needed
CMD ["node", "dist/index.js"]
