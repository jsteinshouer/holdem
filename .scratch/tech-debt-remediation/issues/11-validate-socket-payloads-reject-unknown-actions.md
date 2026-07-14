Status: ready-for-agent
Category: bug

# Validate socket payloads and reject unknown actions

## Parent

`docs/tech-debt-report.md` (P3, item 11)

## What to build

Inbound socket command payloads are trusted by TypeScript type only, with no runtime validation. The player-action handler's `if/else` chain treats any unrecognized `action` string as "all-in" via the final `else` branch. It only affects the sender on their own turn (self-harm, not a cheating vector), but it is surprising and fragile.

Add runtime validation of command payloads at the socket boundary, and reject unknown/illegal actions explicitly instead of defaulting to all-in.

**Test-first:** before the fix, write a failing test showing an unknown action string is currently resolved to all-in.

## Acceptance criteria

- [ ] A failing test shows an unrecognized `action` string currently resolves to all-in.
- [ ] Inbound command payloads are validated at the socket boundary; malformed payloads are rejected with the standard command-rejected response.
- [ ] Unknown/illegal actions are rejected explicitly (no implicit all-in fallback).
- [ ] The reproduction test passes; all legal actions continue to work.

## Blocked by

- None - can start immediately
