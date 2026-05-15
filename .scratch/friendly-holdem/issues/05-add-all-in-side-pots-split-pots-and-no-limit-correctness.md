Status: ready-for-agent

# Add all-in, side pots, split pots, and no-limit correctness

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Extend the hand flow so no-limit Texas Hold'em works for all-in play and uneven stacks. The server should support all-in actions, create main and side pots, handle split pots, enforce minimum raise behavior, handle all-in raise behavior, reveal only eligible showdown hands, and settle each pot only among eligible players.

## Acceptance criteria

- [ ] A player can go all-in with their remaining stack when it is their turn.
- [ ] Calling all-in with a shorter stack creates correct pot eligibility.
- [ ] Main pots and side pots are created correctly from uneven committed amounts.
- [ ] Only eligible players can win each pot.
- [ ] Split pots distribute chips correctly, including deterministic odd-chip handling if needed.
- [ ] Minimum raise rules are enforced.
- [ ] All-in raise behavior does not incorrectly reopen action.
- [ ] All-in players who reach showdown reveal their cards.
- [ ] Folded players' cards remain hidden.
- [ ] Settlement summaries say who won each pot and with what hand.
- [ ] Domain tests cover all-in, side-pot creation, side-pot settlement, split pots, minimum raise behavior, and showdown reveal eligibility.

## Blocked by

- `.scratch/friendly-holdem/issues/04-play-basic-betting-hand-through-settlement.md`
