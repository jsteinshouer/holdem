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
