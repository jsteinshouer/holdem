# Friendly Hold'em

Private-link, play-money Texas Hold 'em for friends.

## Workspace

- `apps/client` - React, Vite, and TypeScript browser app.
- `apps/server` - Node.js and TypeScript server skeleton.
- `packages/shared` - shared TypeScript types for client and server.

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
```

Copy `.env.example` to `.env.local` or export matching environment variables before running the server with non-default settings.

Bash with NVM:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

nvm use 24.14.0
corepack enable
pnpm install
pnpm dev
```

## E2E test skips

`pnpm test:e2e` runs each Playwright spec across the configured desktop and mobile browser projects. Some skips are intentional:

- The reconnect/disconnect/inactivity lifecycle spec runs only in Chromium because it covers browser storage, Socket.IO reconnects, and server timers once without multiplying the same lifecycle checks across every browser.
- The mobile layout spec skips desktop projects because it is only meaningful in mobile browser projects.

For example, seeing `19 skipped` can be expected when the skipped tests match those project filters.

pnpm dev runs both packages in parallel:

```
client Vite app at http://localhost:5173
server at http://localhost:8787
```

In Codex/PowerShell, use:

```
$nodeBin = Join-Path $env:USERPROFILE '.nvm\versions\node\v24.14.0\bin'
$env:PATH = "$nodeBin;$env:PATH"
pnpm.cmd dev
```
