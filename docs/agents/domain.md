# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repo root.
- `docs/adr/` records that touch the area about to be worked on.
- Existing planning docs in `docs/`, especially:
  - `docs/requirements.md`
  - `docs/product-brief.md`
  - `docs/domain-model.md`
  - `docs/realtime-events.md`
  - `docs/architecture.md`

If any of these files do not exist, proceed silently. Do not flag their absence or suggest creating them upfront. Producer skills can create them lazily when terms or decisions actually get resolved.

## File structure

This is a single-context repo:

```text
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   ├── requirements.md
│   ├── product-brief.md
│   ├── domain-model.md
│   ├── realtime-events.md
│   └── architecture.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the terms from `CONTEXT.md` and `docs/domain-model.md`. Do not drift to synonyms when the project has already chosen a term.

If the concept you need is not in the glossary yet, that is a signal. Either reconsider whether you are inventing language the project does not use, or note the gap for a future domain-doc update.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
