# syntax=docker/dockerfile:1

# ---- Build stage: install all deps and build every workspace package ----
FROM node:22-slim AS build
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy only manifests first so `pnpm install` is cached until deps change.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile

# Copy the rest of the source and build shared + client + server.
COPY . .
RUN pnpm -r build

# ---- Runtime stage: production deps + built artifacts only ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# A workspace-aware production install keeps pnpm's symlinks intact so the
# server resolves @friendly-holdem/shared and socket.io correctly at runtime.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --prod

# Built artifacts. The layout must be preserved: the server resolves the client
# dir as ../../client/dist relative to apps/server/dist/index.js.
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/client/dist apps/client/dist

# Container Apps routes ingress to this port; the server reads PORT.
ENV PORT=8080
ENV ACTIVE_TABLE_PERSISTENCE=memory
EXPOSE 8080

CMD ["node", "apps/server/dist/index.js"]
