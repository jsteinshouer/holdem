Status: ready-for-agent

# PRD: Friendly Hold'em

## Problem Statement

Friends need a simple way to play Texas Hold 'em together online without creating accounts, handling real money, or setting up a complicated poker platform. Existing poker apps often add public lobbies, account systems, real-money associations, heavy casino styling, or mobile experiences that make a private casual game feel heavier than it needs to be.

The user wants a private-link, play-money poker app that is easy to host, easy for friends to join from desktop or mobile browsers, and correct enough to support real no-limit Texas Hold 'em behavior such as all-in, side pots, split pots, and showdown reveal rules.

## Solution

Build **Friendly Hold'em**, a server-authoritative realtime web app for private play-money Texas Hold 'em tables. A host creates a private table, shares an invite link, and manually starts the first hand. Friends join with display names, are auto-seated before play begins, and play repeated hands with equal fake USD-denominated starting stacks.

The app uses a Node.js and TypeScript server with Socket.IO, a React/Vite/TypeScript client, pnpm workspaces, and shared TypeScript types. The poker game engine is a pure TypeScript domain module with a command-in, result-out API. The server owns all poker state, validates every command, shuffles/deals locally, manages betting and pots, evaluates hands, and broadcasts player-specific full table snapshots that never leak hidden cards.

MVP completion means the app is deployed to a single always-on Node web service that supports WebSockets and is playable by friends over the internet from separate devices.

## User Stories

