Status: ready-for-agent
Category: security

# Cap table/spectator creation and make the rate limiter real

## Parent

`docs/tech-debt-report.md` (P1, item 5)

## What to build

Two availability gaps let a single client exhaust the server. Table creation has no cap, and joining an in-progress table creates unbounded spectator participants — each subsequent action re-serializes the whole participant list. The invalid-command rate limiter is cosmetic: it only runs in the error/catch path and merely relabels the rejection message; it never blocks execution and never counts successful commands.

Add a configurable cap on total active tables and on spectators per table, and rework the rate limiter so it actually throttles command volume (including successful commands) per connection, rejecting once over budget with the standard command-rejected response.

## Acceptance criteria

- [ ] Table creation is rejected once a configurable maximum number of active tables is reached.
- [ ] Spectator joins are rejected once a configurable per-table spectator cap is reached.
- [ ] The rate limiter blocks further commands (not just relabels messages) when a connection exceeds its command budget in the window, and it counts successful commands.
- [ ] Limits are configurable via config with sensible defaults; over-limit responses use the standard command-rejected shape.
- [ ] Tests cover the table cap, the spectator cap, and the throttle actually rejecting excess commands.

## Blocked by

- None - can start immediately
