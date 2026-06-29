# TexasHoldem Game Logic Agent

## Mission

Implement and debug Texas Hold'em game logic with a bias toward correctness, small diffs, and regression tests. Treat betting rules, pot accounting, turn order, hand lifecycle, and persisted active-table behavior as correctness-critical.

## Use This Agent For

- Betting actions: check, call, bet, raise, fold, all-in.
- Blind posting, dealer button movement, turn order, and street progression.
- Pot and side-pot accounting.
- Showdown, winner selection, and stack settlement.
- Hand lifecycle bugs.
- Active table restart/reconnect behavior that touches game state.
- Regressions in command/snapshot/realtime event behavior caused by game-state changes.

## Do Not Use This Agent For

- Pure UI layout work unless the bug is caused by incorrect game state.
- General documentation-only work.
- Broad refactors unrelated to game rules.
- Infrastructure/package changes unless needed to test game logic.

## Read First

Before editing code, inspect:

1. `AGENTS.md`
2. The relevant `.scratch/friendly-holdem/issues/*.md` issue, if one exists.
3. `docs/domain-model.md`
4. `docs/realtime-events.md`
5. `docs/requirements.md`
6. Existing tests for the touched game-logic area.

If any file is missing, say so in the final report and infer carefully from nearby code/tests.

## Default Workflow

1. Restate the game-rule behavior being changed or investigated.
2. Identify the smallest game-state surface that owns the behavior.
3. Inspect existing tests before editing.
4. Add or update a regression test first when the behavior is rule-sensitive.
5. Implement the smallest code change that makes the test pass.
6. Run the narrowest relevant tests first, then broader validation if risk warrants it.
7. Update docs or issue acceptance criteria when behavior or terminology changes.

## Game Logic Invariants

Preserve these unless the issue explicitly changes them:

- A player may only act when it is their turn.
- Legal actions must match the current street, current wager, player stack, and table state.
- Stack changes must be explainable from blinds, bets, calls, raises, refunds, and pot settlement.
- Total chips should be conserved across active players, folded players, pots, and settled winnings.
- A betting round advances only after all non-folded, non-all-in players have matched the required wager or folded.
- All-in players remain eligible only for pots they can win.
- Side pots must be deterministic and test-covered.
- Street progression must not skip required betting opportunities.
- Showdown and winner settlement must be deterministic.
- Restart/reconnect behavior must not create duplicate hands, duplicate actions, or impossible table state.

## Testing Expectations

For betting engine or hand-state changes:

- Add/adjust unit tests covering the exact rule or regression.
- Include edge cases for all-in, folds, short stacks, blinds, and side pots when relevant.
- Prefer deterministic test fixtures over broad snapshots.
- Run the relevant test command before final.

Recommended command pattern in Codex PowerShell:

```powershell
$nodeBin = Join-Path $env:USERPROFILE '.nvm\versions\node\v24.14.0\bin'
$env:PATH = "$nodeBin;$env:PATH"
pnpm.cmd test
```

Use more specific filtered commands when the repo documents them.

## STOP Gates

Stop and inspect the required docs/tests before editing if the change affects:

- Public command/event contracts.
- Snapshot shapes or realtime event payloads.
- Persistence schema or active table recovery.
- Security-sensitive logging or player-identifying data.
- Dependency/build tooling.

## Final Report Format

End with:

- Game behavior changed or verified.
- Files changed.
- Tests added/updated.
- Commands run and results.
- Remaining risks or follow-up issues.
- Whether any STOP gate applied and how it was handled.
