Status: ready-for-agent

# Add Playwright E2E and deployment readiness

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Finish MVP verification and deployment readiness. Add Playwright multiplayer smoke coverage for the core flows, mobile viewport coverage for the turn-focused layout, production build validation, and a deployment path suitable for a single always-on Node web service that supports WebSockets. The provider remains open.

## Acceptance criteria

- [ ] Playwright E2E covers host creating a private table and receiving an invite link.
- [ ] Playwright E2E covers another participant joining from the invite link with a display name.
- [ ] Playwright E2E covers host starting a hand.
- [ ] Playwright E2E covers representative player actions through at least one meaningful hand path.
- [ ] Playwright E2E covers reconnecting or refreshing with the same browser session.
- [ ] Playwright mobile viewport coverage verifies the turn-focused layout remains usable for acting on a hand.
- [ ] Production build scripts produce deployable client and server artifacts.
- [ ] The server can run as a single always-on Node web service that supports WebSockets.
- [ ] The Node service can serve the built React app or clearly documents how it pairs with static hosting.
- [ ] Deployment documentation describes required environment/config values.
- [ ] Structured logs include startup config summary excluding secrets and key runtime events.
- [ ] MVP can be run in a production-like mode and used from separate browser sessions/devices.

## Blocked by

- `.scratch/friendly-holdem/issues/07-handle-reconnects-disconnects-and-inactive-players.md`
- `.scratch/friendly-holdem/issues/08-add-chat-tutorials-notifications-and-mobile-table-ux.md`
- `.scratch/friendly-holdem/issues/09-add-basic-pwa-installability.md`
