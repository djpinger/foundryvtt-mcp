# FoundryVTT MCP Server Setup Guide

This guide walks you through setting up the FoundryVTT MCP Server.

> **Game System Note:** This fork has been enhanced with PF2e (Pathfinder 2e) specific features:
> alliance detection, full spell slot tracking (prepared/expended), focus point pools, and
> PF2e-aware combat position/LoS tools. It works with any FoundryVTT system but those features
> are PF2e-specific.

---

## Quick Start (Docker — Recommended)

Docker is the recommended way to run the MCP server. It avoids Node.js version management
and process lifecycle issues, and lets you rebuild cleanly after any code change.

### 1. Build the image

```bash
docker build -t foundryvtt-mcp:latest .
```

### 2. Configure Claude Code

Add the MCP server to Claude Code's user config (run once):

```bash
claude mcp add-json -s user foundryvtt '{
  "type": "stdio",
  "command": "docker",
  "args": [
    "run", "--rm", "-i",
    "--add-host=host.docker.internal:host-gateway",
    "-e", "FOUNDRY_URL=http://host.docker.internal:30000",
    "-e", "FOUNDRY_USERNAME=YourUsername",
    "-e", "FOUNDRY_PASSWORD=YourPassword",
    "-e", "LOG_LEVEL=info",
    "foundryvtt-mcp:latest"
  ]
}'
```

Replace `YourUsername`, `YourPassword`, and the URL with your FoundryVTT details.
If FoundryVTT is on a different machine, use its IP/hostname instead of `host.docker.internal`.

### 3. Restart Claude Code

After the first add (or after any `docker build`), restart Claude Code to pick up the new image.

### 4. Verify

Ask Claude: *"What's the current combat state?"* or *"Pull up the battle map"*.

---

## Quick Start (Direct Node.js)

If you prefer to run without Docker:

```bash
npm install
cp .env.example .env   # then edit .env with your credentials
npm run dev
```

> **Node.js version:** This project requires Node.js 18+. If using asdf:
> `PATH="/home/youruser/.asdf/installs/nodejs/22.7.0/bin:$PATH" npm run build`

---

## Connection Setup

The MCP server connects to FoundryVTT via Socket.IO using a standard user account.
No custom modules are required for full game data access.

### Prerequisites

- FoundryVTT running with an **active world** loaded (not on the setup screen)
- A FoundryVTT user account with appropriate permissions

### Configuration

Update your `.env` file (or Docker `-e` flags):

**Local (FoundryVTT on same machine):**
```env
FOUNDRY_URL=http://localhost:30000
FOUNDRY_USERNAME=your_username
FOUNDRY_PASSWORD=your_password
```

**Remote / Reverse Proxy:**
```env
FOUNDRY_URL=https://foundry.example.com
FOUNDRY_USERNAME=your_username
FOUNDRY_PASSWORD=your_password
```

**Local Network:**
```env
FOUNDRY_URL=http://192.168.1.100:30000
FOUNDRY_USERNAME=your_username
FOUNDRY_PASSWORD=your_password
```

---

## Available Tools

### Combat & Tactical

| Tool | Description |
|------|-------------|
| `get_combat_state` | Initiative order, current turn, HP, AC for all combatants |
| `get_combat_positions` | ASCII battle map with walls/doors, grid coords, pairwise distances |
| `check_line_of_sight` | LoS check between two named combatants (accounts for walls/doors) |

### Actors & Characters

| Tool | Description |
|------|-------------|
| `search_actors` | Search by name/type; results include actor IDs |
| `get_actor_details` | Full stat block: speed, saves, strikes, spells, spell slots (PF2e-aware) |

### Scene & World

| Tool | Description |
|------|-------------|
| `get_scene_info` | Scene metadata |
| `search_world` | Cross-collection search (actors, items, scenes, journals) |
| `get_world_summary` | Collection counts |
| `refresh_world_data` | Force re-fetch of world cache |

### Journals, Items, Chat

| Tool | Description |
|------|-------------|
| `search_journals` | Search journal entries by name or content |
| `get_journal` | Fetch a journal with all pages |
| `search_items` | Search items |
| `get_chat_messages` | Recent chat messages |
| `get_users` | User list and online status |

### Dice & Generation

| Tool | Description |
|------|-------------|
| `roll_dice` | Dice rolling (1d20+5, 3d6, etc.) |
| `generate_npc` | Random NPC |
| `generate_loot` | Random loot by CR |
| `lookup_rule` | Rule lookups |

### Diagnostics (requires `FOUNDRY_API_KEY`)

| Tool | Description |
|------|-------------|
| `get_recent_logs` | FoundryVTT server logs |
| `search_logs` | Search logs |
| `get_system_health` | Performance metrics |
| `diagnose_errors` | Error analysis |
| `get_health_status` | Comprehensive health check |

---

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `FOUNDRY_URL` | Yes | FoundryVTT server URL | — |
| `FOUNDRY_USERNAME` | Yes | FoundryVTT username | — |
| `FOUNDRY_PASSWORD` | Yes | FoundryVTT password | — |
| `FOUNDRY_USER_ID` | No | 16-char document `_id` (bypasses username resolution) | — |
| `FOUNDRY_API_KEY` | No | REST API module key (enables diagnostics tools) | — |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error` | `info` |
| `FOUNDRY_TIMEOUT` | No | Request timeout in ms | `10000` |

---

## Rebuild Workflow (Docker)

After any source code change:

```bash
# 1. Build TypeScript
PATH="/home/pinger/.asdf/installs/nodejs/22.7.0/bin:$PATH" npm run build

# 2. Rebuild Docker image
docker build -t foundryvtt-mcp:latest .

# 3. Restart Claude Code
# (new container starts automatically on next tool call)
```

---

## Troubleshooting

### MCP server doesn't appear in Claude Code

- Run `claude mcp list` to check it's registered
- Check `claude mcp get foundryvtt` for the config
- After `docker build`, **restart Claude Code** — the old container won't pick up changes

### "Failed to connect to FoundryVTT"

- FoundryVTT must be running with an **active world** (not the setup screen)
- In Docker: use `host.docker.internal` instead of `localhost`
- Check firewall isn't blocking port 30000

### "Authentication failed"

- Username is **case-sensitive**
- Try setting `FOUNDRY_USER_ID` to the 16-char document `_id` to bypass username resolution
- Check the user has world-level permissions

### "World data not received / empty results"

- A world must be **loaded and active** in FoundryVTT
- Try `refresh_world_data` tool
- Run with `LOG_LEVEL=debug` for verbose output

### Combatant names show as "undefined"

This is fixed — the handler now resolves names via `getRawActor(actorId).name` for FoundryVTT v13+.
If it reappears, ensure you're running the latest Docker image.

### Spell slots all show 0/X

This is fixed — the handler now reads `system.slots.slotN.prepared[].expended` booleans rather
than the legacy `value` field (which PF2e v7+ always sets to 0).

---

## Supported FoundryVTT Versions

- **FoundryVTT v13**: Fully tested (primary target)
- **FoundryVTT v11–v12**: Should work; some PF2e fields may differ
- **Earlier versions**: Not tested

## Supported Game Systems

- **PF2e (Pathfinder 2e)**: Full support including alliance detection, spell slots, focus points
- **Other systems**: Core tools (combat state, scene info, actor search, dice) work for any system;
  PF2e-specific fields gracefully degrade to unavailable

---

**Need more help?** Check `TROUBLESHOOTING.md` or open an issue on GitHub.
