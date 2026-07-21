# Technical Debt Report — Friendly Hold'em

_Generated 2026-07-14. Covers code smells, bugs, and security issues across the monorepo (`apps/server`, `apps/client`, `packages/shared`)._

**Overall health is genuinely good.** Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), essentially zero `any`, no `TODO`/`FIXME`/`@ts-ignore` debt, clean secret hygiene (`.env` untracked, no secret-type config exists), no XSS/SQLi, CSPRNG tokens, and a well-tested betting/pot/showdown core that resisted attempts to break side-pots, min-raise/reopen rules, and the hand evaluator. The debt is concentrated in a few specific bugs and two god-files — not sloppiness.

The top finding in each tier below was independently verified by tracing the actual code path.

---

## Summary

| # | Description | Type | Priority |
|---|-------------|------|----------|
| 1 | Heads-up hand bricks when short-stacked button/SB posts an all-in blind | Bug | P0 |
| 2 | Unauthenticated one-request server crash via malformed URL (`decodeURIComponent`) | Security | P0 |
| 3 | Mid-hand disconnects keep getting dealt in and bleed blinds forever | Bug | P1 |
| 4 | Hand-evaluation logic duplicated between engine and bot | Refactor | P1 |
| 5 | Unbounded table/spectator creation; rate limiter is cosmetic (DoS) | Security | P1 |
| 6 | `tableStore.ts` is a 1,886-line god-module (5+ responsibilities) | Refactor | P2 |
| 7 | `main.tsx` is a 1,401-line god-file; blocks client component tests | Refactor | P2 |
| 8 | Chat bodies double-escaped → HTML entities rendered literally | Bug | P2 |
| 9 | Cross-tier magic numbers (seat/name/chat limits) not shared | Refactor | P2 |
| 10 | No real linter — `lint` is just `tsc --noEmit` | Refactor | P3 |
| 11 | Unknown `action` string silently treated as all-in | Bug | P3 |
| 12 | `sqlite` mode persists session tokens + hole cards in plaintext | Security | P3 |
| 13 | Single `defaults` object shared by reference across tables | Refactor | P3 |
| 14 | Odd-chip split by seat order, not first-left-of-button | Bug | P3 |
| 15 | Minor cleanups (alias fn, stringly-typed errors, dead `void` stmts) | Refactor | P3 |

---

## P0 — Fix now (reachable, high blast radius)

| # | Issue | Location | Why it's P0 |
|---|-------|----------|-------------|
| 1 | **Heads-up hand permanently bricks when a short-stacked button/SB posts an all-in blind.** `createHand` picks the first actor with `nextActiveSeat`, which doesn't skip all-in players, so the all-in SB becomes a stuck current actor. Every recovery path (player action, auto-act, bot, host auto-fold, deal-next) bails → table is dead, no in-app recovery. **Verified.** No test covers heads-up with `stack ≤ smallBlind`. | `tableStore.ts:1001`, `:1217`, `:1212` | Happens in normal play as a stack grinds down; ruins the game with no way out. Fix: skip all-in/folded seats when choosing the first actor, and run out the board if <2 players can act (mirror the `<2` auto-run at `:1397`). |
| 2 | **Unauthenticated one-request server crash.** `serveStaticClient` calls `decodeURIComponent(pathname)` with no try/catch and no `uncaughtException` handler anywhere. `GET /%` throws `URIError` → uncaught → process exit. **Verified** (only try/catch in the file is inside `isFile`). | `index.ts:69` | Any stranger who can reach the server kills it for everyone, in production static-serving mode. Fix: try/catch the decode → 400; add top-level `uncaughtException`/`unhandledRejection` net. |

---

## P1 — Should fix soon

