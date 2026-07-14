Status: ready-for-agent
Category: refactor

# Share cross-tier constants via packages/shared

## Parent

`docs/tech-debt-report.md` (P2, item 9)

## What to build

The maximum seat count (6), maximum display-name length (32), and maximum chat-message length (180) are hardcoded independently on both the server (validation) and the client (input `maxLength`/labels). Raising a limit on one side silently disagrees with the other. These are exactly the shared wire invariants `packages/shared` exists for.

Export the constants from `packages/shared` and consume them in both apps so there is one source of truth.

## Acceptance criteria

- [ ] Seat-count, display-name-length, and chat-length limits are defined once in `packages/shared`.
- [ ] Server validation and client inputs/labels both consume the shared constants; no duplicated literals remain.
- [ ] Changing a limit in one place updates both tiers.
- [ ] Existing tests pass.

## Blocked by

- None - can start immediately
