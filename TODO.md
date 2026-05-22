# TODO

## Upstream Contribution Goal

The long-term intent of this fork is to **contribute improvements back to
[laurigates/foundryvtt-mcp](https://github.com/laurigates/foundryvtt-mcp)**
rather than maintain a permanent parallel repository.

Once the PF2e-specific features have been tested in real sessions and proven
stable, the plan is to open pull requests upstream so the community benefits
and we can retire this fork.

### Candidates for upstream PRs

| Change | Status | Notes |
|--------|--------|-------|
| `fix(logger)`: all output to stderr | ✅ stable | Breaks MCP protocol if stdout is polluted; clear upstream bug |
| `fix(index)`: MCP transport before FoundryVTT connect | ✅ stable | Prevents Claude Code initialize timeout |
| `fix(types)`: combatant `name` optional for v13+ | ✅ stable | FoundryVTT v13 / PF2e reality |
| `feat(handlers/actors)`: actor IDs in search results | ✅ stable | Quality-of-life, system agnostic |
| `feat(tools)`: `get_combat_positions` battle map | 🧪 testing | PF2e alliance detection is system-specific; may need a generic version |
| `feat(tools)`: `check_line_of_sight` | 🧪 testing | Needs more real-session validation |
| `feat(handlers/actors)`: full PF2e stat block | 🧪 testing | PF2e-specific; upstream may want a generic + system-plugin approach |
| `feat(docker)`: Dockerfile + .dockerignore | 🧪 testing | Useful for anyone running via Claude Code |

### Process

1. Run features through several real sessions to catch edge cases
2. Open individual focused PRs (one feature/fix per PR)
3. Engage with upstream maintainer on system-specific vs generic design
4. Once accepted upstream, archive this fork and switch back to the original

---

*This file is tracked in git as a statement of intent, not a binding commitment.*
