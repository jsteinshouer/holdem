# Product Brief

## Product Name And Description

**Friendly Hold'em** is a private-link, play-money Texas Hold 'em web app where friends can host and play persistent multiplayer poker tables from desktop or mobile browsers.

## Primary Users

- **Host:** creates a private table, shares the invite link, starts hands, approves rebuys, seats spectators, and handles inactive players.
- **Player:** joins a private table, plays no-limit Texas Hold 'em with fake USD chips, chats, and reconnects to the same seat if disconnected.
- **Spectator:** joins from the private link to watch public table state and chat without seeing hidden cards or taking poker actions.

## Core Workflows

### Workflow 1: Host A Private Game

1. Host opens the app and creates a new private table.
2. Server creates an in-memory table with a high-entropy invite ID and assigns the creator as host.
3. Host copies or shares the private invite link.
4. Friends open the link, enter display names, and are auto-seated until the table has up to 6 seated players.
5. Host starts the first hand when at least 2 players are seated.
6. After each settled hand, the host can approve rebuys, seat spectators, handle inactive players, or deal the next hand.

### Workflow 2: Play A Hand

1. Server shuffles and deals locally, posts blinds, and sends each player a private table snapshot with only their own hole cards.
2. Players act in turn using legal actions: fold, check, call, raise, or all-in.
3. Server validates every action, updates stacks/bets/pots, and broadcasts new player-specific snapshots.
4. Betting progresses through preflop, flop, turn, and river as needed.
5. If all but one player folds, the winner takes the pot without revealing hole cards.
6. At showdown, the server reveals only eligible hands, evaluates winners, settles main and side pots, updates stacks, and logs the result.

## Key Features

- Private invite-link tables for 2 to 6 players, with no accounts required.
- Server-authoritative no-limit Texas Hold 'em with all-in, side pots, split pots, and important correctness rules.
- React/Vite mobile-friendly table UI with compact turn-focused mobile layout.
- Lightweight table chat, public action log, beginner help screens, and host tutorial.
- Socket.IO realtime sync using player-specific full table snapshots.

## Domain Entities

- **Table:** private game room containing seats, spectators, configuration, current hand, host, and recent events.
- **Player:** seated participant with display name, stack, session token, connection status, and sit-out/busted state.
- **Hand:** one deal of Texas Hold 'em, including deck, hole cards, community cards, betting round, pots, and settlement.
- **Table Snapshot:** player-specific server view sent to clients, containing only the public state plus hidden information the viewer is allowed to see.
