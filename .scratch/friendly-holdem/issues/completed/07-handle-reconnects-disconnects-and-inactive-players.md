Status: ready-for-agent

# Handle reconnects, disconnects, and inactive players

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Implement resilience for browser refreshes, disconnects, and idle players. Participants can reconnect to the same identity with their session token. Disconnected players keep their seat, action on disconnected players waits for a grace period, then auto-checks when legal or auto-folds otherwise. The host can auto-fold the current actor after 2 minutes of inactivity, while all-in players remain eligible for pots.

## Acceptance criteria

- [x] Refreshing or reconnecting with the same browser session restores the participant identity.
- [x] Reconnected seated players return to the same seat when the table still exists in memory.
- [x] Reconnected spectators return as spectators.
- [x] Disconnected players remain seated during an active hand.
- [x] When action reaches a disconnected player, the server waits for the configured grace period.
- [x] After the grace period, the server auto-checks if checking is legal.
- [x] If checking is not legal, the server auto-folds.
- [x] Disconnected all-in players remain eligible for pots and cannot be auto-folded out of committed pots.
- [x] If the current connected actor has not acted after 2 minutes, the host can auto-fold them.
- [x] Host auto-fold is rejected before the 2-minute threshold or when the target is all-in.
- [x] Snapshots show useful connection, sitting-out, and inactive statuses.
- [x] Tests cover reconnect identity, disconnect state, grace auto-check/fold, host auto-fold threshold, and all-in disconnect eligibility.

## Blocked by

- `.scratch/friendly-holdem/issues/06-support-repeated-hands-and-table-management.md`
