Status: ready-for-agent

# Add basic PWA installability

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Add basic Progressive Web App installability without adding offline gameplay or dedicated offline recovery behavior. The app should include a manifest, app name, icons, theme color, and service worker support for app-shell/static asset caching so it feels easy to return to from desktop and mobile browsers.

## Acceptance criteria

- [ ] The client includes a valid web app manifest.
- [ ] The manifest includes app name, icons, and theme color.
- [ ] Static assets required for the app shell are cacheable through a service worker.
- [ ] PWA setup does not imply offline gameplay, offline table recovery, background sync, or push notifications.
- [ ] PWA behavior does not interfere with Socket.IO connection behavior during normal online play.
- [ ] Build/test checks verify manifest presence and service worker registration or generated output.

## Blocked by

- `.scratch/friendly-holdem/issues/08-add-chat-tutorials-notifications-and-mobile-table-ux.md`
