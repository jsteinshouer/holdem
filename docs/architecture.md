# High-Level Architecture

## Overview

Friendly Hold'em is a server-authoritative realtime web app. The client renders player-specific table snapshots and sends player intents. The server owns all poker state, validates every command, deals cards, manages betting, settles pots, and broadcasts updated snapshots through Socket.IO.

## Runtime Shape

```mermaid
flowchart LR
  Browser["React/Vite Client"]
  Socket["Socket.IO Transport"]
  Server["Node/TypeScript Server"]
  Domain["Pure Poker Domain Engine"]
  Memory["In-Memory Table Store"]

  Browser <--> Socket
  Socket <--> Server
  Server --> Domain
  Domain --> Server
  Server <--> Memory
```

## Monorepo Structure

```text
apps/
  client/
  server/
packages/
  shared/
```

- `apps/client` contains the React, Vite, and TypeScript frontend.
- `apps/server` contains the Node.js, TypeScript, HTTP, Socket.IO, config, logging, and table-session runtime.
- `packages/shared` contains shared TypeScript types used by client and server.

## Client Responsibilities

- Render the current player-specific table snapshot.
- Collect player intents such as fold, check, call, raise, all-in, chat, sit out, and rejoin.
- Store the browser session token for reconnecting to the same seat.
- Provide mobile-friendly turn-focused UI.
- Provide beginner and host help screens.
- Provide basic PWA installability and app-shell/static asset caching.
- Never infer hidden game state or decide poker outcomes.

## Server Responsibilities

- Create and manage private in-memory tables.
- Generate high-entropy table IDs and session tokens.
- Own all authoritative game state.
- Translate Socket.IO events into domain commands.
- Validate all commands before applying them.
- Produce player-specific table snapshots.
- Send only allowed hidden information to each viewer.
- Maintain bounded in-memory table event logs.
- Handle reconnects, disconnects, sitting out, host controls, and chat.
- Emit lightweight structured logs.

## Domain Engine Responsibilities

The poker engine is a pure TypeScript module with a command-in, result-out API:

```ts
applyCommand(tableState, command): CommandResult
```

It owns:

- Table and hand state transitions.
- Deck creation, shuffle, and dealing.
- Dealer button and blind rotation.
- Legal action calculation.
- Betting round progression.
- Fold, check, call, raise, and all-in behavior.
- Main pot and side-pot creation.
- Showdown reveal eligibility.
- Hand evaluation through a wrapped evaluator library.
- Pot settlement and stack updates.
- Domain events and command rejection reasons.

It should be testable without Socket.IO, React, or a running server.

## Realtime Sync

- Socket.IO is the realtime transport.
- One Socket.IO room maps to one private table.
- Clients send intent events.
- The server applies domain commands and broadcasts full table snapshots after successful state changes.
- Snapshots are player-specific and must not expose hidden cards to other players or spectators.
- Invalid commands return safe rejection messages.

## State And Persistence

- MVP state is in memory only.
- Server restart ends active tables.
- Invite links are valid only while the in-memory table exists.
- A bounded in-memory event log is kept per table for action history and debugging.
- Database persistence is a post-MVP backlog item.

## Deployment

- MVP targets a single always-on Node web service that supports WebSockets.
- The Node service may serve the built React app or be paired with static hosting.
- The app should not depend on serverless-only hosting.
- MVP is complete when deployed and playable by friends over the internet from separate devices.

## Testing Strategy

- Domain engine tests are the foundation and should be written before UI polish.
- Domain tests should cover deck uniqueness, blinds, legal actions, betting progression, all-in, side pots, split pots, showdown, and heads-up blind/button rules.
- Playwright E2E tests should cover creating a table, joining from an invite link, starting a hand, representative player actions, reconnect behavior, and mobile turn-focused layout usability.

## Security And Privacy Boundaries

- The server must never send hidden hole cards to unauthorized clients.
- All socket commands are validated server-side.
- Chat and repeated invalid commands should be rate-limited.
- Display names and chat messages are sanitized or escaped before rendering.
- Table IDs and session tokens use secure randomness.
- Logs must not include private hole cards or session tokens.
- Production CORS is restricted to configured origins.

## Intentional MVP Constraints

- No accounts or database.
- No real-money wagering.
- No public lobby or matchmaking.
- No offline gameplay.
- No casino-grade audit trail.
- No serverless-only deployment assumption.
