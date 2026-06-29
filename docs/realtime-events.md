# Realtime Events

This document defines the initial Socket.IO event vocabulary. Payload schemas should be finalized during implementation and should reuse shared TypeScript types.

## Client To Server

### table:create

Creates a new private table and assigns the creator as host.

### table:join

Joins an existing table by invite ID with a display name.

### player:reconnect

Attempts to restore a player or spectator identity using a browser-held session token.

### hand:start

Host command to start the first hand.

### hand:next

Host command to deal the next hand after settlement.

### player:action

Current-actor command for fold, check, call, raise, or all-in.

### player:sitOut

Player command to sit out between hands.

### player:rejoin

Player command to rejoin between hands.

### host:approveRebuy

Host command to approve a rebuy between hands.

### host:seatSpectator

Host command to move a spectator into an open auto-assigned seat between hands.

### host:removePlayer

Host command to remove an inactive player between hands.

### host:autoFoldInactive

Host command to auto-fold the current actor after at least 2 minutes of inactivity.

### host:addBot

Host command to seat a rule-based bot player in the next open seat between hands. Payload is `AddBotPayload` (`{ tableId }`); the seat is chosen server-side. The bot counts toward seating limits and the 2-player minimum, is marked with `isBot` in snapshots, and takes its turns through the bot-turn scheduler. Rejected when a hand is in progress, the table is full, or the requester is not the host.

### chat:send

Sends a bounded table-scoped chat message.

## Server To Client

### table:snapshot

Sends the current player-specific table snapshot. Hidden information must only be included for the participant allowed to see it.

### command:rejected

Reports that a client command was invalid or not allowed, with a safe reason.

### chat:message

Broadcasts a sanitized table-scoped chat message.

### system:error

Reports an unexpected or general system error with a safe message.

## Notes

- Socket.IO handlers should translate events into domain commands.
- The server should send table snapshots after successful state-changing commands.
- Command rejection reasons should be safe to show to users and safe to log.
- Event names may be refined during implementation if the shared type model suggests clearer names.
