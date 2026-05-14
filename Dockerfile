# Build stage — uses bun to match the project's lockfile format
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN bun run build

# Production stage — slim node image, no bun needed at runtime
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
# Install only production deps; bun.lock is not used by npm but package.json ranges are fine here
RUN npm install --omit=dev --ignore-scripts

ENV NODE_ENV=production

# This server uses StdioServerTransport — it reads MCP messages from stdin
# and writes responses to stdout. Run with -i / stdin_open: true.
ENTRYPOINT ["node", "dist/index.js"]