| # | Issue | Location | Notes |
|---|-------|----------|-------|
| 3 | **Mid-hand disconnects bleed blinds forever.** `disconnectParticipant` only sits a player out if between hands; a player who drops mid-hand keeps getting dealt in, posts blinds, and is auto-folded every hand until the host removes them. | `tableStore.ts:192` | Fix: sit out still-disconnected seated players at settlement / before `dealNextHand`. |
| 4 | **Duplicated hand-evaluation logic** between the settlement engine and the bot — `straightHighCard`, the `rankValue` table, and category detection are reimplemented in `botStrategy.ts` (its own comment admits "mirroring the server hand evaluator"). | `tableStore.ts:1598-1707` vs `botStrategy.ts:186-274` | Correctness landmine: a rules fix in one place makes the bot and settlement disagree on who won. Fix: one shared evaluator (in `packages/shared`). |
| 5 | **Unbounded table/spectator creation + cosmetic rate limiter.** No auth cap on `table:create`; the "rate limiter" only runs in the `catch` path and only *relabels the error message* — it never blocks execution and never sees valid commands. Memory/disk DoS. **Verified** the limiter is cosmetic. | `realtime.ts:405`, `:94`, `:113` | Fix: cap tables + spectators-per-table; key throttling on connection/IP with a successful-command budget. |

---

## P2 — Structural debt (highest maintainability leverage)

| # | Issue | Location | Notes |
|---|-------|----------|-------|
| 6 | **`tableStore.ts` is a 1,886-line god-module** — session store + game engine + hand evaluator + persistence serialization + CSPRNG + HTML utils. | `tableStore.ts` | Split into `handEvaluator.ts` / `gameEngine.ts` / `tableSerialization.ts` / store facade. Also resolves #4 and isolates the persist-on-every-mutation coupling. Everything is already free functions → low-risk extraction. |
| 7 | **`main.tsx` is a 1,401-line god-file** — App shell + 12 components + all helpers + bootstrap. Idiomatic React, but nothing is independently importable → **client has no component tests** (only `tableView.ts`/`pwa.ts` are tested). | `main.tsx` | Split into `components/`, `hooks/useTableSocket.ts`, `session.ts`; extraction is the prerequisite to closing the test gap. |
| 8 | **Chat double-escaping display bug.** Server stores `escapeHtml(body)`, then React escapes again on render — a user typing `A & B` sees `A &amp; B`; `<`, `>`, `'`, `"` all mis-render. **Verified.** HTML escaping is in the wrong tier (React already makes it safe). | `tableStore.ts:569`, `:1879`; `main.tsx:984` | Fix: store the raw normalized body; delete `escapeHtml`. |
| 9 | **Cross-tier magic numbers** (`MAX_SEATS=6`, name len 32, chat len 180) hardcoded independently on server and client instead of in `packages/shared`. | `tableStore.ts:17-19`, `main.tsx:273/308/466/1001` | Export from shared; consume in both. |

---

## P3 — Hygiene / low severity

- **No real linter** — every `"lint"` is just `tsc --noEmit`. No `no-floating-promises`, `exhaustive-deps`, or `max-lines` (which would have flagged #6/#7). Add ESLint + `@typescript-eslint` + `eslint-plugin-react-hooks`.
- **Unknown `action` string silently treated as all-in** (`applyPlayerAction` final `else`, `tableStore.ts:1298`) — self-harm only, but add an explicit allow-list / runtime payload validation (e.g. zod) at the socket boundary.
- **`sqlite` mode persists session tokens + live hole cards in plaintext** under a world-readable temp dir (`config.ts:26`) — negligible single-tenant, note for shared hosts.
- **Shared `defaults` object by reference** across in-memory tables (`tableStore.ts:128`) — no bug today, latent if ever mutated per-table.
- **Odd-chip split by seat order** rather than first-left-of-button (`tableStore.ts:1450`) — intentional simplification; document it.
- Minor: `requireParticipant` is a redundant alias; stringly-typed error `reason`s; dead `void activeTableId/activeParticipantId` in `realtime.ts:381`.

---

## Explicitly verified healthy (not debt)

Host authorization **is** server-enforced (`requireHost`); no identity spoofing (actor derived from socket, not payload); no hole-card leaks; parameterized SQL; integer chip math throughout; bot vs disconnect timers are mutually exclusive (no out-of-turn actions); side-pot/all-in accounting and the hand evaluator (wheel, straight-flush, kickers, ties) are correct and well-tested.

---

## Suggested order

Fix **#1** and **#2** first (both reachable, damaging, and small fixes), then **#3–#5**, then tackle **#6** (which unlocks **#4**). #1 and #2 are the two that can actively ruin a game and should carry regression tests.
