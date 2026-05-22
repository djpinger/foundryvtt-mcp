# Changelog

## Unreleased

### Features

* **feat(docker):** add Dockerfile and .dockerignore for containerized MCP deployment
  - `docker build -t foundryvtt-mcp:latest .` is now the recommended build/deploy path
  - Multi-stage build: TypeScript compiled in `build` stage, production deps only in `runtime`
  - `--ignore-scripts` avoids husky failures in CI/Docker environment
  - Credentials passed via `-e` env flags; `.env` never enters the image

* **feat(tools): add `get_combat_positions` tool**
  - ASCII battle map with grid coordinates and alliance markers (P=Party, E=Enemy, N=Neutral)
  - Wall and door rendering (`─────`, `│`, `D` closed, `d` open, `L` locked)
  - Pairwise distance table grouped by range bracket (melee/close/far)
  - Cross-faction distances marked with ⚔️
  - Uses raw `getScenes()` data to preserve token array (not `getCurrentScene()` which strips it)
  - Token deduplication by `tokenId` (not `actorId`) to correctly place multiple instances of same actor

* **feat(tools): add `check_line_of_sight` tool**
  - Checks LoS between two named combatants (partial name match)
  - Pixel-space segment intersection using CCW algorithm against all scene walls
  - Open doors are transparent; closed and locked doors block
  - Returns clear/blocked with list of obstructing wall grid coordinates

* **feat(handlers/actors): full PF2e stat block in `get_actor_details`**
  - Speed (land + other movement types)
  - Saving throws, perception, ability modifiers
  - Immunities, resistances, weaknesses
  - Strikes with attack bonus and damage rolls
  - Spellcasting entries with per-rank slot breakdown (reads `prepared[].expended` booleans,
    not the legacy `value` field which is always 0 in PF2e v7+)
  - Focus spell pool (`system.resources.focus.value/max`) and focus spell list
  - All powered by `getRawActor()` for direct access to `system.*` fields

* **feat(handlers/actors): `search_actors` now returns actor IDs**
  - Each result now includes `` ID: `actorId` `` for use with `get_actor_details`

* **feat(handlers/combat): resolve combatant names in FoundryVTT v13+**
  - v13+ PF2e combatants no longer carry a `name` field on the combatant document
  - Names now resolved via `getRawActor(c.actorId).name`
  - HP and AC also pulled from actor system data

* **feat(handlers/combat): PF2e alliance detection**
  - Checks `actor.system.details.alliance` first (`"party"` / `"opposition"` / `"neutral"`)
  - Falls back to token `disposition` (-1 hostile / 0 neutral / 1 friendly) for non-PF2e actors

### Bug Fixes

* **fix(index): correct MCP startup order**
  - `server.connect(transport)` now called before `foundryClient.connect()`
  - Prevents Claude Code initialize handshake from timing out while FoundryVTT connects

* **fix(logger): route all log output to stderr**
  - All `debug/info/warn/error` methods now use `process.stderr.write()`
  - Stdout is reserved for MCP JSON-RPC only; any stdout pollution corrupts the protocol

* **fix(types): mark combatant `name` field optional**
  - `WorldCombat.combatants[].name` is now `name?: string` to reflect v13+ reality

---

## [1.0.1](https://github.com/laurigates/foundryvtt-mcp/compare/foundryvtt-mcp-v1.0.0...foundryvtt-mcp-v1.0.1) (2026-03-13)


### Bug Fixes

