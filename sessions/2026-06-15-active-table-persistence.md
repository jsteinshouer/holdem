# 2026-06-15 Active Table Persistence Planning

Source session:

- `C:\Users\jsteinshouer\.codex\sessions\2026\06\15\rollout-2026-06-15T15-09-06-019ecce6-d9d1-7130-a026-84824d862d29.jsonl`

## Main Goal

The session documented a feature so Tables survive a server restart. The canonical term became **Active Table Persistence**.

## Core Decisions

- Active Table Persistence means a Table, including an in-progress Hand, can survive a server restart.
- Restoration should recover only the latest authoritative Table state, not a full event replay or hand-history model.
- Persisted state should include enough data to restore an in-progress Hand safely, including deck order, board, hole cards, committed bets, current actor, action log, stacks, settlement state, Host identity, participants, and Session Tokens.
- Persisted active Tables should expire after a configurable inactivity window.
- Any successful table-changing command counts as Table activity.
- Passive page views and rejected commands should not extend Table lifetime.
- The server should save synchronously before acknowledging a command and before broadcasting snapshots.
- On restore, mark all participants disconnected and let browsers reconnect with existing Session Tokens.
- If a restored current actor is disconnected and already beyond the grace period, apply the normal auto-check or auto-fold behavior only after startup restore finishes.
- Corrupted or unsupported persisted records should be quarantined. The server should log a redacted startup error and continue running.

## Persistence Shape

- Support SQLite first.
- Put persistence behind a narrow persistence port so another backend can be added later.
- Store a versioned serialized Table state rather than a relational hand-history model.
- Store SQLite data outside the repository by default, with an explicit configurable path.
- Treat persisted active Table state as sensitive operational data because it contains Session Tokens and unrevealed cards.
- Do not require application-level encryption at rest for the first version.

## Configuration Names

- `ACTIVE_TABLE_PERSISTENCE=memory|sqlite`
- `ACTIVE_TABLE_SQLITE_PATH`
- `ACTIVE_TABLE_INACTIVITY_TTL_MS`

## Documentation And Artifacts

- `CONTEXT.md` now defines Active Table Persistence, Table, Hand, and Session Token vocabulary.
- `docs/architecture.md` describes persistence, restore, expiration, and quarantine behavior.
- `docs/requirements.md` captures the product and implementation decisions.
- `docs/adr/0001-sqlite-first-active-table-persistence.md` records the SQLite-first decision.
- `.scratch/friendly-holdem/issues/completed/12-implement-active-table-persistence.md` tracks the implementation work and is now completed.

