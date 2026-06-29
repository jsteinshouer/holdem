# 2026-05-15 Project Planning

Source session:

- `C:\Users\jsteinshouer\.codex\sessions\2026\05\15\rollout-2026-05-15T10-12-04-019e2c31-d8a8-7220-9a4f-92e7be310680.jsonl`

## Main Goal

The session used planning skills to define requirements for an online multiplayer Texas Hold'em game and capture the decisions in repo documentation.

## Product Decisions

- The app is play-money only. No deposits, withdrawals, prizes, cash-out, or real-money wagering.
- A player creates a private Table and shares an invite link with friends.
- A Table persists across repeated Hands while the server process is running.
- Tables support 2 to 6 seated players.
- The game is no-limit Texas Hold'em.
- Important poker correctness rules are in MVP, including all-in, side pots, split pots, heads-up blind/button behavior, minimum raises, and showdown tie handling.
- Casino-room edge cases are deferred.
- The Host is the Table creator.
- Spectators are allowed through the private link but cannot act or see hidden hole cards.
- Seats are auto-assigned.
- The Host manually starts the first Hand and deals each next Hand after settlement.
- Host-approved rebuys are allowed between Hands; automatic rebuys are not.
- Lightweight Table chat is in MVP.
- Beginner and Host tutorials are in MVP as static, concise help screens.
- Basic accessibility is required for MVP.
- Basic PWA installability and app-shell/static asset caching are in MVP.
- MVP is complete when deployed and playable by friends over the internet from separate devices.

## Technical Decisions

- Stack: Node.js, TypeScript, Socket.IO, React, Vite, and pnpm workspaces.
- Repo shape: single monorepo with `apps/client`, `apps/server`, and `packages/shared`.
- The server is authoritative for all game state.
- Clients send player intents only.
- The poker engine is a pure TypeScript domain module, separate from Socket.IO and React.
- Preferred domain API shape: `applyCommand(tableState, command): CommandResult`.
- The server validates all commands, deals cards, manages pots, determines winners, and produces player-specific snapshots.
- Full Table snapshots are acceptable for MVP.
- The Deck of Cards API was considered but not required. The plan moved toward local server-owned deck logic and local card rendering.
- A stable hand-evaluator library may be used if wrapped behind an internal interface.
- State is in memory for MVP. Active Table Persistence is post-MVP planning unless explicitly pulled forward.
- A bounded in-memory event log should support debugging and visible public action history.
- Deployment should target a single always-on Node service that supports WebSockets.
- Docker may help with production-like runs or deployment readiness, but normal local development should remain possible with pnpm commands.

## Documentation And Artifacts

The planning session established or informed these repo artifacts:

- `docs/requirements.md`
- `docs/product-brief.md`
- `docs/domain-model.md`
- `docs/realtime-events.md`
- `docs/architecture.md`
- `.scratch/friendly-holdem/PRD.md`
- Initial local issue breakdown under `.scratch/friendly-holdem/issues/`
- Agent setup docs under `docs/agents/` and `AGENTS.md`

## Notable Guidance For Future Agents

- Tests are central for the betting engine, not ceremony.
- The first milestone should be a vertical playable slice for one complete Hand.
- Mobile should use a compact, turn-focused layout rather than forcing a full table UI onto a small viewport.
- Action logs must not reveal hidden cards unless showdown rules reveal them.
- Public API or realtime event changes should be treated carefully and checked against `docs/realtime-events.md` and `docs/domain-model.md`.
- `.scratch` files are intentionally the local issue tracker for this repo.