* use brace-wrapped env var syntax in MCP config ([#119](https://github.com/laurigates/foundryvtt-mcp/issues/119)) ([6708348](https://github.com/laurigates/foundryvtt-mcp/commit/6708348c017c3cc314ad3bafd0de057aea170042))

## [1.0.0](https://github.com/laurigates/foundryvtt-mcp/compare/foundryvtt-mcp-v0.11.0...foundryvtt-mcp-v1.0.0) (2026-03-07)


### ⚠ BREAKING CHANGES

* The foundry-local-rest-api module has been moved to its own repository to improve focus and enable independent versioning.

### Features

* Add Foundry Local REST API module ([7f8383a](https://github.com/laurigates/foundryvtt-mcp/commit/7f8383a9b54b3c374d960aad7f97b0b5ecff7d6d))
* add FoundryVTT v13 compatibility and API key configuration UI ([#20](https://github.com/laurigates/foundryvtt-mcp/issues/20)) ([c61559f](https://github.com/laurigates/foundryvtt-mcp/commit/c61559f758a14f4e1bb0d756b88758c10f120760))
* add serena-mcp configuration and Claude plugin setup ([#88](https://github.com/laurigates/foundryvtt-mcp/issues/88)) ([14bbdad](https://github.com/laurigates/foundryvtt-mcp/commit/14bbdade589afc4ff47348482797516960dd890f))
* Bump module version to 0.7.0 ([#27](https://github.com/laurigates/foundryvtt-mcp/issues/27)) ([cf1a38b](https://github.com/laurigates/foundryvtt-mcp/commit/cf1a38bde8b582833afcedae52dcce37929b2eb1))
* **ci:** migrate to npm trusted publishing (OIDC) ([#113](https://github.com/laurigates/foundryvtt-mcp/issues/113)) ([cf64b93](https://github.com/laurigates/foundryvtt-mcp/commit/cf64b93a3f407e58b5e57fff95293126051e53a5))
* **core:** refactor MCP server architecture with proper Socket.IO authentication ([#89](https://github.com/laurigates/foundryvtt-mcp/issues/89)) ([2e7640d](https://github.com/laurigates/foundryvtt-mcp/commit/2e7640d0f5e0b6e826a9804dca3bee0607d419de)), closes [#82](https://github.com/laurigates/foundryvtt-mcp/issues/82)
* extract foundry-local-rest-api module to standalone repository ([#84](https://github.com/laurigates/foundryvtt-mcp/issues/84)) ([4aae7d9](https://github.com/laurigates/foundryvtt-mcp/commit/4aae7d9e9ec73f3e8b886d020d9e42355c404313))
* **foundry-local-rest-api:** add local REST API module for FoundryVTT ([ad8b506](https://github.com/laurigates/foundryvtt-mcp/commit/ad8b5060ca231ffefa389cad1e6c8f68f4a4e069))
* improve UX with setup wizard, diagnostics, and enhanced error handling ([#34](https://github.com/laurigates/foundryvtt-mcp/issues/34)) ([92ba522](https://github.com/laurigates/foundryvtt-mcp/commit/92ba5225abd1b7519d8401596112171e8324b3d2))
* **justfile:** add npm-token and publish-dry-run recipes ([#111](https://github.com/laurigates/foundryvtt-mcp/issues/111)) ([39a41f7](https://github.com/laurigates/foundryvtt-mcp/commit/39a41f7c481695cf363eb0952ed013bb339c5c5c))
* modernize tool system with schema validation, caching, and enhanced WebSocket events ([#79](https://github.com/laurigates/foundryvtt-mcp/issues/79)) ([dbbfc9f](https://github.com/laurigates/foundryvtt-mcp/commit/dbbfc9f0670f8dbbfd14c53b9a63f1edb712caac))
* rename package to foundryvtt-mcp and add bin entry ([#114](https://github.com/laurigates/foundryvtt-mcp/issues/114)) ([fdc5b60](https://github.com/laurigates/foundryvtt-mcp/commit/fdc5b60000f0ca6602995f6eb3497b91065b6437))
* **test:** add integration test suite with real FoundryVTT container ([#92](https://github.com/laurigates/foundryvtt-mcp/issues/92)) ([b5c168e](https://github.com/laurigates/foundryvtt-mcp/commit/b5c168e7893f32a531a5f3bb8f9a78b02b1871ab))
* **test:** comprehensive E2E testing framework and development tooling + type safety improvements ([#74](https://github.com/laurigates/foundryvtt-mcp/issues/74)) ([0a4c856](https://github.com/laurigates/foundryvtt-mcp/commit/0a4c856b76c6fcec5e2dad3675c684df0ed7f353))


### Bug Fixes

* **author:** update author email ([#12](https://github.com/laurigates/foundryvtt-mcp/issues/12)) ([06e3895](https://github.com/laurigates/foundryvtt-mcp/commit/06e38952cce20a6517725f4a6dc7bbdf9c044661))
* **config:** replace hardcoded port 30000 with proper URL handling for reverse proxy setups ([#67](https://github.com/laurigates/foundryvtt-mcp/issues/67)) ([f6e219a](https://github.com/laurigates/foundryvtt-mcp/commit/f6e219a0dc0d2effe31f52462e67593f16da140e))
* improve config layout ([#40](https://github.com/laurigates/foundryvtt-mcp/issues/40)) ([f6496e2](https://github.com/laurigates/foundryvtt-mcp/commit/f6496e295345eed2b1203a630a482797f1f6d16d))
* resolve integration test timeouts by adding missing apiKey configuration ([#53](https://github.com/laurigates/foundryvtt-mcp/issues/53)) ([0a46713](https://github.com/laurigates/foundryvtt-mcp/commit/0a46713d72311c0542a19336f2b90186d394ee08))
* resolve issue [#43](https://github.com/laurigates/foundryvtt-mcp/issues/43) - FoundryClient connection lifecycle ([#46](https://github.com/laurigates/foundryvtt-mcp/issues/46)) ([9c315d6](https://github.com/laurigates/foundryvtt-mcp/commit/9c315d6a1ff1b38de7b537a900ef3bdff197d4b9))
* resolve issue [#44](https://github.com/laurigates/foundryvtt-mcp/issues/44) - WebSocket functionality not working properly ([#48](https://github.com/laurigates/foundryvtt-mcp/issues/48)) ([ae93be9](https://github.com/laurigates/foundryvtt-mcp/commit/ae93be918ce0f281f942bad292dda45eac37c8a7))
* resolve test failures and improve error handling ([#63](https://github.com/laurigates/foundryvtt-mcp/issues/63)) ([ca8d01f](https://github.com/laurigates/foundryvtt-mcp/commit/ca8d01f8039ce3493c08b96b27f8df9e7aa53e31))
* Update module metadata and URLs ([#9](https://github.com/laurigates/foundryvtt-mcp/issues/9)) ([06aeed4](https://github.com/laurigates/foundryvtt-mcp/commit/06aeed46e584ba4c68762934110ea22a6566c5fb))