1. As a host, I want to create a private poker table, so that I can start a casual game with friends.
2. As a host, I want to receive a shareable invite link, so that I can send it to friends directly.
3. As a player, I want to join a table from a private link, so that I do not need to search a public lobby.
4. As a player, I want to enter a display name without creating an account, so that joining is quick.
5. As a player, I want the browser to remember my session during the table session, so that I can refresh or reconnect to the same seat.
6. As a host, I want players to be auto-seated before the first hand, so that setup stays simple.
7. As a spectator, I want to join from the private link when seats are full or play has started, so that I can watch the table.
8. As a spectator, I want to see public table state and chat, so that I can follow the game.
9. As a player, I want spectators to be blocked from seeing hidden hole cards, so that the game remains fair.
10. As a host, I want to manually start the first hand, so that I can wait until friends are ready.
11. As a host, I want to manually deal the next hand after settlement, so that there is time for rebuys, chat, and table management.
12. As a player, I want to start each game with the same fake USD-denominated stack, so that the game is fair and simple.
13. As a player, I want no real-money deposits, withdrawals, prizes, or cash-out, so that the app stays play-money only.
14. As a player, I want the game to follow no-limit Texas Hold 'em, so that it behaves like the version of poker I expect.
15. As a player, I want to receive two private hole cards, so that I can play a real Hold 'em hand.
16. As a player, I want community cards dealt across flop, turn, and river, so that the hand progresses correctly.
17. As a player, I want blinds to post automatically, so that each hand begins with the correct forced bets.
18. As a player, I want dealer button and blinds to rotate between hands, so that position changes fairly.
19. As a player, I want heads-up blind and button behavior to work correctly, so that two-player games are valid.
20. As a player, I want to fold when I do not want to continue, so that I can leave the current hand.
21. As a player, I want to check when no bet is owed, so that I can continue without adding chips.
22. As a player, I want to call when facing a bet, so that I can match the current amount.
23. As a player, I want to raise, so that I can increase the current bet.
24. As a player, I want to go all-in, so that I can commit my remaining stack.
25. As a player, I want minimum raise behavior to be enforced, so that betting remains valid.
26. As a player, I want all-in raise behavior to be handled correctly, so that betting rounds do not reopen incorrectly.
27. As a player, I want side pots to be created when stacks differ, so that all-in hands settle fairly.
28. As a player, I want split pots to be supported, so that tied hands are paid correctly.
29. As a player, I want the server to evaluate winning hands correctly, so that the right player wins each pot.
30. As a player, I want folded players' hole cards to remain hidden, so that private information is not exposed unnecessarily.
31. As a player, I want showdown to reveal only eligible hands, so that reveal behavior matches expected poker rules.
32. As a player, I want settlement summaries to say who won which pot and with what hand, so that the result is understandable.
33. As a player, I want the winner's cards to remain hidden when everyone else folds, so that players can win without showing.
34. As a player, I want updated table state after every action, so that everyone sees the same game progression.
35. As a player, I want the server to validate actions instead of trusting clients, so that cheating and desyncs are minimized.
36. As a player, I want disconnected players to keep their seats briefly, so that accidental disconnects do not immediately end participation.
37. As a player, I want to reconnect with the same browser session, so that I can resume after refresh or network hiccups.
38. As a player, I want disconnected players to auto-check or auto-fold after a grace period when action reaches them, so that the table does not freeze.
39. As a host, I want to auto-fold the current actor after 2 minutes of inactivity, so that one idle connected player cannot block the game indefinitely.
40. As a player, I want all-in disconnected players to remain eligible for pots, so that disconnects do not unfairly remove committed hands.
41. As a player, I want to sit out between hands, so that I can pause without disrupting the current hand.
42. As a player, I want to rejoin between hands, so that I can return to active play cleanly.
43. As a busted player, I want to remain at the table as sitting out by default, so that I can still watch and chat.
44. As a host, I want to approve rebuys between hands, so that busted players can return without automatic bankroll changes.
45. As a host, I want to seat spectators into open seats between hands, so that late friends can join play safely.
46. As a host, I want to remove inactive players between hands, so that a table can keep moving.
47. As a host, I want host powers limited to table management, so that the host cannot alter cards, pots, hand results, or other players' actions.
48. As a player, I want lightweight table chat, so that the private game feels social.
49. As a player, I want chat messages to be bounded and sanitized, so that chat remains safe and usable.
50. As a player, I want a public action log, so that I can understand what has happened in the hand.
51. As a beginner, I want a simple how-to-play tutorial, so that I can learn hand flow, actions, showdown, and winning hands.
52. As a host, I want a short host tutorial, so that I know how to create, share, start, manage, and continue a game.
53. As an experienced player, I want tutorials available without blocking the game, so that help does not slow me down.
54. As a mobile player, I want a compact turn-focused layout, so that I can comfortably act from a phone.
55. As a desktop player, I want a clear tabletop game-room layout, so that the table state is easy to scan.
56. As a mobile player, I want chat behind a tab or drawer, so that betting controls and game state stay prominent.
57. As a player, I want a minimal optional turn notification, so that I notice when it is my turn.
58. As a player, I want keyboard-operable controls and visible focus states, so that the app is usable without a mouse.
59. As a player, I want color not to be the only indicator of state, so that the app remains understandable and accessible.
60. As a player, I want good contrast and labeled controls, so that the interface is readable and assistive-tech friendly.
61. As a mobile user, I want the app to be installable as a basic PWA, so that it feels easy to return to.
62. As a mobile user, I want app-shell/static assets cached, so that the app opens cleanly even before the server connection is established.
63. As a developer, I want fixed MVP defaults for stack and blinds, so that game creation stays simple.
64. As a developer, I want defaults to live in easy-to-change config or constants, so that later tuning is straightforward.
65. As a developer, I want minimal startup config validation, so that deployment mistakes are caught early.
66. As a developer, I want lightweight structured logs, so that hosted games can be debugged.
67. As a developer, I want a bounded in-memory event log per table, so that the action log and debugging history cannot grow forever.
68. As a developer, I want no database required for MVP, so that hosting and implementation stay simple.
69. As a developer, I want a single always-on Node web service deployment path, so that Socket.IO and in-memory state have a clear runtime home.
70. As a host, I want to add simple computer-controlled bot players to empty seats between hands, so that we can play even when only a few friends are online.
71. As a host, I want bots to count toward the minimum players needed to start a hand, so that I can start a game without waiting for more humans.
72. As a player, I want bots to make believable fold, check, call, raise, and all-in decisions based on their cards, position, and pot odds, so that the game feels like real poker.
73. As a player, I want bots to act after a short, natural delay, so that I can follow the action at the table.
74. As a player, I want bots to be clearly labeled as bots, so that I always know which seats are computer-controlled.
75. As a host, I want busted bots to sit out like human players, so that bot rebuys go through the existing host approval flow rather than changing bankrolls automatically.
76. As a host, I want bots to survive a server restart and resume play, so that an in-progress hand with bots does not deadlock or lose their chips.
77. As a player, I want bots to pause when no human is connected to the table, so that an abandoned table does not keep playing by itself.
78. As a developer, I want bot decision logic behind a strategy interface with tunable constants, so that a different strategy such as a local model can be added later without changing seating, timing, or persistence.

## Implementation Decisions

