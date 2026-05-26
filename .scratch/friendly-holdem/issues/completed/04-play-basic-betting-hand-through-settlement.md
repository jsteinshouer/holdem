Status: completed

# Play a basic betting hand through settlement

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Implement a complete basic hand flow without all-in side-pot complexity. Players can fold, check, call, and raise through preflop, flop, turn, and river. The server validates each action, advances betting rounds, reveals public community cards, evaluates showdown through the hand evaluator adapter, settles the winner for simple pots, and updates all clients with player-specific snapshots and a public action log.

## Acceptance criteria

- [x] Current actor can fold, check, call, or raise when legal.
- [x] Illegal actions are rejected with safe reasons and do not mutate table state.
- [x] Bets and stacks update correctly for fold, check, call, and raise.
- [x] Betting rounds advance correctly from preflop to flop, turn, river, and showdown.
- [x] Community cards are dealt publicly at the correct streets.
- [x] If all but one player folds, the remaining player wins without revealing hole cards.
- [x] At simple showdown, eligible hands are revealed and the winning hand is selected through the evaluator adapter.
- [x] Simple pots are awarded and stacks update correctly.
- [x] Public action log records blinds, folds, checks, calls, raises, street deals, and settlement summaries.
- [x] Client UI allows legal player actions and updates all connected clients after each successful action.
- [x] Domain tests cover legal action calculation, betting progression, fold-to-win, simple showdown, and simple settlement.

## Blocked by

- `.scratch/friendly-holdem/issues/03-start-hand-and-deal-cards.md`
