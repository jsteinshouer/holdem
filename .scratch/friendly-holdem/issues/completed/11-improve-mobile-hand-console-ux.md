Status: done

# Improve mobile hand-console UX

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Replace the current responsive mobile table view with a phone-first hand console that makes acting on a Texas Hold'em hand simple, thumb-friendly, and readable. The app is already responsive, but mobile still feels like a compressed desktop room. Mobile should instead prioritize the current turn, board cards, viewer hole cards, pot/to-call context, stack/bet context, and legal actions.

Use a quiet utilitarian game-console aesthetic with tactile poker details: strong contrast, stable dimensions, readable cards and chip amounts, restrained felt/gold accents, and no heavy casino styling.

## Design decisions

- Mobile should optimize for one-handed turn execution.
- Mobile should use a stacked hand console rather than a primary visual poker table or full seat grid.
- Seats should collapse into a compact player strip, with full player details available from a secondary panel.
- Raise should open a focused bottom sheet instead of using an inline number input in the main action dock.
- The action log should be promoted above chat during an active hand.
- Host controls should live in a host management drawer, with only urgent contextual host actions surfaced in the main flow.
- Chat remains secondary during active hands, with an unread indicator when practical.

## Acceptance criteria

- [x] Mobile first screen shows a compact table status bar with phase, pot, to-call amount, current bet, and active player.
- [x] Board cards and viewer hole cards are prominent, readable, and remain visible without horizontal scrolling on common mobile widths.
- [x] Legal fold, check, call, and all-in actions appear in a sticky thumb-reachable action dock when available.
- [x] Raise opens a bottom sheet with current stack, pot, current bet, call amount, minimum raise, preset raise choices, exact raise control, confirm, and cancel.
- [x] Raise controls prevent invalid raise submissions client-side where legal-action data makes that possible, while preserving server validation as authoritative.
- [x] Seats render on mobile as a compact player strip showing display name, stack, current bet, connection/sit-out/busted state, and dealer/blind/current-actor indicators.
- [x] Full player details remain accessible from a Players drawer/tab without crowding the main hand console.
- [x] The active hand view shows the latest public action near the hand console.
- [x] The panel area defaults to action log during active hands and keeps chat available with an unread indicator.
- [x] Waiting and settled phases may give chat and table management more room without weakening the active-hand flow.
- [x] Host-only controls move into a Manage drawer, except `Start hand`, `Deal next hand`, and eligible `Auto-fold inactive`, which may surface contextually.
- [x] Invite link and tutorials remain accessible on mobile without occupying the active-hand primary surface.
- [x] Controls are keyboard-operable, visibly focused, labeled for assistive technology, and do not rely on hover-only interactions.
- [x] Text, buttons, cards, and panels do not overlap or resize unpredictably at mobile widths.
- [x] Playwright mobile viewport coverage verifies creating/joining a table, starting a hand, reading the hand console, opening the raise sheet, switching log/chat/players/manage panels, and performing representative legal actions.
- [x] Existing desktop table-room layout remains usable and is not materially redesigned by this issue.

## Notes

- Preserve the server-authoritative model: the client only renders table snapshots and sends player intents.
- Do not change poker rules, realtime event contracts, table snapshot shapes, or hidden-card privacy behavior unless a separate contract-gated issue is created.
- This is a client UX improvement issue. If implementation discovers that snapshot data is missing for the desired mobile affordances, split that contract work into a separate issue before changing shared types or socket payloads.

## Comments

- Design discussion selected a simple mobile hand-console direction over a compressed tabletop layout.