- Use a pnpm workspace monorepo with separate client, server, and shared packages.
- Use React, Vite, and TypeScript for the client.
- Use Node.js, TypeScript, and Socket.IO for the multiplayer server.
- Use one Socket.IO room per private table.
- Use local server-side deck logic and do not depend on the Deck of Cards API for MVP.
- Render cards locally, starting with CSS/HTML cards rather than external card images.
- Keep active table state in memory only for MVP; server restart ends active tables.
- Generate high-entropy table IDs for private invite links.
- Use browser-held session tokens for reconnecting to the same player or spectator identity during an active table session.
- Use fixed MVP table defaults: $1,000 starting stack, $5 small blind, and $10 big blind.
- Store defaults in easy-to-change config or constants.
- Validate minimal startup configuration, including server port, allowed client origin, default stack/blinds, inactivity durations, and event log cap.
- Use full server-to-client table snapshots for MVP rather than incremental patches.
- Make snapshots player-specific so a client only receives hidden information it is allowed to see.
- Keep a bounded in-memory event log per table for public action history and debugging.
- Use a pure TypeScript Domain Engine as a deep module that owns poker state transitions behind a command-in, result-out interface.
- Use `applyCommand(tableState, command): CommandResult` as the preferred domain API shape.
- `CommandResult` includes updated table state, domain events for UI/logging, and rejected-command reason when invalid.
- Wrap any hand evaluator library behind a Hand Evaluator Adapter.
- Spike a stable TypeScript-compatible hand evaluator library before committing to it.
- Use a Snapshot Builder to convert authoritative table state into safe viewer-specific table snapshots.
- Use a Table Session Store for in-memory table registry, invite IDs, session tokens, connection state, and bounded event logs.
- Keep Socket.IO handlers thin: translate events into domain commands, apply commands through the domain layer, and emit snapshots or safe rejection messages.
- Define client-to-server events around table creation/joining, reconnect, hand start/next, player action, sit out/rejoin, host controls, and chat.
- Define server-to-client events around table snapshots, command rejection, chat messages, and safe system errors.
- Include lightweight table chat in MVP with message length limits, sanitization/escaping, and rate limiting.
- Include a visible public action log for blinds, actions, street deals, all-ins, and settlement summaries.
- Do not expose private hole-card events in public history.
- Support host controls for starting hands, dealing next hand, approving rebuys, seating spectators, removing inactive players, and auto-folding a current actor after 2 minutes of inactivity.
- Restrict host controls so the host cannot alter cards, pots, hand results, or other players' actions.
- Implement no-limit Texas Hold 'em correctness for all-in, side pots, split pots, heads-up blind/button behavior, minimum raise behavior, hand ranking, ties, and showdown reveal eligibility.
- Defer casino-room edge cases such as missed blind penalties, dead button complexity, tournament rules, multi-table play, and casino-grade audit history.
- Use a minimal tabletop game-room visual style.
- Use a compact turn-focused mobile layout rather than forcing a full oval table onto phone screens.
- Keep chat behind a tab or drawer on mobile, with unread indication if practical.
- Include static step-by-step beginner and host help screens.
- Allow UI implementers to make local design decisions that improve clarity, responsiveness, or usability without changing product rules.
- Include basic PWA installability and app-shell/static asset caching.
- Deploy MVP as a single always-on Node web service that supports WebSockets; provider remains open.
- The Node service may serve the built React app or be paired with static hosting.
- Do not depend on serverless-only hosting.
- Include lightweight structured server logs for table creation, joins, reconnects, disconnects, hand start/settlement, rejected commands, unexpected errors, and startup config summary excluding secrets.
- Enforce privacy and security boundaries: validate socket commands server-side, never send hidden cards to unauthorized viewers, cap resource counts and message lengths, use secure randomness, do not log private hole cards or session tokens, and restrict production CORS to configured origins.
- Support simple computer-controlled bot players as seated participants that the host adds to specific empty seats between hands through a host control.
- Implement bot decisions as a pure rule-based `BotStrategy` behind a narrow interface that consumes the bot's own player-specific snapshot and legal actions, so a future strategy such as a local model can be substituted without changing seating, timing, or persistence.
- Ship a single "simple" bot skill level for now, with tunable constants stored in easy-to-change config or constants.
- Base bot decisions on estimated hand strength (preflop starting-hand strength, postflop made-hand and draw strength via the Hand Evaluator Adapter), pot odds, and position, with bounded seedable randomization so play is varied but tests remain reproducible.
- Size bot raises as a fraction of the pot, approximately one-half to three-quarters pot, clamped to the legal minimum raise and the bot's remaining stack.
- Drive bot turns from a server-side bot-turn scheduler that acts after a short randomized delay, approximately 0.5 to 2 seconds, when the current actor is a bot.
- Exempt bots from inactivity auto-fold and disconnected-action grace timers; bots are never treated as inactive or disconnected.
- Treat a busted bot like a busted human: it sits out by default and returns only through host rebuy approval.
- Count bots toward the 2-to-6 seated-player limits and toward the 2-player minimum required to start a hand.
- Mark bot participants with an `isBot` flag in snapshots and assign each a display name from a small curated pool; bots take poker actions only and never post chat.
- Require at least one connected human to advance play: when no human is connected, pause bot turns and do not start new hands, resuming when a human reconnects.
- Persist bot participants as part of the versioned serialized active-table state, including the `isBot` marker and strategy identity, and on restore re-arm the bot-turn scheduler when a bot is the current actor so restored hands do not deadlock.
- Restrict bot management to host controls, consistent with existing host-power limits so the host cannot alter cards, pots, or hand results.

