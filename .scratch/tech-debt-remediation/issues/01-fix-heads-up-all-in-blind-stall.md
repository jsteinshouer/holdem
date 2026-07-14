Status: ready-for-agent
Category: bug

# Fix heads-up all-in blind stall

## Parent

`docs/tech-debt-report.md` (P0, item 1)

## What to build

A hand must never open with an all-in player as the current actor and no way to advance. In heads-up play the button is also the small blind and acts first preflop; when that player's stack is at or below the small blind, posting the blind drives them all-in, and the engine still selects that all-in seat as the first actor. Every advance path (player action, disconnected auto-act, bot, host auto-fold, deal-next) then bails, so the table deadlocks with no in-app recovery.

Fix the preflop first-actor selection to skip all-in and folded seats, and when fewer than two players can voluntarily act after blinds are posted, run the board out to showdown/settlement automatically — consistent with the existing everyone-all-in run-out behavior.

**Test-first:** before touching the fix, write a failing regression test that reproduces the deadlock (heads-up, button/small-blind stack at or below the small blind) and demonstrates the hand cannot advance.

## Acceptance criteria

- [ ] A failing regression test reproduces the deadlock: heads-up, the button/small-blind posts an all-in blind, and the hand cannot currently reach settlement.
- [ ] Preflop first-actor selection skips all-in and folded seats.
- [ ] When fewer than two players can voluntarily act after blinds, the hand runs the board out and settles without further input.
- [ ] The reproduction test passes after the fix: the table reaches `settled` and the next hand can be dealt.
- [ ] Existing betting, turn-order, blind-rotation, and side-pot tests still pass.

## Blocked by

- None - can start immediately
