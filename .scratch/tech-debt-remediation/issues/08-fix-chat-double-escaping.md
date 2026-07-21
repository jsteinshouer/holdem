Status: ready-for-agent
Category: bug

# Fix chat double-escaping

## Parent

`docs/tech-debt-report.md` (P2, item 8)

## What to build

Chat bodies are HTML-escaped on the server before storage, then escaped again by React when rendered as text nodes. A message like `A & B` is stored as `A &amp; B` and displayed literally as `A &amp; B`; `<`, `>`, `'`, and `"` all mis-render. HTML escaping is a presentation concern that does not belong in the game store — React already makes text-node output XSS-safe, and the client uses no `innerHTML`.

Store the normalized raw chat body and remove the server-side HTML escaping from the chat path.

**Test-first:** before the fix, write a failing test showing a chat message containing `& < > ' "` is stored/rendered double-escaped.

## Acceptance criteria

- [ ] A failing test shows a chat message containing HTML-special characters is double-escaped (entities stored) before the fix.
- [ ] The server stores the normalized raw body; the `escapeHtml` step is removed from the chat path.
- [ ] Messages containing `& < > ' "` render exactly as typed in the client.
- [ ] No XSS regression: user text is still rendered only as React text nodes (no `innerHTML`/`dangerouslySetInnerHTML`).
- [ ] The reproduction test passes after the fix.

## Blocked by

- None - can start immediately
