## Agent skills

### Issue tracker

Issues and PRDs are tracked as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo with root domain docs and root ADRs. See `docs/agents/domain.md`.

## Agent Routing

For betting rules, hand lifecycle, pot/side-pot logic, legal actions, turn order, showdown, or active table state, follow `docs/agents/texas-holdem-game-logic-agent.md`.

Before marking an issue complete, or when asked to review TexasHoldem work, follow `docs/agents/texas-holdem-reviewer-agent.md`.

For game-logic changes, tests are required unless the agent clearly explains why no test can be added. See `docs/testing.md` for the testing strategy, coverage expectations, and how to run each suite.

## Mission
You are an engineering assistant working in this repository. Optimize for correctness, minimal diffs, testable changes, and adherence to repo standards.

## Non-Negotiables (Always True)
1. Do not guess project behavior or architecture. If unclear, inspect code and docs first.
2. No secrets: never add credentials, tokens, private keys, or real personal data to code, tests, logs, or docs. Use placeholders and reference our secret management approach.
3. No silent breaking changes: do not change public APIs, contracts, CLI flags, or schemas without following the gated rules below.
4. Minimal viable change: prefer the smallest change that meets the requirement. Avoid drive-by refactors.
5. Always leave the repo healthier: update tests and docs relevant to the change.

## Default Workflow
1. Clarify scope: restate the goal and list touched areas/files.
2. Inspect before edit: open relevant code and the mapped docs for that area.
3. Plan briefly: outline steps and risks (max ~10 bullets).
4. Implement: small commits/diffs, keep changes localized.
5. Validate: run the relevant commands (tests/lint/build).
6. Report: summarize what changed, why, and how it was validated.
7. Add steps for the user to validate as well

## UI Design

Utilize the frontend-designer skill if doing any UI design work and explain any design choices you make to the user.

## Issue handling

Before responding verify that all criteria have been completed in the issues and mark them all done.

## STOP Gates (Hard Preconditions)
If any condition below is met, STOP and do the required reads/checks before editing.

### STOP: Public API / contracts
Trigger: changing endpoints, request/response shapes, SDK interfaces, protobufs, message schemas, or events.
Must do first:
* Open docs/realtime-events.md.
* Open docs/domain-model.md (command and snapshot vocabulary).
* Run contract tests (see Repo Map / Canonical Commands).
* Update versioning/changelog if required.

### STOP: Dependencies / build tooling
Trigger: adding/upgrading packages, changing build pipelines, container base images.
Must do first:
* Open docs/requirements.md (Technology Decisions and Implementation Decisions sections).
* Confirm license/policy constraints.
* Prefer minimal additions and justify why.

### STOP: Security-sensitive logging / PII
Trigger: logging user data, request bodies, headers, tokens, or handling PII/PHI.
Must do first:
* Open docs/requirements.md (Privacy And Security Baseline section).
* Open docs/architecture.md (Security And Privacy Boundaries section).
* Search existing redaction patterns and reuse them.

## Repo Map (What to Read / What to Run)
Use this as a deterministic lookup. If working in a folder, open its local agent file first (if one exists).

| Area / Folder | Must Read First | Must Run Before Final |
| ---- | --- | --- |
| / (root changes) | AGENTS.md, docs/agents/domain.md, docs/requirements.md, docs/architecture.md | (see Canonical Commands) |
| docs/ | docs/agents/domain.md, docs/requirements.md, docs/product-brief.md, docs/domain-model.md, docs/realtime-events.md, docs/architecture.md | N/A (doc-only changes unless command impact) |
| .scratch/ | docs/agents/issue-tracker.md, docs/agents/triage-labels.md | N/A |

If an area is not in this table, STOP and locate the correct docs/commands by searching the repo (for example scripts, Makefile, or package manager configuration).

## Canonical Commands (Single Source of Truth)

### Windows / Codex Shell Setup

This repo uses Unix-style `nvm` under the user profile, but Codex PowerShell sessions do not source the lazy-loaded bash `nvm.sh` setup. Before running Node or pnpm commands in Codex, prepend the active NVM Node bin directory and use the `.cmd` shim because PowerShell execution policy may block `.ps1` shims:

```powershell
$nodeBin = Join-Path $env:USERPROFILE '.nvm\versions\node\v24.14.0\bin'
$env:PATH = "$nodeBin;$env:PATH"
pnpm.cmd --version
```

Use `pnpm.cmd`, not bare `pnpm`, when running commands from PowerShell in Codex.

### Setup

pnpm.cmd install


### Build

pnpm.cmd build

### Lint / Format

Lint / Static Check: pnpm.cmd lint

### Tests
Unit Tests: pnpm.cmd test

Integration Tests: pnpm.cmd test:e2e

See `docs/testing.md` for scoped/single-file runs, the production smoke suite, and intentional E2E skips.


### Run Locally

pnpm.cmd dev


## Output Expectations
When you finish a task, provide:
* Files changed (short list).
* Commands run and results.
* Any TODOs or risks left behind.
* If a STOP gate applied, confirm you followed it.
