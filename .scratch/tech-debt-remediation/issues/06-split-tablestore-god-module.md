Status: ready-for-agent
Category: refactor

# Split the tableStore god-module

## Parent

`docs/tech-debt-report.md` (P2, item 6)

## What to build

`tableStore.ts` is ~1,886 lines spanning at least five responsibilities: the session/orchestration store, the game engine (dealing, betting, street progression, showdown, pot building), the hand evaluator, persistence serialization/validation, the CSPRNG, and string utilities. Any change forces a reader to hold the entire poker domain in their head, and the pure, highly-testable pieces are buried next to socket-session bookkeeping.

Decompose it into cohesive modules — e.g. `gameEngine`, `tableSerialization`, `random` — keeping the hand evaluator in the shared module (see `04-share-hand-evaluator-between-engine-and-bot`), and leave `tableStore.ts` as a thin orchestration facade. Pure structural refactor with no behavior change; the free functions already take explicit parameters, so extraction is low-risk.

## Acceptance criteria

- [ ] `tableStore.ts` is decomposed into focused modules with clear single responsibilities and is substantially smaller (an orchestration facade).
- [ ] The game-engine functions are importable and unit-testable in isolation.
- [ ] No behavior change: all existing server tests pass unchanged.
- [ ] Persistence serialize/deserialize round-trips remain correct.

## Blocked by

- Eased by `04-share-hand-evaluator-between-engine-and-bot` (do that first so the evaluator is already extracted). Not a hard blocker.
