# CI/CD

Two GitHub Actions workflows:

| Workflow | File | Trigger | Does |
| --- | --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | PR into `main`, or manual (`workflow_dispatch`) | Lint (typecheck), backend unit tests, frontend unit tests, Playwright E2E |
| **CD** | `.github/workflows/cd.yml` | Push to `main` (i.e. PR merge), or manual | Build + push image to GHCR → blue-green deploy → smoke test → promote or roll back |

## How CD keeps deploys safe (blue-green + rollback)

1. Docker builds the `Dockerfile` and pushes the image to **GHCR**
   (`ghcr.io/<owner>/<repo>`, tagged with the commit SHA + `latest`), authenticated
   with the built-in `GITHUB_TOKEN`. **This image is the deployment artifact.**
2. The app runs in **multiple-revision mode**. A new revision is deployed with
   **0% traffic**, so production is untouched.
3. The new revision is smoke-tested on its **own** URL
   (`https://<app>--<sha>.<region>.azurecontainerapps.io`) using
   `tests/e2e/production-smoke.spec.ts` — it creates a table, joins a second
   player, and plays a hand to the flop (real HTTP + WebSocket path).
4. **Only if the smoke test passes** is 100% of traffic shifted to the new
   revision and the old one deactivated.
5. **On any failure**, traffic is (re)pinned to the previous revision and the bad
   revision is deactivated. Because traffic is never shifted before the smoke test
   passes, a broken build never reaches users.

The image lives in a **public** GHCR package, so Azure Container Apps pulls it
anonymously — no registry credentials anywhere.

---

## One-time setup

### 1. Provision Azure + the OIDC identity (Pulumi)

Use the Pulumi project in [`../infra`](../infra/README.md). It creates the
resource group, Container Apps environment, the Container App (placeholder image,
scale 0→1), and the Azure AD app registration + federated credential +
Contributor role that GitHub Actions logs in as. Its outputs map straight onto
the secrets/variables below. Follow [`../infra/README.md`](../infra/README.md),
then come back here for the GHCR step.

### 2. Add GitHub secrets and variables

In the repo: **Settings → Secrets and variables → Actions**. All values come from
`pulumi stack output` (see the infra README for copy-paste `gh` commands).

**Secrets:**

| Secret | Source |
| --- | --- |
| `AZURE_CLIENT_ID` | `pulumi stack output AZURE_CLIENT_ID` |
| `AZURE_TENANT_ID` | `pulumi stack output AZURE_TENANT_ID` |
| `AZURE_SUBSCRIPTION_ID` | `pulumi stack output AZURE_SUBSCRIPTION_ID` |

**Variables:**

| Variable | Source |
| --- | --- |
| `AZURE_RESOURCE_GROUP` | `pulumi stack output AZURE_RESOURCE_GROUP` |
| `AZURE_CONTAINER_APP` | `pulumi stack output AZURE_CONTAINER_APP` |

> The GHCR image name is derived from `github.repository` automatically — no
> registry secret or variable is needed (`GITHUB_TOKEN` handles the push).

### 3. Make the GHCR package public (once, after the first CD run)

The first CD run pushes the image and creates the package **private**, so the
Container App can't pull it yet. Set it to public one time:

**GitHub → your profile → Packages → `holdem` → Package settings → Change
visibility → Public.**

After that, re-run the CD workflow (or push again) and the deploy will pull the
image and complete. Subsequent deploys need no further action.

> **Why public?** GHCR packages are private by default and Azure Container Apps
> can't pull them with an Azure managed identity. Public avoids storing a
> long-lived pull token. The image contains only the built app — no secrets are
> baked in (all config is runtime env vars). To keep it private instead, you'd
> add a GitHub PAT (`read:packages`) as registry credentials on the Container App
> via `az containerapp registry set --server ghcr.io --username <user> --password <PAT>`.

---

## After setup

- Open a PR → **CI** runs (lint + unit + E2E).
- Merge to `main` → **CD** builds the image, deploys a dark revision, smoke-tests
  it, and promotes only on success (else rolls back).
- Watch runs under the repo's **Actions** tab. The CD run logs the new revision
  URL and prints whether it promoted or rolled back.

## Manual-approval gate

CD deploys are gated behind the **`production`** GitHub Environment (required
reviewer). On each run the `build` job builds and pushes the image, then the
`deploy` job **pauses until a reviewer approves** it in the run's page (or the
repo's Environments UI). This is wired up as:

- a `production` environment with a required reviewer (repo **Settings →
  Environments → production**);
- `environment: production` on the `deploy` job in `cd.yml`;
- a dedicated Azure AD federated credential (`github-env` in the Pulumi program)
  with subject `<sub_claim_prefix>:environment:production`, because a job bound to
  an environment presents `...:environment:<name>` instead of `...:ref:...`.

To change reviewers, wait timer, or allowed branches, edit the environment under
**Settings → Environments**.

## Tear down

```bash
cd infra && pulumi destroy
```
