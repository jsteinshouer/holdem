Status: ready-for-agent
Category: refactor

# Split the client god-file and add component tests

## Parent

`docs/tech-debt-report.md` (P2, item 7)

## What to build

`main.tsx` is ~1,401 lines containing the app shell, roughly a dozen components, all formatting/session helpers, the socket command wrapper, and the bootstrap. It is idiomatic React, but nothing is independently importable, which is the direct cause of the client having no component/unit tests (only `tableView.ts` and `pwa.ts` are covered).

Break it into per-component files, extract the socket/command wiring into a hook and the localStorage session helpers into their own module, and leave a thin bootstrap. Because components become importable, add unit tests for the previously-untested client logic.

## Acceptance criteria

- [ ] Components live in their own files; socket/command wiring is a reusable hook; session helpers are their own module; `main.tsx` only bootstraps.
- [ ] No behavior change: existing Playwright E2E passes.
- [ ] New unit tests cover at least the previously-untested client logic (e.g. turn notification/title effect, unread-chat counting) and that a couple of components render.

## Blocked by

- None - can start immediately
