Status: ready-for-agent
Category: bug

# Odd-chip split: button-relative or documented

## Parent

`docs/tech-debt-report.md` (P3, item 14)

## What to build

Odd chips left over from a split pot are currently awarded to the lowest absolute seat number among the winners. The standard poker rule awards the odd chip to the first eligible player to the left of the button. This is currently an intentional simplification (an existing test asserts "by seat order"), so it is a rules deviation, not a state-corruption bug.

Decide and act: either implement button-relative odd-chip distribution, or explicitly document the seat-order behavior as an intentional simplification in the domain docs.

**Test-first (only if changing behavior):** write a test asserting the odd chip goes to the first eligible player left of the button before implementing the change.

## Acceptance criteria

- [ ] A decision is recorded: button-relative distribution vs. documented seat-order simplification.
- [ ] If changing behavior: a test asserts the odd chip goes to the first eligible player left of the button and passes after the change; any conflicting existing test is updated.
- [ ] If documenting only: the seat-order rule is noted in the domain docs and the existing test comment references it as intentional.

## Blocked by

- None - can start immediately
