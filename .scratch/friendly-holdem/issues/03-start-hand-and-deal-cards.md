Status: ready-for-agent

# Start a hand and deal private/public cards

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Implement the first active-hand path. The host can start the first hand when at least two players are seated. The server shuffles locally, posts blinds, deals private hole cards, initializes the betting round, and sends player-specific snapshots that show each seated player only their own hole cards while exposing public table and hand state.

## Acceptance criteria

- [ ] The host can start the first hand when at least 2 players are seated.
- [ ] Non-hosts cannot start the hand and receive a safe rejection reason.
- [ ] The server creates a 52-card unique shuffled deck locally.
- [ ] The server deals two hole cards to each active seated player.
- [ ] The server posts small blind and big blind using configured defaults.
- [ ] Heads-up blind and button setup is handled correctly for two-player tables.
- [ ] Initial current actor and legal actions are calculated for preflop.
- [ ] Player-specific snapshots show only the viewer's own hole cards.
- [ ] Other players' hole cards are never sent to unauthorized clients.
- [ ] The client renders current phase, seats, stacks, blinds, current actor, board area, and the viewer's own hole cards.
- [ ] Domain tests cover deck uniqueness, blind posting, dealing, current actor, and hidden-card snapshot privacy.

## Blocked by

- `.scratch/friendly-holdem/issues/02-create-and-join-private-table.md`
