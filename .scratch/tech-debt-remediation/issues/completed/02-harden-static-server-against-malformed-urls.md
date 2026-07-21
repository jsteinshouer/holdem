Status: ready-for-agent
Category: security

# Harden static file server against malformed URLs and add a crash safety net

## Parent

`docs/tech-debt-report.md` (P0, item 2)

## What to build

The static file server decodes the request path with `decodeURIComponent`, which throws a `URIError` on a malformed percent-escape (e.g. `GET /%`). The HTTP request listener is synchronous with no surrounding try/catch, and there is no process-level exception handler anywhere, so a single unauthenticated malformed request kills the process for everyone in production static-serving mode.

Make request handling resilient: catch decoding/handler errors and return a controlled `400` (or a safe fallback) instead of letting them propagate, and add a top-level `uncaughtException` / `unhandledRejection` handler that logs and keeps the server alive.

**Test-first:** before the fix, write a failing test that shows a malformed-percent-encoding request currently throws out of the request handler / would crash the process.

## Acceptance criteria

- [x] A failing test demonstrates that a malformed-percent-encoding request (e.g. `/%`) currently throws / would crash the request handler.
- [x] Malformed URLs return a controlled `400` response and do not throw out of the request listener.
- [x] A top-level `uncaughtException` / `unhandledRejection` handler logs the error and prevents silent process death.
- [x] Valid static routes and the SPA index fallback continue to work, and `/healthz` still responds.
- [x] The reproduction test passes after the fix.

## Blocked by

- None - can start immediately

## Comments

- 2026-07-14 (reviewer): Verdict PASS-WITH-NITS. All 5 acceptance criteria met.
  Server suite `pnpm test` green (105 passed, incl. 4 `staticFileHandler` tests);
  `pnpm typecheck` clean. Verified the malformed-URL guard is real: `/%`, `/%c0`,
  and `/%zz` all make `decodeURIComponent` throw `URIError`, and the `it.each`
  test asserts `not.toThrow()` + status 400, so it would fail if the try/catch
  were removed. Deterministic (fake response, no I/O) — not flaky. Prefactor is
  behavior-preserving: extracted functions are byte-identical to the deleted
  `index.ts` bodies; `/socket.io/`, `/healthz`, and `!staticClientAvailable`
  wiring untouched. The try only wraps `resolveStaticResponse` (not the stream),
  so it does not over-broadly swallow streaming errors; non-URIError -> 500.
  Nits (non-blocking, P3): (1) the top-level `uncaughtException` /
  `unhandledRejection` handlers are covered by inspection only — verified by
  reading (they log via `logger.error` and never `process.exit`, and a
  registered `uncaughtException` listener suppresses Node's default exit, so
  process death is prevented); a spawned-subprocess integration test could add
  regression coverage. (2) No automated test exercises `/healthz` or streams a
  real asset; the `/` -> index.html resolution is covered and the `/healthz`
  branch + streaming code are unchanged from the pre-fix behavior.
