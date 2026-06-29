# How To Use The TexasHoldem Agent Briefs

These markdown files are agent briefs. They are not magic by themselves; they give Codex a stable operating mode for a specific kind of work.

Recommended location in the TexasHoldem repo:

```text
docs/agents/texas-holdem/game-logic-agent.md
docs/agents/texas-holdem/reviewer-agent.md
```

## Add Routing To AGENTS.md

Add a section like this to the root `AGENTS.md`:

```md
## Agent Routing

For betting rules, hand lifecycle, pot/side-pot logic, legal actions, turn order, showdown, or active table state, follow `docs/agents/texas-holdem/game-logic-agent.md`.

Before marking an issue complete, or when asked to review TexasHoldem work, follow `docs/agents/texas-holdem/reviewer-agent.md`.

For game-logic changes, tests are required unless the agent clearly explains why no test can be added.
```

## Manual Usage Prompts

Use the Game Logic Agent like this:

```text
Use docs/agents/texas-holdem/game-logic-agent.md.
Implement .scratch/friendly-holdem/issues/14-fix-side-pot-all-in.md.
Keep the change narrow and add regression tests for the betting behavior.
```

Or for debugging:

```text
Use docs/agents/texas-holdem/game-logic-agent.md.
Diagnose why an all-in player can still be prompted to act on the next street.
Reproduce with a failing test before changing code.
```

Use the Reviewer Agent like this:

```text
Use docs/agents/texas-holdem/reviewer-agent.md.
Review the current branch against .scratch/friendly-holdem/issues/14-fix-side-pot-all-in.md.
Lead with findings and call out missing tests.
```

Or after implementation:

```text
Use docs/agents/texas-holdem/reviewer-agent.md.
Check whether issue 14 is complete. Verify acceptance criteria, tests, and docs.
Do not modify code unless I ask.
```

## Suggested Workflow

1. Use the Planner Agent or normal Codex planning to create/refine an issue.
2. Use the Game Logic Agent to implement the issue.
3. Use the Reviewer Agent to check the branch against the issue.
4. Fix any reviewer findings.
5. Ask the Reviewer Agent to re-check before marking the issue complete.

## When To Split Work

Use separate sessions or subagents when:

- Game logic and UI are both changing.
- Realtime event contracts are changing.
- Persistence is changing alongside betting behavior.
- You want one agent to implement and another to review.

Keep one session when:

- The task is a small, well-tested game-logic bug.
- The change affects only tests or only docs.

## Promotion To Skills

After these briefs work well for a few real issues, promote them into Codex skills:

- `friendly-holdem-game-logic`
- `friendly-holdem-reviewer`

A skill is worth creating once the workflow becomes repeatable enough that you do not want to keep pointing Codex at the markdown brief manually.
