# TODO

## Combat & Battle Planning

- [ ] **Test live combat scenario** — set up a test encounter and validate the full battle planning workflow
- [ ] **Initiative order in combat tracker** — expose turn order, current round, and whose turn it is so Claude can reason about action sequencing
- [ ] **Per-combatant HP/conditions in initiative** — merge combat tracker data with scene actor data so each entry in the turn order shows live HP and active conditions
- [ ] **Condition tracking** — verify PF2e conditions (Stunned, Frightened, Dying, etc.) are read correctly from embedded actor items; test with actors that have active conditions
- [ ] **Hidden token reveal workflow** — test `includeHidden: true` to confirm hidden enemies appear with `[Hidden]` marker before they are revealed to players

## Data Quality

- [ ] **PC max HP** — PF2e computes max HP client-side; investigate whether it is available anywhere in the world snapshot or needs a different approach
- [ ] **Familiar conditions** — verify conditions on familiars are read correctly
- [ ] **Unlinked token HP** — unlinked tokens store HP on the token, not the actor; investigate reading delta HP from token data for accurate current HP

## Tooling

- [ ] **Actor IDs in search results** — `search_actors` does not expose `_id` in output, making it hard to chain into `get_actor_details`; add ID to results
- [ ] **Combat state tool improvements** — `get_combat_state` should include per-combatant HP and conditions, not just initiative order
