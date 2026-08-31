# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Host** — one person in a friend group who creates a table, shares the private link, and runs the game: starts the first hand, deals each next hand, approves rebuys, seats spectators, removes or auto-folds inactive players, resets the table, and can add bots to fill seats. The host cannot alter cards, pots, results, or another player's action.

**Player** — a friend who opens the link, types a display name, and is auto-seated. Plays no-limit Texas Hold 'em with play-money chips, chats, and reconnects to the same seat after a refresh, a disconnect, or a server restart. Skill is explicitly mixed: the product assumes some players have never played Hold 'em before and must be able to sit down and learn mid-game without slowing the table.

**Spectator** — joins from the same private link to watch public table state and chat. Cannot act and cannot see hole cards. Anyone joining after the first hand starts arrives as a spectator until the host seats them.

There are no accounts. Identity is a display name plus a browser-held session token, scoped to one table.

## Product Purpose

Friendly Hold'em lets a group of friends get from a link in a group chat to a dealt hand with as little ceremony as possible, and keeps the game correct so nobody has to argue about the rules.

It is a personal build and a portfolio piece. Success is measured as craft: the work is read and evaluated by other engineers and designers, not only played. That means the surface itself is a deliverable, and the standard is higher than "it works for my friends." Real play is the proof, not the scoreboard.

The game is play-money only. There are no deposits, withdrawals, prizes, cash-out, or real-money wagering of any kind, and nothing in the product may imply otherwise.

## Positioning

Three commitments, confirmed by the user, that a neighboring free home-game site could not truthfully copy all at once:

1. **Frictionless: link, name, play.** No accounts, no login, no email, no ads, no upsells, no chip economy, no lobby to browse. A high-entropy invite link and a display name are the entire onboarding.
2. **Welcoming to people who have never played.** A first-timer can join a live table and learn as they go. Beginner and host tutorials are available from the UI without blocking experienced players, and the table itself is expected to teach — legal actions, current bet, pot, and turn are read off the screen, not from memory.
3. **Genuinely good on a phone.** Home games happen with people on couches holding phones. Mobile uses a compact turn-focused layout rather than a shrunken poker table, and it is a designed surface, not a fallback.

Correct poker is table stakes here, not a differentiator: side pots, split pots, minimum-raise and all-in raise behavior, heads-up button and blind rules, and showdown reveal rules are implemented and must stay correct.

## Operating Context

- **The scene:** a group in a chat thread, some together and some remote, on a mix of phones and laptops. Sessions are one continuous table across many hands, with the host driving the rhythm between hands.
- **Device priority:** phone and desktop are both first-class. Neither wins a conflict by default; conflicts are decided case by case rather than by a standing rule.
- **Distribution:** one private link, pasted into a chat. There is no discovery surface, no public lobby, and no matchmaking.
- **Mobile layout contract:** mobile prioritizes acting on the current turn, seeing your hole cards, reading the board, checking stack/pot/current bet, and following essential action history. Nonessential panels collapse behind tabs, drawers, or compact controls. Chat sits behind a tab or drawer with an unread indicator.
- **Turn awareness:** a player may not be looking at the screen when action reaches them. Minimal turn notification is in scope — visual emphasis, browser title change, and an optional short sound or vibration. Broader card, chip, and ambient sound effects are deferred.
- **Installability:** the app is an installable PWA with a manifest, icons, theme color, and a service worker caching the app shell and static assets. It can be launched standalone from a home screen.
- **Browser targets:** latest Chrome, Edge, Firefox, and Safari on desktop; mobile Safari and mobile Chrome on phones.

## Capabilities and Constraints

Built and shipped:

- Private invite-link tables for 2 to 6 seated players, plus unlimited spectators, with no accounts.
- Server-authoritative no-limit Texas Hold 'em. Clients send intents only (fold, check, call, raise, all-in); the server validates every action and owns turn order, dealing, pots, and winners.
- All-in, side pots, split pots, heads-up blind and button rules, minimum-raise and all-in raise behavior, and hand ranking with ties.
- Showdown reveals hole cards only for players still contesting at least one pot. If everyone but one player folds, the winner's cards stay hidden. Folded players' cards stay hidden. Settlement summaries name who won each pot and with what hand.
- Player-specific full table snapshots over Socket.IO: a client only ever receives hidden information it is allowed to see.
- Active table persistence — a table and its in-progress hand survive a server restart and are recoverable by invite link plus session token. SQLite-backed behind a narrow persistence port, storing versioned serialized table state rather than a relational hand history. Live socket connections are not preserved; participants reconnect.
- Reconnection: a disconnected player keeps their seat. When action reaches them the server waits a grace period, then auto-checks if legal or auto-folds. A disconnected all-in player stays eligible for pots. Between hands they are marked sitting out and skipped.
- Host-approved rebuys between hands, restoring a busted player toward the starting stack. No automatic rebuys.
- Bot players the host can add to fill seats.
- Table chat scoped to the table: display name, timestamp, length limit. No DMs, uploads, rich formatting, or persistence.
- Public action log covering blinds, checks, calls, raises, folds, street deals, all-ins, and settlement summaries. It must never reveal hidden cards outside showdown rules.
- Beginner and host tutorials as static step-by-step help screens, reachable from the UI and non-blocking.
- Light and dark themes, with the choice persisted and applied before first paint. Light is the default.

