# Deploying to Azure Container Apps

Friendly Hold'em is a single service: the Node + Socket.IO server serves the
built React client from the same origin. This guide deploys it to **Azure
Container Apps** using the `Dockerfile` at the repo root.

## Why Container Apps (and staying free)

- Native WebSocket support over the default HTTP ingress — no extra config.
- The **monthly free grant** (180,000 vCPU-seconds + 360,000 GiB-seconds +
  2M requests) covers personal use **only if the app scales to zero when idle**.
- Therefore we run `--min-replicas 0 --max-replicas 1`:
  - **Scale to zero** keeps you inside the free grant.
  - **Max 1 replica** means all players share one in-memory game state, so no
    sticky-session/shared-state wiring is needed.

> Trade-off: game state lives in memory. While you're playing, the open
> WebSocket keeps the replica alive. After everyone disconnects and it idles,
> the replica scales to zero and in-memory tables are lost. That's fine for
> personal use. (Persisting across restarts would need `sqlite` mode + a
> mounted volume — not covered here.)

## Prerequisites

- Azure CLI: `az version` (install: https://learn.microsoft.com/cli/azure/install-azure-cli)
- Logged in and pointed at the right subscription:

  ```bash
  az login
  az account set --subscription "<your-subscription-name-or-id>"
  ```

- The Container Apps CLI extension (auto-installed on first use, or force it):

  ```bash
  az extension add --name containerapp --upgrade
  az provider register --namespace Microsoft.App
  az provider register --namespace Microsoft.OperationalInsights
  ```

## Deploy

`az containerapp up --source .` builds the image **in the cloud** (Azure creates
a container registry and runs the Docker build for you — no local Docker
needed), then creates the resource group, environment, and app.

```bash
az containerapp up \
  --name friendly-holdem \
  --resource-group friendly-holdem-rg \
  --location eastus \
  --environment friendly-holdem-env \
  --source . \
  --ingress external \
  --target-port 8080
```

First run takes a few minutes (it provisions the registry + environment). It
prints the public URL, e.g. `https://friendly-holdem.<hash>.eastus.azurecontainerapps.io`.

## Set the scale rule (do this once, after the first deploy)

Keeps you inside the free grant and guarantees a single shared replica:

```bash
az containerapp update \
  --name friendly-holdem \
  --resource-group friendly-holdem-rg \
  --min-replicas 0 \
  --max-replicas 1
```

## Redeploying after code changes

```bash
az containerapp up \
  --name friendly-holdem \
  --resource-group friendly-holdem-rg \
  --source .
```

## Health check

The server exposes `GET /healthz` returning `{"ok":true,...}`. Verify:

```bash
curl https://<your-app-url>/healthz
```

## Optional environment variables

All have sensible defaults; set any via `--env-vars KEY=value` on
`az containerapp up`, or later with `az containerapp update --set-env-vars`:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8080` (set in Dockerfile) | Ingress target port. Leave as-is. |
| `ACTIVE_TABLE_PERSISTENCE` | `memory` (set in Dockerfile) | `sqlite` needs a mounted volume. |
| `DEFAULT_STARTING_STACK` | `1000` | Play-money starting chips. |
| `DEFAULT_SMALL_BLIND` / `DEFAULT_BIG_BLIND` | `5` / `10` | Big blind must exceed small blind. |
| `DISCONNECTED_ACTION_GRACE_MS` | `30000` | Grace before a disconnected player is auto-actioned. |
| `HOST_AUTO_FOLD_AFTER_MS` | `120000` | Auto-fold timeout; must be ≥ the grace above. |

## Tear down (stop all costs)

```bash
az group delete --name friendly-holdem-rg --yes --no-wait
```
