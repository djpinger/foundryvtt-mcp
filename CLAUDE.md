# Project: foundryvtt-mcp

Model Context Protocol (MCP) server bridging AI assistants with FoundryVTT tabletop gaming software.

## Tech Stack

- **Language**: TypeScript (ES modules, `.js` imports for MCP SDK compatibility)
- **Runtime**: Node.js (Bun as package manager)
- **Test**: Vitest (unit), Playwright (E2E)
- **Lint/Format**: Biome (linting + formatting)
- **Validation**: Zod schemas

## Essential Commands

```bash
bun run build          # Compile TypeScript
bun run dev            # Development mode with hot reload
bun test               # Unit tests (Vitest)
bun run test:e2e       # E2E tests (Playwright, headless)
bun run lint           # Lint code (Biome)
bun run lint:fix       # Auto-fix lint issues
bun run format         # Format code (Biome)
bun run test-connection # Test MCP→FoundryVTT connection
```

### Docker

```bash
docker compose build          # Build image (tag: foundryvtt-mcp:latest)
docker compose up -d          # Start server in the background
docker compose logs -f        # Tail logs
docker compose down           # Stop and remove container
```

The image is used by Claude Code as the MCP server transport:
```
docker run --rm -i --env-file .env foundryvtt-mcp:latest
```

## Architecture

### Data Flow

1. AI assistant calls MCP tool → `src/tools/router.ts`
2. Router dispatches to handler → `src/tools/handlers/`
3. Handler queries cached worldData → `src/foundry/client.ts`
4. Response returned as MCP result

### Key Modules

| Module | Path | Purpose |
|--------|------|---------|
| Client | `src/foundry/client.ts` | Socket.IO connection, world state cache |
| Auth | `src/foundry/auth.ts` | 4-step Socket.IO authentication |
| Config | `src/config/index.ts` | Zod-validated environment config |
| Tools | `src/tools/definitions.ts` | MCP tool schemas |
| Router | `src/tools/router.ts` | Request→handler dispatch |
| Types | `src/foundry/types.ts` | FoundryVTT entity interfaces |

### Adding a New Tool

1. Add the schema to `src/tools/definitions.ts` (in the appropriate `*Tools` array)
2. Add a handler function to the relevant file in `src/tools/handlers/`
3. Add a `case` in the `switch` in `src/tools/router.ts`
4. Add a client method to `src/foundry/client.ts` if new data access is needed

### Authentication

- **Primary**: Socket.IO with `FOUNDRY_USERNAME`/`FOUNDRY_PASSWORD`
- **Optional**: `FOUNDRY_API_KEY` for REST API diagnostics (5 extra tools)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FOUNDRY_URL` | Yes | FoundryVTT server URL |
| `FOUNDRY_USERNAME` | Yes | FoundryVTT user |
| `FOUNDRY_PASSWORD` | Yes | FoundryVTT password |
| `FOUNDRY_USER_ID` | No | Bypass username→ID resolution |
| `FOUNDRY_API_KEY` | No | REST API module key |
| `LOG_LEVEL` | No | `debug` for verbose output |
| `FOUNDRY_TIMEOUT` | No | Request timeout (ms, default 10000) |

## Rules

See `.claude/rules/` for detailed guidelines:
- `development.md` — TDD workflow, commit conventions, build commands
- `testing.md` — Unit and E2E test requirements
- `document-management.md` — Document detection and organization

## Docker Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: bun (builder) → node:20-alpine (runtime) |
| `docker-compose.yml` | Runs the MCP server against a remote FoundryVTT instance |
| `.dockerignore` | Excludes node_modules, dist, .env, tests from build context |
| `.env` | Local credentials — copy from `.env.example`, never committed |

## Reference

- [FoundryVTT API](https://foundryvtt.com/api/)
- [Playwright Docs](https://playwright.dev/docs/intro)
- [MCP SDK](https://modelcontextprotocol.io/docs)
- [Fork](https://github.com/djpinger/foundryvtt-mcp)
