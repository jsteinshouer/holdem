Status: ready-for-agent
Category: refactor

# Share one hand evaluator between engine and bot

## Parent

`docs/tech-debt-report.md` (P1, item 4)

## What to build

The poker hand-ranking logic — the rank-value table, straight/wheel high-card detection, and made-hand category detection — is implemented twice: once in the settlement engine and once in the bot strategy, whose own comment admits it "mirrors the server hand evaluator." Two independent implementations that must stay in lockstep are a correctness landmine: a rules fix in one place makes the bot and settlement disagree on who won.

Extract a single authoritative hand evaluator into `packages/shared` and have both the engine and the bot import it. This is a pure refactor (no behavior change) and a down-payment on the later `tableStore.ts` split.

## Acceptance criteria

- [x] A single shared hand-evaluator module in `packages/shared` exposes rank values, straight/wheel detection, and category ranking/comparison.
- [x] Both the settlement engine and the bot strategy consume the shared evaluator; the duplicated implementations are removed.
- [x] No behavior change: existing hand-evaluation and bot-decision tests pass unchanged.
- [x] Direct unit tests on the shared evaluator cover wheel straight, straight flush, full house, quads, two pair, and tie comparison.

## Blocked by

- None - can start immediately (unblocks/eases `06-split-tablestore-god-module`)

## Comments

- 2026-07-14 (reviewer): PASS. Shared `packages/shared/src/handEvaluator.ts` is the single
  authoritative evaluator consumed by both the engine (`tableStore.ts` via `evaluateHand`/
  `compareHandScores`) and the bot (`botStrategy.ts` via `handCategory`/`rankValue`); all
  duplicate implementations removed. `evaluateHand`/`straightHighCard`/`rankValue`/`topRanks`/
  `compareHandScores` are byte-identical to the former tableStore versions, so settlement is
  unchanged. Verified the non-obvious equivalence that the bot's former `bestHandCategory(cards)`
  equals `evaluateHand(cards)[0]` for all inputs (branch-by-branch: quads-before-boat, the full
  house condition incl. two sets of trips, and three-pair collapsing to two pair all agree).
  Validation: `pnpm typecheck` clean; shared suite 9 tests pass (8 new handEvaluator tests
  covering wheel, straight flush, full house/two-trips, quads, two pair, tie comparison); server
  suite 105 tests pass, including the 17 bot-decision and 58 tableStore tests unchanged (no test
  files modified). All acceptance criteria met.
