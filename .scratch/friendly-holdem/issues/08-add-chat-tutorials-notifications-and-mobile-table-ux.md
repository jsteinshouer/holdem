Status: ready-for-agent

# Add chat, tutorials, notifications, and mobile-first table UX

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Complete the social and usability layer for the MVP. Add lightweight table chat, visible public action log UI, static beginner and host tutorials, minimal optional turn notification, accessible controls, a clear desktop tabletop layout, and a compact turn-focused mobile layout. This slice may make local UI design decisions that improve clarity and responsiveness without changing product rules.

## Acceptance criteria

- [ ] Players and spectators can send bounded table-scoped chat messages.
- [ ] Chat messages are sanitized or escaped before rendering.
- [ ] Chat and repeated invalid commands are rate-limited.
- [ ] Desktop UI shows a clear minimal tabletop game-room layout.
- [ ] Mobile UI uses a compact turn-focused layout that prioritizes current action, hole cards, board, pot/current bet, stack, and essential action history.
- [ ] Mobile chat is behind a tab or drawer, with unread indication if practical.
- [ ] Public action log UI shows blinds, checks, calls, raises, folds, street deals, all-ins, and settlement summaries.
- [ ] Action log does not reveal hidden cards unless showdown rules reveal them.
- [ ] Static beginner tutorial explains hand flow, blinds, hole cards, community cards, betting rounds, actions, all-in, side pots at a high level, showdown, and winning hands.
- [ ] Static host tutorial explains creating a game, sharing the link, starting the first hand, dealing the next hand, approving rebuys, seating spectators, and handling inactive players.
- [ ] Tutorials are available without blocking experienced players.
- [ ] Optional turn notification includes visual emphasis and may include browser title change, short sound, or vibration.
- [ ] Action controls are keyboard-operable, visibly focused, clearly labeled, and do not rely on hover-only interactions.
- [ ] UI uses sufficient contrast and does not rely on color alone for state.
- [ ] UI tests or Playwright coverage verify core desktop and mobile gameplay usability.

## Blocked by

- `.scratch/friendly-holdem/issues/04-play-basic-betting-hand-through-settlement.md`
