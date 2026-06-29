# 2026-06-16 Dev Server Debugging

Source sessions:

- `C:\Users\jsteinshouer\.codex\sessions\2026\06\16\rollout-2026-06-16T08-10-44-019ed08e-2f45-7ce2-b4f5-a231dbad8ace.jsonl`
- `C:\Users\jsteinshouer\.codex\sessions\2026\06\16\rollout-2026-06-16T08-59-24-019ed0ba-bdd1-7da2-a103-f24c4c70f457.jsonl`
- `C:\Users\jsteinshouer\.codex\sessions\2026\06\16\rollout-2026-06-16T09-14-31-019ed0c8-92b0-7f13-b066-91064c9a16cb.jsonl`

## Socket.IO Failure

The reported issue was that Socket.IO calls were failing in local development.

Root cause:

- The client was served by Vite.
- The client defaulted Socket.IO to `window.location.origin`.
- Without a Vite proxy, Socket.IO traffic went to `localhost:5173/socket.io`.
- The Node server was on `8787`, so the handshake failed.

Fix recorded in the session:

- Added a `/socket.io` dev proxy in `apps/client/vite.config.ts`.
- Added a `SOCKET_PROXY_TARGET` override for nonstandard local ports.
- Added a regression test in `apps/client/tests/vite-config.test.ts`.

Validation recorded in the session:

- Reproduced the failure as `connect_error websocket error`.
- Verified a live Vite-proxied Socket.IO smoke test.
- Confirmed `table:create` returned `ok: true`.
- `pnpm.cmd test` passed.
- `pnpm.cmd lint` passed.
- `pnpm.cmd build` passed.

## Dev Script Follow-Up

A later dev command failed with the server script shape:

```json
"dev": "node --env-file=../../.env --import tsx watch src/index.ts"
```

The session identified that `watch` was being treated like an entry file. The recommended shape was:

```json
"dev": "node --env-file-if-exists=../../.env --env-file-if-exists=../../.env.local --watch --import tsx src/index.ts"
```

For production start, the recommended shape was:

```json
"start": "node --env-file-if-exists=../../.env --env-file-if-exists=../../.env.local dist/index.js"
```

## Config Rollback Note

A follow-up noted that reverting a `config.ts` env-file loading change made the local error go away.

Important guidance:

- Leave `config.ts` reverted if it was reading env files directly.
- Let the process environment provide env vars instead of having application config read `.env` itself.
- The env-file loader was too invasive for the repo's dev flow.
- Loading `.env` in config may enable SQLite during `pnpm dev`, adding startup work while Vite is already proxying requests.
- The visible `ECONNREFUSED` can be a parallel-start race when Vite reaches the server before it is ready.

Suggested local SQLite run shape:

```powershell
$env:ACTIVE_TABLE_PERSISTENCE="sqlite"
$env:ACTIVE_TABLE_SQLITE_PATH="../../.data/holdem-tables.sqlite"
pnpm.cmd dev
```

## User Validation

Restart `pnpm.cmd dev`, open `http://localhost:5173`, and create a Table. Socket.IO should connect through the Vite proxy without requiring `VITE_SERVER_URL`.

