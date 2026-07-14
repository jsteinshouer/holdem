Status: ready-for-agent
Category: refactor

# Minor cleanups (alias fn, error typing, dead statements)

## Parent

`docs/tech-debt-report.md` (P3, item 15)

## What to build

A basket of low-risk hygiene fixes surfaced during the audit:

- The participant-lookup helper has a redundant alias (`requireParticipant` duplicating `participantById`) — collapse to a single named function.
- Command rejections are stringly-typed: thrown `Error` message strings double as the user-facing wire `reason`, so the transport layer cannot distinguish "not your turn" from "table not found" except by matching strings. Introduce error codes/types alongside the human-readable message.
- The realtime connection handler keeps `void activeTableId` / `void activeParticipantId` statements — dead assignments retained only to satisfy the compiler. Remove them.

## Acceptance criteria

- [ ] The redundant participant-lookup alias is removed (single named function).
- [ ] Command rejections carry a machine-distinguishable code/type in addition to the user-facing message.
- [ ] The dead `void` assignments in the realtime handler are removed.
- [ ] Existing tests pass.

## Blocked by

- None - can start immediately
