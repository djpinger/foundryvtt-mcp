# Project: foundryvtt-mcp

Model Context Protocol (MCP) server bridging AI assistants with FoundryVTT tabletop gaming software.

## Tech Stack

- **Language**: TypeScript (ES modules, `.js` imports for MCP SDK compatibility)
- **Runtime**: Node.js (asdf-managed, v22.7.0) — Bun listed as package manager but Node.js used in practice
- **Container**: Docker (recommended deployment method)
- **Test**: Vitest (unit), Playwright (E2E)
- **Lint/Format**: Biome (linting + formatting)
- **Validation**: Zod schemas

## Essential Commands

```bash
# Build
npm run build              # Compile TypeScript (use Node from asdf path)

# Docker (primary workflow — rebuild after any source change)
docker build -t foundryvtt-mcp:latest .
# Then restart Claude Code to pick up the new image

# Development (direct Node)
npm run dev                # Development mode with hot reload
npm run test-connection    # Test MCP→FoundryVTT connection

# Tests
npm test                   # Unit tests (Vitest)
npm run test:e2e           # E2E tests (Playwright, headless)

# Code quality
npm run lint               # Lint code (Biome)
npm run lint:fix           # Auto-fix lint issues
npm run format             # Format code (Biome)
```

> **Note:** If `node` isn't on PATH, use the full asdf path:
> `PATH="/home/pinger/.asdf/installs/nodejs/22.7.0/bin:$PATH" npm run build`

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
| Scenes | `src/tools/handlers/scenes.ts` | Battle map, positions, line-of-sight |
| Actors | `src/tools/handlers/actors.ts` | Actor search + full PF2e stat block |

### Tool Inventory

| Tool | Handler | Description |
|------|---------|-------------|
| `get_combat_state` | combat.ts | Initiative order, HP, AC |
| `get_combat_positions` | scenes.ts | ASCII battle map with walls/doors, grid coords, pairwise distances |
| `check_line_of_sight` | scenes.ts | LoS between two named combatants accounting for walls/doors |
| `get_scene_info` | scenes.ts | Scene metadata |
| `get_actor_details` | actors.ts | Full PF2e stat block: speed, saves, spells, spell slots, strikes |
| `search_actors` | actors.ts | Search by name/type; returns actor IDs |
| `roll_dice` | dice.ts | Dice rolling |
| `get_world_summary` | world.ts | Collection counts |
| `search_world` | world.ts | Cross-collection search |
| `refresh_world_data` | world.ts | Force re-fetch |
| `get_chat_messages` | chat.ts | Recent chat |
| `get_users` | users.ts | Online status |
| `search_journals` | journals.ts | Search journal entries |
| `get_journal` | journals.ts | Fetch journal with pages |
| `search_items` | items.ts | Search items |
| `generate_npc` | generation.ts | Random NPC |
| `generate_loot` | generation.ts | Random loot |
| `lookup_rule` | generation.ts | Rule lookups |

### Authentication

- **Primary**: Socket.IO with `FOUNDRY_USERNAME`/`FOUNDRY_PASSWORD`
- **Optional**: `FOUNDRY_API_KEY` for REST API diagnostics (5 extra tools)

### Startup Order

MCP transport (`server.connect(transport)`) must be called **before** `foundryClient.connect()`.
Claude Code's initialize handshake fires immediately and will time out if FoundryVTT connection
blocks the event loop first. See `src/index.ts`.

### Logging

All log output goes to **stderr** (`process.stderr.write`). Stdout is reserved exclusively for
MCP JSON-RPC messages. Any stdout pollution will corrupt the protocol.

### PF2e-Specific Notes

- **Combatant names**: FoundryVTT v13+ PF2e combatants lack `name` on the combatant document.
  Look up via `getRawActor(c.actorId).name` instead.
- **Alliance detection**: Check `actor.system.details.alliance` first (PF2e field: `"party"`,
  `"opposition"`, `"neutral"`). Fall back to token `disposition` (-1/0/1) for NPCs.
- **Spell slots**: `spellcastingEntry.system.slots.slotN.value` is always 0 (legacy/unused).
  Actual prepared/expended state lives in `system.slots.slotN.prepared[i].expended` (boolean).
- **Focus points**: `actor.system.resources.focus.value` / `.max`.

## Docker Deployment

The MCP server runs in Docker to avoid process management overhead and ensure a clean
environment. Credentials are passed via `-e` flags so `.env` never enters the image.

```bash
# Build image
docker build -t foundryvtt-mcp:latest .

# Test run
docker run --rm -i \
  --add-host=host.docker.internal:host-gateway \
  -e FOUNDRY_URL=http://host.docker.internal:30000 \
  -e FOUNDRY_USERNAME=YourUser \
  -e FOUNDRY_PASSWORD=YourPass \
  -e LOG_LEVEL=info \
  foundryvtt-mcp:latest
```

**Claude Code MCP config** (added via `claude mcp add-json -s user foundryvtt`):
```json
{
  "type": "stdio",
  "command": "docker",
  "args": [
    "run", "--rm", "-i",
    "--add-host=host.docker.internal:host-gateway",
    "-e", "FOUNDRY_URL=http://host.docker.internal:30000",
    "-e", "FOUNDRY_USERNAME=YourUser",
    "-e", "FOUNDRY_PASSWORD=YourPass",
    "-e", "LOG_LEVEL=info",
    "foundryvtt-mcp:latest"
  ]
}
```

After rebuilding the image, restart Claude Code for the new version to take effect.

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

## Reference

- [FoundryVTT API](https://foundryvtt.com/api/)
- [Playwright Docs](https://playwright.dev/docs/intro)
- [MCP SDK](https://modelcontextprotocol.io/docs)
