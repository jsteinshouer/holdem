# CI/CD

Two GitHub Actions workflows:

| Workflow | File | Trigger | Does |
| --- | --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | PR into `main`, or manual (`workflow_dispatch`) | Lint (typecheck), backend unit tests, frontend unit tests, Playwright E2E |
| **CD** | `.github/workflows/cd.yml` | Push to `main` (i.e. PR merge), or manual | Build + push image to ACR → blue-green deploy → smoke test → promote or roll back |

## How CD keeps deploys safe (blue-green + rollback)

1. `az acr build` builds the `Dockerfile` in the cloud and pushes the image to ACR (tagged with the commit SHA + `latest`). **This image is the deployment artifact.**
2. The app runs in **multiple-revision mode**. A new revision is deployed with **0% traffic**, so production is untouched.
3. The new revision is smoke-tested on its **own** URL (`https://<app>--<sha>.<region>.azurecontainerapps.io`) using `tests/e2e/production-smoke.spec.ts` — it creates a table, joins a second player, and plays a hand to the flop (real HTTP + WebSocket path).
4. **Only if the smoke test passes** is 100% of traffic shifted to the new revision and the old one deactivated.
5. **On any failure**, traffic is (re)pinned to the previous revision and the bad revision is deactivated. Because traffic is never shifted before the smoke test passes, a broken build never reaches users.

---

## One-time setup

You need the Azure resources to exist and GitHub to be able to authenticate.

> **Recommended: use the Pulumi project in [`../infra`](../infra/README.md).** It
> provisions everything below (resource group, ACR, Container Apps environment +
> app with managed identity + AcrPull, and the Azure AD app registration +
> federated credential + Contributor role) and exports outputs that map straight
> onto the GitHub secrets/variables. The manual `az` steps below are the
> equivalent if you'd rather not use Pulumi.

Do this once. Replace the placeholder values (`ACR_NAME` especially — it must be
globally unique, 5–50 alphanumerics).

Set some shell variables first:

```bash
RG=friendly-holdem-rg
LOCATION=eastus
ENVIRONMENT=friendly-holdem-env
APP=friendly-holdem
ACR_NAME=friendlyholdemacr          # must be globally unique, letters/numbers only
IMAGE=friendly-holdem
GITHUB_REPO=jsteinshouer/holdem
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
```

### 1. Resource group + ACR + Container Apps environment

```bash
az group create --name "$RG" --location "$LOCATION"

az acr create --name "$ACR_NAME" --resource-group "$RG" --sku Basic

az containerapp env create \
  --name "$ENVIRONMENT" --resource-group "$RG" --location "$LOCATION"
```

### 2. First deploy of the Container App

The CD workflow updates an existing app; create it once here. This also builds
the first image so the app has something to run.

```bash
az acr build --registry "$ACR_NAME" --image "$IMAGE:bootstrap" --file Dockerfile .

az containerapp create \
  --name "$APP" --resource-group "$RG" --environment "$ENVIRONMENT" \
  --image "$ACR_NAME.azurecr.io/$IMAGE:bootstrap" \
  --target-port 8080 --ingress external \
  --min-replicas 0 --max-replicas 1 \
  --env-vars ACTIVE_TABLE_PERSISTENCE=memory \
  --system-assigned
```

> `--min-replicas 0 --max-replicas 1` keeps you inside the Container Apps free
> grant (scale-to-zero) and means one shared in-memory game state. See
> [deploy-azure.md](deploy-azure.md) for the trade-offs.

### 3. Let the app pull from ACR via its managed identity

```bash
ACR_ID=$(az acr show --name "$ACR_NAME" --query id -o tsv)
PRINCIPAL_ID=$(az containerapp show -n "$APP" -g "$RG" \
  --query identity.principalId -o tsv)

az role assignment create \
  --assignee "$PRINCIPAL_ID" --role AcrPull --scope "$ACR_ID"

az containerapp registry set \
  --name "$APP" --resource-group "$RG" \
  --server "$ACR_NAME.azurecr.io" --identity system
```

### 4. Azure AD app registration for GitHub OIDC

Creates an identity GitHub Actions can log in as — no stored passwords.

```bash
APP_ID=$(az ad app create --display-name "friendly-holdem-github-oidc" \
  --query appId -o tsv)
az ad sp create --id "$APP_ID"

# Federated credential trusting pushes to main in your repo:
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-main\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_REPO}:ref:refs/heads/main\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"
```

> If you later gate CD behind a GitHub **Environment** (for approvals), add a
> second federated credential with subject
> `repo:<owner>/<repo>:environment:<environment-name>` and set `environment:` on
> the `deploy` job.

### 5. Grant the service principal permission on the resource group

`Contributor` on the RG covers both `az acr build` (push) and Container App
updates. Tighten to `AcrPush` + a Container Apps role later if you want.

```bash
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)  # not strictly needed for the assignment
az role assignment create \
  --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG"
```

### 6. Add GitHub secrets and variables

In the repo: **Settings → Secrets and variables → Actions**.

**Secrets** (Secrets tab):

| Secret | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | `echo $APP_ID` |
| `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | `echo $SUBSCRIPTION_ID` |

**Variables** (Variables tab):

| Variable | Value |
| --- | --- |
| `ACR_NAME` | `friendlyholdemacr` (your ACR name, no `.azurecr.io`) |
| `IMAGE_NAME` | `friendly-holdem` |
| `AZURE_RESOURCE_GROUP` | `friendly-holdem-rg` |
| `AZURE_CONTAINER_APP` | `friendly-holdem` |

---

## After setup

- Open a PR → **CI** runs (lint + unit + E2E).
- Merge to `main` → **CD** builds the image, deploys a dark revision, smoke-tests
  it, and promotes only on success (else rolls back).
- Watch runs under the repo's **Actions** tab. The CD run logs the new revision
  URL and prints whether it promoted or rolled back.

## Tear down

```bash
az group delete --name friendly-holdem-rg --yes --no-wait
```
