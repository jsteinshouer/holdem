Status: ready-for-agent
Category: refactor

# Split the tableStore god-module

## Parent

`docs/tech-debt-report.md` (P2, item 6)

## What to build

`tableStore.ts` is ~1,886 lines spanning at least five responsibilities: the session/orchestration store, the game engine (dealing, betting, street progression, showdown, pot building), the hand evaluator, persistence serialization/validation, the CSPRNG, and string utilities. Any change forces a reader to hold the entire poker domain in their head, and the pure, highly-testable pieces are buried next to socket-session bookkeeping.

Decompose it into cohesive modules — e.g. `gameEngine`, `tableSerialization`, `random` — keeping the hand evaluator in the shared module (see `04-share-hand-evaluator-between-engine-and-bot`), and leave `tableStore.ts` as a thin orchestration facade. Pure structural refactor with no behavior change; the free functions already take explicit parameters, so extraction is low-risk.

## Acceptance criteria

- [x] `tableStore.ts` is decomposed into focused modules with clear single responsibilities and is substantially smaller (an orchestration facade).
- [x] The game-engine functions are importable and unit-testable in isolation.
- [x] No behavior change: all existing server tests pass unchanged.
- [x] Persistence serialize/deserialize round-trips remain correct.

## Blocked by

- Eased by `04-share-hand-evaluator-between-engine-and-bot` (do that first so the evaluator is already extracted). Not a hard blocker.

## Comments

- 2026-07-15 — Reviewer verdict: PASS-WITH-NITS. All four acceptance criteria verified and checked.
  - `tableStore.ts` decomposed 1782 -> 1031 lines; extracted `gameEngine.ts` (506), `tableSerialization.ts` (156), `random.ts` (53), `tableTypes.ts` (81, added to break an import cycle). tableStore is now a session/orchestration facade that re-exports the moved public symbols (`Participant`, `PrivateTable`, `SerializedActiveHand`, `SerializedActiveTableState`, `createDeck`). All consumers (`index.ts`, `realtime.ts`, `botScheduler.ts`, `activeTablePersistence.ts`, tests) resolve unchanged.
  - Game-engine functions are importable in isolation: `gameEngine.test.ts` imports `buildPots`/`legalActionsFor` directly from `./gameEngine.js` (not via `createTableStore`).
  - Behavior-preserving: normalized diffs of the moved engine, serialization, and random functions against HEAD show zero new/altered logic lines. No tracked test file was modified (`git diff HEAD --name-only` has no test files); `gameEngine.test.ts` is purely additive.
  - Validation: `pnpm typecheck` (tsc -b) clean; `pnpm --filter @friendly-holdem/server test` = 110/110 passing (8 files), including unchanged `tableStore.test.ts` (58) and round-trip restore coverage in `activeTablePersistence.test.ts` (8).
  - No runtime import cycle: the `activeTablePersistence` -> `tableStore` edge is `import type` only (erased at runtime).
  - Nit (P3, non-blocking): snapshot building was deliberately kept in `tableStore.ts` as a view concern coupled to store-only helpers. This is a reasonable stopping point; a future `tableSnapshot` extraction could shrink the facade further but is not required to satisfy this issue.
