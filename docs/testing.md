# Testing

This is the single source of truth for how Friendly Hold'em is tested and how to run the tests. Other docs link here instead of repeating this content.

Audience: both human contributors and coding agents.

## Strategy

- **The domain engine is the foundation.** The poker engine (`applyCommand(tableState, command)`) is pure TypeScript and must be testable without Socket.IO, React, or a running server. Domain tests are written before UI polish.
- **Domain tests cover the rules that are easy to get wrong:** deck uniqueness, blinds, legal-action calculation, betting-round progression, fold/check/call/raise/all-in, main pot and side-pot creation, split pots, showdown winner selection, and heads-up button/blind behavior.
- **E2E tests cover the real user path** end to end through the client, Socket.IO, and server: creating a table, joining from an invite link, starting a hand, representative player actions, reconnect behavior, and mobile turn-focused layout usability.
- **Leave the repo healthier.** Update or add tests relevant to any change. For game-logic changes, tests are required unless there is a clearly explained reason no test can be added.

The concrete domain-engine cases and E2E acceptance criteria are specified as requirements in [requirements.md](requirements.md) (Milestone 1). The architecture rationale lives in [architecture.md](architecture.md).

## Test layers

| Layer | Tool | Location | What it exercises |
| --- | --- | --- | --- |
| Unit / domain | Vitest | `apps/server/src/**/*.test.ts`, `apps/client/tests/**/*.test.ts(x)`, `packages/shared/src/**/*.test.ts` | Pure logic: domain engine, bot strategy, config, table store, persistence, shared types, client config/PWA. |
| End-to-end | Playwright | `tests/e2e/*.spec.ts` | Full app across desktop + mobile browsers, with dev servers auto-started. |
| Production smoke | Playwright | `tests/e2e/production-smoke.spec.ts` | The built React app served by the compiled Node server. |

### Where tests live

```text
apps/server/src/
  activeTablePersistence.test.ts
  botStrategy.test.ts
  config.test.ts
  tableStore.test.ts
apps/client/tests/
  pwa.test.ts
  vite-config.test.ts
packages/shared/src/
  index.test.ts
tests/e2e/
  basic-betting-hand.spec.ts
  reconnects-disconnects-inactive.spec.ts
  production-smoke.spec.ts        # run only by test:e2e:prod
```

### Configuration

- `vitest.workspace.ts` — Vitest workspace covering `packages/shared`, `apps/server`, `apps/client`.
- `apps/server/vitest.config.ts` — node environment, `src/**/*.test.ts`.
- `apps/client/vitest.config.ts` — jsdom + React plugin, `src` and `tests` `.test.ts(x)`.
- `packages/shared/vitest.config.ts` — shared-types tests.
- `playwright.config.ts` — E2E; `testDir: tests/e2e`, ignores the production smoke spec, runs 5 browser projects (chromium, firefox, webkit, mobile-chrome/Pixel 7, mobile-safari/iPhone 15), and starts the server (`:8787`) and client (`:5173`) via `webServer`.
- `playwright.production.config.ts` — runs only `production-smoke.spec.ts` against the built server on `:8788`.

## Running tests

```bash
pnpm test            # unit tests: vitest run across all workspace packages
pnpm test:e2e        # Playwright E2E across all 5 browser projects (auto-starts dev servers)
pnpm test:e2e:prod   # build client/server/shared, start compiled server, run production smoke
pnpm typecheck       # tsc -b
pnpm lint            # lint all packages
```

Scope unit tests narrowly while iterating:

```bash
pnpm --filter @friendly-holdem/server test               # one package
pnpm --filter @friendly-holdem/server test -- botStrategy # one file/pattern
pnpm -r test                                             # full unit validation
```

Recommended order when validating a change: narrowest unit test first → `pnpm -r test` → `pnpm typecheck` → `pnpm test:e2e` if the change touches realtime/UI behavior.

### First-time E2E setup (browsers + system libraries)

Playwright needs the browser binaries and, on Linux, their system libraries:

```bash
pnpm exec playwright install               # download chromium, firefox, webkit
pnpm exec playwright install-deps          # install OS libraries (needs sudo)
```

`install-deps` runs `apt-get` under `sudo`, so run it in a terminal where you can enter your password. **The WebKit and mobile-safari projects will not launch without it** — they fail at browser startup with `Host system is missing dependencies` (e.g. `libgtk-4.so.1`, `libwoff2dec.so.1`, `libgstreamer*`). Chromium and firefox generally run without the extra libraries, so on a constrained machine you can still validate most of the suite with `--project=chromium --project=firefox`.

If browser downloads fail behind a TLS-intercepting proxy with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, point Node at the system CA bundle for the install (do **not** disable TLS verification):

```bash
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt pnpm exec playwright install
```

## Intentional E2E skips

`pnpm test:e2e` runs each spec across the configured desktop and mobile browser projects, so some skips are expected by design:

- The reconnect/disconnect/inactivity lifecycle spec runs **only in Chromium** — it covers browser storage, Socket.IO reconnects, and server timers once rather than multiplying the same lifecycle checks across every browser.
- The mobile layout spec **skips desktop projects** because it is only meaningful in mobile browser projects.

Seeing `19 skipped` can therefore be expected when the skipped tests match those project filters.

## Codex / PowerShell note

This repo uses Unix-style `nvm` under the user profile, which Codex PowerShell sessions do not source. Before running Node or pnpm in Codex, prepend the active NVM Node bin directory and use the `.cmd` shim (PowerShell execution policy may block `.ps1` shims):

```powershell
$nodeBin = Join-Path $env:USERPROFILE '.nvm\versions\node\v24.14.0\bin'
$env:PATH = "$nodeBin;$env:PATH"
pnpm.cmd test
```

Use `pnpm.cmd`, not bare `pnpm`, from PowerShell in Codex.
