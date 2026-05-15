Status: ready-for-agent

# Support repeated hands and between-hand table management

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Turn the single-hand experience into a persistent private table. After a hand settles, the host can deal the next hand. Player stacks carry forward, dealer button and blinds rotate, sitting out and rejoining happen only between hands, busted players are not dealt in by default, and host controls manage rebuys, spectators, and inactive players without altering active hand results.

## Acceptance criteria

- [ ] After settlement, the host can deal the next hand.
- [ ] Non-hosts cannot deal the next hand.
- [ ] Player stacks carry forward between hands.
- [ ] Dealer button and blinds rotate correctly between hands.
- [ ] Sitting out is allowed only between hands.
- [ ] Rejoining is allowed only between hands.
- [ ] Sitting-out players are skipped for dealing and blinds.
- [ ] Busted players are sitting out by default and are not dealt into the next hand.
- [ ] Host-approved rebuys restore eligible players to the configured starting stack between hands.
- [ ] Host can seat spectators into open auto-assigned seats between hands.
- [ ] Host can remove inactive players between hands.
- [ ] Host controls cannot alter cards, pots, hand results, or another player's completed action.
- [ ] Tests cover repeated hands, button/blind rotation, sit out/rejoin, busted state, host-approved rebuys, and spectator seating.

## Blocked by

- `.scratch/friendly-holdem/issues/05-add-all-in-side-pots-split-pots-and-no-limit-correctness.md`
