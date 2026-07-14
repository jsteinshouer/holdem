Status: ready-for-agent
Category: bug

# Sit out players who stay disconnected across hands

## Parent

`docs/tech-debt-report.md` (P1, item 3)

## What to build

A player who disconnects mid-hand and never returns keeps being dealt into every subsequent hand: they are dealt cards, post the small/big blind when in a blind seat, and are auto-folded by the grace timer — steadily bleeding chips while offline. Today a disconnect only flips a player to sitting-out when it happens between hands; a mid-hand disconnect leaves them active, and settlement only sits out busted players.

Sit out seated players who are still disconnected at hand settlement (or before the next deal computes the active players), so they are excluded from future hands until they reconnect. Reconnecting must return them to active play via the existing reconnect flow.

**Test-first:** before the fix, write a failing test showing a player who disconnects mid-hand is re-dealt and loses blinds across a `dealNextHand`.

## Acceptance criteria

- [ ] A failing test shows a player who disconnects mid-hand is dealt into the next hand and bled blinds while offline.
- [ ] Still-disconnected seated players are sat out at settlement / before the next hand's active-player computation.
- [ ] A sat-out disconnected player is not dealt cards and posts no blinds on subsequent hands.
- [ ] Reconnecting returns the player to active play per existing reconnect behavior.
- [ ] The reproduction test passes; existing reconnect/disconnect/inactivity tests still pass.

## Blocked by

- None - can start immediately
