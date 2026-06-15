# Deployment

Friendly Hold'em can run as one always-on Node web service that supports WebSockets. The provider is intentionally open, but the runtime must keep a long-lived Node process alive and allow Socket.IO WebSocket upgrades.

## Build Artifacts

Run from the repository root:

```bash
pnpm install
pnpm build
```

The build produces:

- `apps/client/dist` for the React app and static PWA assets.
- `apps/server/dist` for the compiled Node server.
- `packages/shared/dist` for shared runtime types and constants used by the server.

Start the production service with:

```bash
pnpm start
```

The server serves `apps/client/dist` when that build output exists. Browser routes such as `/table/<id>` fall back to the React app shell, while `/healthz` returns a JSON health response. If the client build is not present, the server still starts and returns the health response so server-only diagnostics remain possible.

## Required Environment

- `PORT`: Node service port. Defaults to `8787`.
- `CLIENT_ORIGIN`: Public browser origin allowed by Socket.IO CORS, such as `https://your-friendly-holdem.example.com`. For the single-service production path, set this to the same origin users open in their browser.
- `DEFAULT_STARTING_STACK`: Fake chip starting stack. Defaults to `1000`.
- `DEFAULT_SMALL_BLIND`: Small blind. Defaults to `5`.
- `DEFAULT_BIG_BLIND`: Big blind. Defaults to `10`.
- `DISCONNECTED_ACTION_GRACE_MS`: Grace period before an away current actor is auto-checked or auto-folded. Defaults to `30000`.
- `HOST_AUTO_FOLD_AFTER_MS`: Delay before the host can auto-fold a connected inactive actor. Defaults to `120000`.
- `EVENT_LOG_CAP`: Maximum recent public table events retained in memory. Defaults to `200`.

Do not put secrets in these values. The MVP uses private invite links and browser-held session tokens, but no database credentials or third-party API keys are required.

## Static Hosting Alternative

If a provider serves static assets separately, deploy `apps/client/dist` to that static host and deploy `apps/server/dist` as an always-on Node service with WebSockets enabled. Build the client with `VITE_SERVER_URL` set to the public server origin, and set the server's `CLIENT_ORIGIN` to the public static-site origin.

## Production-Like Validation

Run:

```bash
pnpm test:e2e:prod
```

This builds the workspace, starts the compiled server on `127.0.0.1:8788`, serves the built React app from the Node service, and runs a Playwright smoke test from separate browser sessions.