Fixed defaults (configurable in code, not by users): $1,000 starting stack, $5 small blind, $10 big blind.

Constraints that shape future work:

- Server-authoritative is non-negotiable. The client renders snapshots and sends intents; it never computes game outcomes.
- The server must never send a player's hidden hole cards to anyone else. All socket commands are validated server-side. Chat and repeated invalid commands are rate-limited. Display names and chat content are sanitized before rendering. Table IDs and session tokens use secure randomness. Logs never contain hole cards or session tokens.
- Deployment targets a single always-on Node service that supports WebSockets. Serverless-only hosting is excluded.
- Cards render as local CSS/HTML, not licensed image assets.

Deliberately out of scope, and not to be invented: real-money anything, accounts and profiles, public lobby or matchmaking, tournaments and multi-table play, long-term hand history or replay, table passwords, manual seat picking, offline play, push notifications, native app packaging, and casino-grade audit trails. Casino-room edge cases (missed blind penalties, dead button complexity, show/muck choices) are deliberately deferred.

## Brand Commitments

- **Name:** Friendly Hold'em. Short name "Hold'em". The apostrophe form is `Hold'em` in the product name and `Hold 'em` when referring to the game itself.
- **Existing assets:** app icon and maskable icon (SVG plus 192/512 PNG) at `apps/client/public/icons/`, PWA manifest at `apps/client/public/manifest.webmanifest`.
- **Binding visual constraint, stated in `docs/requirements.md`:** the app should feel like a minimal tabletop game room, emphasizing clarity over casino theming. Recorded as-is; any visual world is decided in DESIGN.md, not here.
- **Tone follows the positioning:** friendly and unintimidating, because a first-timer is expected at the table. Never a gambling pitch.
- **Standing visual preference (chosen 2026-08-29):** the category standard, played straight. When offered a replacement visual world, the user chose the card-room canon — green felt table, brass/gold, paper cards — executed at full fidelity rather than reinterpreted. This is a durable preference, not a one-time answer: future surfaces inherit the card room unless the user reopens it.
- **Fidelity ceiling:** flat. No photographic depth, 3D rendering, or skeuomorphic texture anywhere. The surface reads as a card room through color, shape, and proportion alone. This keeps both themes and both device classes sharp and is a deliberate constraint, not a budget compromise.
- **Craft bar:** PokerNow — the closest real peer (browser, link-based, no accounts, home games). Its finish level is the floor this product must clear.

## Evidence on Hand

- `docs/product-brief.md`, `docs/requirements.md`, `docs/architecture.md`, `docs/domain-model.md`, `docs/realtime-events.md`, and `CONTEXT.md` are the existing product and domain record. `docs/requirements.md` is the decision source of record.
- `apps/client/public/screenshots/table-wide.png` (1280×720) and `table-mobile.png` (390×844) are referenced by the PWA manifest, but they are **mock illustrations, not captures of the shipped UI** — a drawn ellipse with placeholder cards and plain-text panel labels. They do not depict the real table and should be replaced with true screenshots.
- Working implementation: `apps/client/src/main.tsx` and `styles.css`, `apps/server/src/`, `packages/shared/`.
- Test suites exist at every layer — domain unit tests, realtime tests, and Playwright E2E including a mobile-viewport suite and a production smoke suite (`docs/testing.md`).
- **No testimonials, user counts, reviews, press, benchmarks, pricing, or third-party endorsements exist.** There is no real player base to cite — this is a personal build. Future work must not fabricate any of these.

## Product Principles

1. **The link is the whole onboarding.** Anything that stands between a pasted link and a seat at the table is a defect. No accounts, no ads, no upsells, no lobby.
2. **The table teaches.** A player who has never played Hold 'em should be able to act correctly from what is on screen. Never assume poker literacy; never make the experienced player pay for that.
3. **The server is the truth.** The client renders and requests; it never decides. Correctness of the game — pots, turn order, reveals — is never traded for interface convenience.
4. **Phone and desktop are both the real product.** Mobile is a designed turn-focused surface, not a compressed desktop. Neither device wins a conflict by default.
5. **This is read as craft.** The work is a portfolio piece; the finish quality of the surface is part of the deliverable, not a nicety after the logic works.

## Accessibility & Inclusion

Required baseline, from `docs/requirements.md`:

- All action controls are keyboard-operable; the UI never relies on hover-only controls.
- Interactive elements have visible focus states.
- Buttons and inputs carry clear accessible labels; every form input has a label.
- Color is never the only indicator of state or available action — this matters most for turn indication, legal actions, and card suits.
- Contrast is sufficient, in both light and dark themes.
- Turn and action status are readable by assistive technology where practical.

No formal conformance level (e.g. WCAG 2.2 AA) has been committed to. Undecided, not waived.
