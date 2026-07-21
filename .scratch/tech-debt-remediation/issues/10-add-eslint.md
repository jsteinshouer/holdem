Status: ready-for-agent
Category: refactor

# Add ESLint beyond tsc

## Parent

`docs/tech-debt-report.md` (P3, item 10)

## What to build

Every package's `lint` script is just `tsc -p tsconfig.json --noEmit` — an alias for typecheck. There is no linter catching unused variables, dead code, floating promises, React hook dependency issues, or file-size/complexity. A complexity/max-lines rule would have flagged the two god-files early.

Add ESLint with `@typescript-eslint` and `eslint-plugin-react-hooks`, wire it into the lint scripts, and resolve (or baseline) the findings. The strict tsconfig makes adoption cheap.

## Acceptance criteria

- [ ] ESLint is configured for the monorepo with `@typescript-eslint` and `react-hooks` rules, including `no-floating-promises` and `exhaustive-deps`.
- [ ] The `lint` script runs ESLint (alongside or in addition to typecheck) and passes clean.
- [ ] A `max-lines` / complexity rule is enabled (warn is acceptable) to flag future god-files.

## Blocked by

- None - can start immediately
