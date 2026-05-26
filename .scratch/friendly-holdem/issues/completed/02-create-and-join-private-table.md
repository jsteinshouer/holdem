Status: ready-for-human

# Create and join a private table

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Implement the first end-to-end private table path. A host can create a table, receive a shareable private invite link, and friends can join with display names. The server creates an in-memory table with a high-entropy invite ID, auto-seats players before the first hand, supports spectators when seating is unavailable or play has started, stores browser session tokens for reconnect identity, and emits safe player-specific table snapshots.

## Acceptance criteria

- [x] A host can create a private table from the client.
- [x] The server creates the table in memory and assigns the creator as host.
- [x] The host receives a shareable invite link containing a high-entropy table ID.
- [x] A participant can join the table from the invite link with a display name and no account.
- [x] Participants are auto-seated before the first hand until the table has 6 seated players.
- [x] Participants beyond seat capacity join as spectators.
- [x] The server issues and accepts browser-held session tokens for reconnect identity.
- [x] Table snapshots include viewer role, host status, seats, seated player summaries, spectator information, and available non-hand controls.
- [x] Snapshots do not contain hidden cards or any future hand-private information.
- [x] Basic client UI shows create-table, join-table, seated players, spectators, and host identity.
- [x] Unit or integration tests cover table creation, joining, auto-seating, spectator behavior, and session token reconnect identity.

## Blocked by

- `.scratch/friendly-holdem/issues/01-scaffold-friendly-holdem-monorepo.md`
