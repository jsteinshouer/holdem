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

- [x] A failing regression test reproduces the deadlock: heads-up, the button/small-blind posts an all-in blind, and the hand cannot currently reach settlement.
- [x] Preflop first-actor selection skips all-in and folded seats.
- [x] When fewer than two players can voluntarily act after blinds, the hand runs the board out and settles without further input. (Correctly scoped: a lone live player who still owes a call keeps the action rather than being run out.)
- [~] The reproduction test passes after the fix: the table reaches `settled` (asserted). The "next hand can be dealt" recovery half is not yet asserted — see Comments (P3).
- [x] Existing betting, turn-order, blind-rotation, and side-pot tests still pass. (100 server tests pass; `tsc -b` clean.)

## Blocked by

- None - can start immediately

## Comments

- Implemented in `createHand` (`apps/server/src/tableStore.ts`): first actor chosen via `nextActorSeat` (skips all-in/folded seats); board is run out via the existing `advanceBettingRound` only when betting is genuinely closed — every player all-in, or the single live player has already matched the current bet. Tests added in `tableStore.test.ts`: the original heads-up all-in-blind run-out plus three adjacent-scenario guards (live SB owing vs. all-in BB, live button owing behind two all-in blinds, both blinds all-in).
- Reviewed twice by the texas-holdem-reviewer agent. Round 1 found a P1 (an over-broad run-out guard denied a lone live player who still owed a call); corrected and re-reviewed → PASS-WITH-NITS.
- Remaining P3 nit: no test calls `dealNextHand` after an auto-run settlement to prove full recovery. Deterministic assertion is awkward because the run-out board is dealt inside `createHand` (no deck-injection seam at deal time) and in the both-all-in cases a player busts and is sat out. Left open intentionally; revisit if a clean recovery seam is added.
