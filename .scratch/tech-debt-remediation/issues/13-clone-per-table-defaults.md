Status: ready-for-agent
Category: refactor

# Clone per-table defaults

## Parent

`docs/tech-debt-report.md` (P3, item 13)

## What to build

All in-memory tables store the same `defaults` object by reference, while restored (deserialized) tables get their own copy. Access is read-only today so no bug manifests, but the behavior is inconsistent between fresh and restored tables and is a latent cross-table leak if `defaults` ever becomes mutable per-table.

Shallow-clone `defaults` when creating a table so each table owns its own copy.

## Acceptance criteria

- [ ] Each table owns its own `defaults` object (fresh and restored tables behave identically).
- [ ] Mutating one table's `defaults` cannot affect another table.
- [ ] Existing tests pass.

## Blocked by

- None - can start immediately
