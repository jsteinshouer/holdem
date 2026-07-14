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

- [ ] A failing test demonstrates that a malformed-percent-encoding request (e.g. `/%`) currently throws / would crash the request handler.
- [ ] Malformed URLs return a controlled `400` response and do not throw out of the request listener.
- [ ] A top-level `uncaughtException` / `unhandledRejection` handler logs the error and prevents silent process death.
- [ ] Valid static routes and the SPA index fallback continue to work, and `/healthz` still responds.
- [ ] The reproduction test passes after the fix.

## Blocked by

- None - can start immediately
