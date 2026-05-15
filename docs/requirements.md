# Online Multiplayer Texas Hold 'em Requirements

## Product Shape

- The game is play-money only.
- There are no deposits, withdrawals, prizes, or real-money wagering.
- Each player starts with the same fake USD-denominated chip balance.
- A player can create a private table and share an invite link with friends.
- Tables are persistent across multiple hands while the server process is running.
- Tables support 2 to 6 seated players.
- Spectators are allowed through the private link, but cannot act or see hole cards.
- The creator of the table is the host.

## Technology Decisions

- The multiplayer server is Node.js with TypeScript.
- Realtime transport uses Socket.IO.
- The frontend is React, Vite, and TypeScript.
- The repository is a single monorepo with separate client, server, and shared packages.
- The monorepo uses pnpm workspaces.
- The poker game engine is a pure TypeScript domain module, separate from Socket.IO handlers.
- The domain engine uses a command-in, result-out API.
- Game state is server-authoritative.
- Clients send player intents only, such as fold, check, call, raise, and all-in.
- The server validates all actions, owns turn order, deals cards, manages pots, and determines winners.
- Deck logic is local to the server.
- The Deck of Cards API is not required for MVP.
- Card rendering should start with local CSS/HTML cards.
- A stable TypeScript-compatible poker hand evaluator library may be used if a short spike confirms it is suitable.
- The hand evaluator should be wrapped behind an internal interface.
- Socket.IO handlers translate socket events into domain commands.
- React renders server snapshots and sends player intents.
- Server-to-client sync uses full table snapshots for MVP.
- Snapshots are player-specific so a client only receives hidden information they are allowed to see.

Preferred domain API shape:

```ts
applyCommand(tableState, command): CommandResult
```

`CommandResult` should include updated table state, domain events for UI/logging, and a rejected-command reason when the command is invalid.

The server keeps a lightweight bounded in-memory event log per table:

- Store recent domain events for debugging and table activity.
- Include public events in snapshots.
- Do not expose private hole-card events in public history.
- Cap history to prevent unbounded memory growth, such as the last 200 events or the current hand plus previous hand.

Proposed repository structure:

```text
apps/
  client/
  server/
packages/
  shared/
```

## MVP Game Rules

- The game follows no-limit Texas Hold 'em.
- MVP uses fixed user-facing table defaults.
- Starting stack default is $1,000.
- Small blind default is $5.
- Big blind default is $10.
- Defaults should live in configuration or constants that are easy for developers to change.
- MVP includes minimal startup configuration validation.
- Configuration should cover server port, allowed client origin, invite ID settings if applicable, default stack and blinds, inactivity durations, and event log cap.
- End-to-end testing uses Playwright.
- MVP browser support targets latest Chrome, Edge, Firefox, and Safari.
- MVP mobile browser support targets mobile Safari and mobile Chrome.
- MVP includes basic Progressive Web App installability and app-shell/static asset caching.
- PWA support should include a web app manifest, app name, icons, theme color, and a service worker for app-shell/static assets.
- MVP deployment should target a single always-on Node web service.
- The deployment target must support WebSockets.
- The Node service may serve the built React app or be paired with static hosting.
- MVP should not depend on serverless-only hosting.
- MVP is considered complete when it is deployed and playable by friends over the internet from separate devices.
- MVP includes lightweight structured server logs.
- Logs should cover table creation, player join/reconnect/disconnect, hand start/settlement, rejected commands with reasons, unexpected errors, and startup configuration summary excluding secrets.
- MVP does not require a metrics stack, tracing system, or observability dashboard.
- All-in is supported.
- Side pots are supported.
- Split pots are supported.
- Heads-up blind and button rules are supported.
- Minimum raise and all-in raise behavior are supported.
- Hand ranking with ties is supported.
- Important poker correctness rules are implemented in MVP.
- Casino-room edge cases are deferred.
- If everyone but one player folds, the winner's hole cards are not revealed.
- At showdown, reveal hole cards for players still contesting at least one pot.
- Folded players' cards remain hidden.
- All-in players who reach showdown reveal their cards.
- Settlement summaries show who won each pot and with what hand.
- Optional show/muck choices are deferred.