## Testing Decisions

- Tests should focus on externally visible behavior and domain outcomes, not implementation details.
- Domain Engine tests are the foundation and should be written before UI polish.
- Domain Engine tests should verify deck uniqueness, blind posting, legal actions, betting round progression, fold-to-win behavior, check/call/raise/all-in stack updates, side-pot creation, split-pot distribution, showdown settlement, and heads-up blind/button behavior.
- Hand Evaluator Adapter tests should verify conversion between internal card model and evaluator format, known hand rankings, tie behavior, and winner selection through the adapter.
- Snapshot Builder tests should verify that hidden cards are only present in the correct viewer snapshot and never exposed to other players or spectators.
- Table Session Store tests should verify invite ID creation, session token reconnect behavior, connection/disconnection state, spectator versus seated player behavior, and bounded event log behavior.
- Realtime Socket Layer integration tests should verify that socket events map to domain commands, rejected commands return safe reasons, successful commands broadcast updated player-specific snapshots, and chat is bounded/sanitized.
- Client UI tests should cover core rendering states, legal action controls, host controls, tutorials, action log, chat, mobile turn-focused layout, and accessible labels/focus behavior where practical.
- Playwright E2E tests should cover creating a table, joining from an invite link, starting a hand, completing representative player actions, reconnecting with the same browser session, and verifying mobile viewport usability.
- Playwright should target latest Chrome, Edge, Firefox, Safari, mobile Safari, and mobile Chrome where practical in the chosen CI/development setup.
- Accessibility checks should cover keyboard-operable action controls, visible focus states, sufficient contrast, labeled controls, and no reliance on hover-only controls.
- PWA tests or checks should verify manifest presence and app-shell/static asset service worker behavior.
- Bot strategy tests should verify legal-action selection, pot-odds-based calling, position-aware aggression, pot-fraction raise sizing clamped to legal bounds, and reproducible behavior under a fixed RNG seed.
- Bot integration tests should verify that adding a bot between hands seats it, that bots act after the configured delay, that bots are exempt from inactivity and disconnect timers, that play pauses when no human is connected, that busted bots sit out for host rebuy approval, and that a restart mid-hand with a bot as current actor resumes without deadlock.

## Out of Scope

- Real-money wagering, deposits, withdrawals, prizes, or cash-out.
- Accounts, login, passwords, email verification, and global profiles.
- Public lobby, matchmaking, and table browser.
- Tournaments and multi-table play.
- Player stats, profile history, and long-term hand history.
- Optional table passwords.
- Manual seat picking and seat swapping.
- Interactive simulated-hand tutorial mode.
- Advanced moderation tools.
- Language-model bot strategies, local or external (the `BotStrategy` interface is added now; a model-backed strategy is a later enhancement).
- Multiple bot difficulty levels, configurable bot personalities, or bot chat and table talk.
- Multiple simultaneous active tables per player.
- Mobile-native app packaging.
- Offline gameplay, offline table recovery, background sync, and push notifications.
- Full casino-grade rule handling and audit trail.
- Serverless-only deployment.
- Deck of Cards API dependency.

## Further Notes

- Source planning docs live in `docs/requirements.md`, `docs/product-brief.md`, `docs/domain-model.md`, `docs/realtime-events.md`, and `docs/architecture.md`.
- The first implementation milestone is a vertical playable slice for one complete hand, including all-in and side-pot settlement.
- MVP is not complete until deployed and playable by friends over the internet from separate devices.
- The later issue breakdown should preserve the vertical slice and avoid expanding MVP scope.
- Implementation agents may refine event names, payload schemas, type shapes, and UI composition when doing so improves clarity or maintainability without changing the product plan or poker rules.
