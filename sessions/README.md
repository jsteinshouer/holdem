# Codex Session Summaries

This folder summarizes the important project-specific Codex sessions found under `C:\Users\jsteinshouer\.codex\sessions` for this workspace.

The summaries intentionally omit approval-review transcripts and the current summarization session. They focus on decisions, artifacts, validation notes, and follow-up work that should matter to future implementation agents.

## Summary Files

- [2026-05-15-project-planning.md](2026-05-15-project-planning.md) - Initial product, architecture, requirements, PRD, issue, and agent setup planning.
- [2026-06-15-mobile-ux.md](2026-06-15-mobile-ux.md) - Mobile hand-console UX refinement and issue/PRD guidance.
- [2026-06-15-active-table-persistence.md](2026-06-15-active-table-persistence.md) - Active Table Persistence terminology, architecture, ADR, and issue planning.
- [2026-06-16-dev-server-debugging.md](2026-06-16-dev-server-debugging.md) - Socket.IO/Vite proxy debugging, dev script notes, and config rollback guidance.
- [2026-06-26-simple-bot-players.md](2026-06-26-simple-bot-players.md) - Rule-based bot players behind a substitutable `BotStrategy` interface, bot-turn scheduler, and seating/persistence wiring (issue #13, working-tree WIP).

## High-Signal Takeaways

- The project is Friendly Hold'em: a private-link, play-money, server-authoritative Texas Hold'em web app.
- MVP scope is intentionally practical: no accounts, no real-money wagering, 2 to 6 players, persistent Tables during a server process, repeated Hands, host controls, spectators, chat, tutorials, PWA basics, accessibility, and mobile support.
- The chosen stack is Node.js, TypeScript, Socket.IO, React, Vite, and pnpm workspaces.
- The poker domain engine should remain pure TypeScript with a command-in, result-out API and strong tests.
- Active Table Persistence is the canonical term for restart-survivable Tables and Hands. SQLite is the first persistence backend, behind a narrow persistence port.
- The mobile UX direction is a compact hand console, not a shrunken desktop poker table.
- A local Socket.IO failure was traced to the Vite dev server missing a `/socket.io` proxy to the Node server.
- Active Table Persistence was implemented and committed (SQLite-backed, 2026-06-16, refined 2026-06-18) after its planning session.
- Simple bot players are in progress: a pure, rule-based `BotStrategy` (seedable RNG, pot-fraction raise sizing) with a 0.5–2s server-side bot-turn scheduler that pauses when no human is connected; a local LLM strategy was deliberately deferred behind the same seam.

