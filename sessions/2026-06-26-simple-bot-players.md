# 2026-06-26 Simple Bot Players

Sources:

- `.scratch/friendly-holdem/issues/13-add-simple-bot-players.md` (grilled issue brief)
- Uncommitted working tree: `apps/server/src/botStrategy.ts`, `apps/server/src/botStrategy.test.ts`, and changes to `apps/server/src/tableStore.ts`, `apps/server/src/index.ts`, `packages/shared/src/index.ts`, `apps/client/src/main.tsx`.

> Status as of this summary: implemented but **not yet committed** (working-tree WIP on top of the persistence work).

## Main Goal

Add simple, rule-based computer opponents a host can seat in empty seats, so friends can play when only one or two humans are online. Bots take legal actions on their turn, count toward the 2-to-6 seat limits and the 2-player start minimum, and are clearly labeled.

## Core Decisions

- Bot decisions live in a pure, rule-based `BotStrategy` behind a narrow interface, so a later strategy (e.g. a local model) can replace it without touching seating, timing, or persistence.
- A **local small language model was considered and deferred**: in the single always-on Node service it adds hosting weight, inference latency, memory pressure, and non-determinism, and would still need a rule-based fallback. The seam keeps that path open.
- One "simple" skill level for now; tunable constants live in easy-to-change config.
- Hosts add bots only **between hands** and only to empty seats; host powers still cannot alter cards, pots, or results.
- Busted bots **sit out** and return only through the existing host rebuy-approval flow.
- Bots are exempt from inactivity auto-fold and disconnected-action grace timers; never treated as inactive or disconnected.
- Play **pauses when no human is connected** and resumes on reconnect; at least one human must be present to advance.
- Bots persist as part of the versioned active-table state and re-arm the scheduler on startup restore so a restored mid-hand bot actor does not deadlock.
- Bots never post chat; their actions appear in the public action log like any player.

## Implementation Shape

- **Strategy** (`botStrategy.ts`): pure `BotStrategy` ({ `id`, `decide(context)` }) returning one legal action with an optional `raiseTo`. Decisions use estimated hand strength (preflop starting-hand quality; postflop best made-hand category), pot odds, and position, with bounded jitter from an injected `random()`.
  - `createSimpleBotStrategy(overrides)` with `DEFAULT_SIMPLE_BOT_CONSTANTS` (fold/raise thresholds, 0.5–0.75 pot-fraction raise sizing, randomness, position aggression). Strategy id `simple-v1`.
  - `createSeededRandom(seed)` is a mulberry32 PRNG for reproducible, seeded decisions in tests.
  - Raises are sized as a pot fraction, clamped to the legal minimum raise and remaining stack; sizing that meets/exceeds stack becomes a clean all-in.
- **Server runtime** (`index.ts`): a `host:addBot` socket command plus a bot-turn scheduler (`scheduleBotAction`) that fires after a randomized **500–2000 ms** delay when the current actor is a bot and a human is connected. It rides along with `scheduleDisconnectedAutoAction`, sharing the same re-arm points.
- **Table store** (`tableStore.ts`): `addBot(tableId, hostParticipantId)`, `botActionForCurrentActor(tableId)`, exported `hasConnectedHuman(table)`, a curated `BOT_NAMES` pool (Bluffy, Chip, Maverick, Ace, Rounder, Sleeves) with collision-suffix fallback, and `sanitizeBotDecision` / `safeFallbackDecision` guards so a bad strategy output still yields a legal action. Persisted participant state gains `isBot` and `botStrategyId`.
- **Shared types** (`packages/shared`): `isBot` added to `ParticipantSummary`; `canAddBot` added to `AvailableControls` (true only for the host, between hands, with an open seat); new `AddBotPayload`.
- **Client** (`main.tsx`): wiring to surface the add-bot control / bot labeling.

## Validation

- `botStrategy.test.ts` covers: premium vs. trash starting hands, made flush vs. lone pair postflop, raise-with-premium / fold-trash-facing-bet, check-rather-than-fold with no bet, pot-fraction raise clamping within the legal range, unaffordable raise → all-in, always returning a legal action when no raise option and min raise is unreachable, and reproducibility under a fixed seed.
- `tableStore.test.ts` extended (~167 added lines) for the bot seating/scheduler/persistence paths.

## Follow-ups

- Commit the WIP once the end-to-end bot flow (seat → scheduled action → persistence restore) is verified against the full suite.
- Remaining acceptance-criteria checks to confirm before closing issue #13: snapshot hole-card privacy for bots, no-human pause/resume, busted-bot sit-out, and restart-mid-hand resume with a bot as current actor.
- Out of scope (interface left open): language-model strategies, multiple difficulty levels, bot chat, auto-filling seats on hand start, bot auto-rebuy.

## Related

- Builds directly on **Active Table Persistence** — see [2026-06-15-active-table-persistence.md](2026-06-15-active-table-persistence.md). The persistence engine itself was implemented and committed after that planning session (`feat: implement active table persistence with SQLite support`, 2026-06-16; refined 2026-06-18); bots extend its versioned serialized state.
