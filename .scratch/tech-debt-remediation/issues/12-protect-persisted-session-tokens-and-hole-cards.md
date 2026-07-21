Status: ready-for-agent
Category: security

# Protect persisted session tokens and hole cards in sqlite mode

## Parent

`docs/tech-debt-report.md` (P3, item 12)

## What to build

In `sqlite` persistence mode the serialized active-table state — which includes every participant's session token and the live deck/hole cards — is written unencrypted to a file under the OS temp dir with default permissions. On a shared host, another local user could read tokens (and impersonate players) or see hole cards mid-hand. Negligible on a single-tenant deploy, but worth closing.

Write the sqlite file under a private application directory with restrictive permissions, and reconsider whether session tokens and the live deck need to be persisted at all.

## Acceptance criteria

- [ ] The sqlite persistence file is created under a non-world-readable location with restrictive file permissions.
- [ ] Documentation notes the sensitivity of the persisted state and the shared-host caveat.
- [ ] If adopted: session tokens and/or the live deck are excluded from or protected in the persisted blob without breaking restore.
- [ ] Persistence restore tests still pass.

## Blocked by

- None - can start immediately