## Deferred Poker Edge Cases

- Missed blind penalties.
- Dead button complexity when players leave.
- Tournament rules.
- Multi-table play.
- Casino-grade audit history.

## Table Flow

- Players join by private link.
- Private table links use high-entropy random IDs.
- MVP does not require optional table passwords.
- Anyone with the link can join as a spectator.
- MVP does not require accounts.
- Players enter a display name.
- The browser stores a session token so a player can reconnect to the same seat.
- Players are auto-assigned seats.
- Before the first hand, joining players are auto-seated until 6 seats are filled.
- After the first hand starts, new joiners enter as spectators.
- The host can seat spectators into open seats between hands.
- The host manually starts the first hand.
- The host manually deals each next hand after settlement.
- Dealer button and blinds rotate between hands.
- Player bankrolls carry forward between hands.

## Host Controls

- The host can start the first hand.
- The host can deal the next hand between hands.
- The host can approve rebuys between hands.
- The host can reset the table between hands.
- The host can remove inactive players between hands.
- The host can auto-fold the current actor after 2 minutes of inactivity.
- The host cannot alter cards, pots, hand results, or another player's action.

## Disconnects And Inactivity

- Disconnected players keep their seat.
- A disconnected player can reconnect with the same browser token and resume their seat.
- If action reaches a disconnected player, the server waits for a short grace period.
- After the grace period, the server auto-checks if checking is legal.
- If checking is not legal, the server auto-folds.
- A disconnected all-in player remains eligible for pots.
- A disconnected player between hands is marked sitting out and skipped until they return.
- Connected players do not have an automatic forced-action timer in MVP.
- If a connected player has not acted after 2 minutes and action is on them, the host may auto-fold them.

## Sitting Out And Rejoining

- Players can sit out only between hands.
- Players can rejoin only between hands.
- Players sitting out are not dealt into the next hand and do not post blinds.

## Rebuys

- There are no automatic rebuys.
- Host-approved rebuys are allowed between hands.
- A busted player is sitting out by default.
- Rebuy behavior should be simple, likely restoring the player to the original starting stack.

## Chat

- Lightweight table chat is included in MVP.
- Chat messages are scoped to the private table.
- Chat has display name, timestamp, and a basic length limit.
- Chat does not include direct messages, uploads, rich formatting, or persistence.

## Visual Direction

- The app should feel like a minimal tabletop game room.
- The UI should emphasize clarity over casino theming.
- The main table view should clearly show turn, legal actions, current bet, pots, player stacks, and visible cards.
- MVP should provide a good mobile experience, even if that requires a more minimal UI on small screens.
- Mobile uses a compact turn-focused layout rather than forcing a full visual poker table onto a small screen.
- Mobile should prioritize acting on the current turn, seeing hole cards, reading the board, checking stack/pot/current bet, and following essential action history.
- Nonessential panels may collapse behind tabs, drawers, or compact controls on mobile.
- Chat should be behind a tab or drawer on mobile, with an unread indicator if practical.
- The table UI should show a simple public action log.
- The action log should include blinds, checks, calls, raises, folds, street deals, all-ins, and hand settlement summaries.
- The action log must not reveal hidden cards unless showdown rules reveal them.
- MVP includes a minimal optional turn notification.
- Turn notification may include visual emphasis, browser title change, and an optional short sound or vibration when it becomes the player's turn.
- Broader card, chip, and ambient sound effects are deferred.

## Accessibility

- Basic accessibility is required for MVP.
- Action controls must be keyboard-operable.
- Interactive elements should have visible focus states.
- Buttons and inputs should have clear accessible labels.
- Color must not be the only indicator of state or available action.
- UI should use sufficient contrast.
- Form inputs should have labels.
- Turn and action status should be readable by assistive technology where practical.
- The UI should not rely on hover-only controls.

## Privacy And Security Baseline

- The server must never send a player's hidden hole cards to other players or spectators.
- All socket commands must be validated server-side.
- Chat and repeated invalid commands should be rate-limited.
- Display names and chat content must be sanitized or escaped before rendering.
- Table count, player count, display name length, and message length should be capped.
- Table IDs and session tokens should use secure randomness.
- Logs must not include private hole cards or session tokens.
- Production CORS should be restricted to configured origins.

