Status: ready-for-agent

# Scaffold the Friendly Hold'em monorepo

## Parent

`.scratch/friendly-holdem/PRD.md`

## What to build

Create the initial Friendly Hold'em monorepo foundation so later slices can build client, server, shared types, tests, and deployment-ready scripts in one workspace. The slice should establish the project structure, TypeScript tooling, baseline config validation, lightweight structured logging skeleton, and test runners without implementing poker gameplay yet.

## Acceptance criteria

- [ ] The repo uses pnpm workspaces with separate client, server, and shared packages.
- [ ] The client package is ready for a React, Vite, and TypeScript app.
- [ ] The server package is ready for a Node.js and TypeScript app.
- [ ] The shared package can export TypeScript types used by both client and server.
- [ ] Workspace scripts exist for development, build, typecheck, lint if included, and tests.
- [ ] Minimal startup configuration validation exists for server port, allowed client origin, default stack/blinds, inactivity durations, and event log cap.
- [ ] Lightweight structured logging is available for server startup and future runtime events.
- [ ] Unit test tooling is configured for domain/server/shared code.
- [ ] Playwright is installed or prepared for later E2E slices.
- [ ] The workspace can be installed, typechecked, built, and tested with documented commands.

## Blocked by

None - can start immediately
