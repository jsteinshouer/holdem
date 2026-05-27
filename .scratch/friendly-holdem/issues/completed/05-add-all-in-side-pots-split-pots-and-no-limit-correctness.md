Status: ready-for-human

# Add all-in, side pots, split pots, and no-limit correctness

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Extend the hand flow so no-limit Texas Hold'em works for all-in play and uneven stacks. The server should support all-in actions, create main and side pots, handle split pots, enforce minimum raise behavior, handle all-in raise behavior, reveal only eligible showdown hands, and settle each pot only among eligible players.

## Acceptance criteria

- [x] A player can go all-in with their remaining stack when it is their turn.
- [x] Calling all-in with a shorter stack creates correct pot eligibility.
- [x] Main pots and side pots are created correctly from uneven committed amounts.
- [x] Only eligible players can win each pot.
- [x] Split pots distribute chips correctly, including deterministic odd-chip handling if needed.
- [x] Minimum raise rules are enforced.
- [x] All-in raise behavior does not incorrectly reopen action.
- [x] All-in players who reach showdown reveal their cards.
- [x] Folded players' cards remain hidden.
- [x] Settlement summaries say who won each pot and with what hand.
- [x] Domain tests cover all-in, side-pot creation, side-pot settlement, split pots, minimum raise behavior, and showdown reveal eligibility.

## Blocked by

- `.scratch/friendly-holdem/issues/04-play-basic-betting-hand-through-settlement.md`