## Onboarding And Help

- MVP includes a simple beginner tutorial explaining how to play Texas Hold 'em.
- The beginner tutorial should cover hand flow, blinds, hole cards, community cards, betting rounds, available actions, all-in, side pots at a high level, showdown, and winning hands.
- MVP includes a minimal host tutorial explaining how to create a game, share the private link, start the first hand, deal the next hand, approve rebuys, seat spectators, and handle inactive players.
- Tutorials should be available from the app UI without blocking experienced players.
- Tutorial content should be concise and practical, not a long rules encyclopedia.
- Tutorials are static step-by-step help screens for MVP.
- Tutorial screens may include small examples or illustrations, but MVP does not require an interactive simulated-hand tutorial.
- UI implementation may make local design decisions that improve clarity, responsiveness, or usability, as long as they do not materially change the product plan or game rules.

## Milestone 1: One Complete Playable Hand

The first implementation milestone is a vertical playable slice for one complete hand:

- Create a private table.
- Join from invite link with display name.
- Auto-seat 2 to 6 players before the first hand.
- Host starts the hand.
- Server shuffles and deals locally.
- Blinds are posted.
- Betting rounds progress through preflop, flop, turn, and river.
- Players can fold, check, call, raise, and go all-in.
- All-in and side-pot settlement are included in this milestone.
- The server evaluates hands and settles pots.
- A basic React table UI shows the game state.
- Socket.IO syncs table state to connected clients.

Milestone 1 should include automated tests for the domain engine before UI polish:

- Deck creates 52 unique cards.
- Blinds post correctly.
- Legal actions are calculated correctly.
- Betting round advances correctly.
- Fold ends hand when one player remains.
- Check, call, raise, and all-in update stacks and bets correctly.
- Side pots are created correctly.
- Split pots distribute correctly.
- Showdown picks winners through the evaluator wrapper.
- Heads-up button and blind behavior works.

Milestone 1 acceptance checklist:

- A host can create a private table and receive a shareable invite link.
- Two or more players can join with display names and be auto-seated before the first hand.
- The host can start a hand.
- The server deals private hole cards and public community cards without exposing hidden cards to other clients.
- Players can complete a hand through all required betting rounds using fold, check, call, raise, and all-in.
- The server creates and settles side pots correctly when stacks differ.
- The server reveals only eligible showdown hands.
- The server awards pots correctly, including split pots.
- The UI updates for all connected clients after each action.
- Refreshing or reconnecting with the same browser session restores the player's seat during the active table session.
- Core domain tests pass.
- A Playwright E2E smoke test covers creating a table, joining from an invite link, starting a hand, and completing representative player actions.
- Mobile viewport E2E coverage verifies the turn-focused layout remains usable for acting on a hand.

## Post-MVP Backlog

- Persist active games so tables survive server restarts.
- Public lobby or table browser.
- Matchmaking.
- Configurable blinds and starting stacks.
- Automatic next-hand countdown.
- More polished local card assets.
- Player accounts and profiles.
- Table history and hand replay.
- Rebuy configuration.
- Moderation tools.

## Out Of Scope For MVP

- Real-money wagering, deposits, withdrawals, prizes, or cash-out.
- Accounts, login, passwords, email verification, and global profiles.
- Public lobby, matchmaking, and table browser.
- Database persistence for active games.
- Tournaments and multi-table play.
- Player stats, profile history, and long-term hand history.
- Optional table passwords.
- Manual seat picking and seat swapping.
- Interactive simulated-hand tutorial mode.
- Advanced moderation tools.
- AI or bot players.
- Multiple simultaneous active tables per player.
- Mobile-native app packaging.
- Offline gameplay, offline table recovery, background sync, and push notifications.
- Full casino-grade rule handling and audit trail.

## Handoff Notes

- This document is the current requirements and decision source for the project.
- A later PRD should use this document as its primary input.
- A later issue breakdown should preserve the Milestone 1 vertical slice and avoid expanding MVP scope.
- Implementation agents may make local technical and UI decisions when they improve clarity, maintainability, or usability without changing the product rules.
