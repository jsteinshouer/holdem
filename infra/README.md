# infra — Azure bootstrap (Pulumi)

This Pulumi (TypeScript) program provisions the one-time Azure infrastructure the
CI/CD pipeline deploys into. It replaces the manual `az` bootstrap in
[../docs/cicd.md](../docs/cicd.md).

## What it creates

- **Resource group** — `<namePrefix>-rg`
- **Container Apps environment** — `<namePrefix>-env`
- **Container App** — `<namePrefix>`, external ingress on port 8080, scale 0→1,
  running a throwaway placeholder image until the CD pipeline deploys the real
  one
- **Azure AD app registration + service principal + federated credential** for
  GitHub Actions OIDC (trusts `repo:<githubRepo>:ref:refs/heads/<githubBranch>`)
- **Contributor** role for that service principal, scoped to the resource group

The image itself lives in **GHCR** (`ghcr.io/<owner>/<repo>`), not Azure — the
CD pipeline builds and pushes it there, and the Container App pulls it from the
public package. So there's no registry to provision here.

The Container App's image, revisions, revision mode and traffic weights are left
under the CD pipeline's control (Pulumi ignores changes to them), so
`pulumi up` never reverts a live deployment.

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- Azure CLI, logged in: `az login` (+ `az account set --subscription <id>`)
- A Pulumi backend. For a local state file: `pulumi login --local`

## Deploy

```bash
cd infra
npm install

pulumi stack init prod           # first time only

# Optional: override any default
pulumi config set friendly-holdem-infra:githubRepo <owner>/<repo>

pulumi up
```

## Wire up GitHub

The stack outputs map directly onto the repo's Actions secrets and variables.
View them with:

```bash
pulumi stack output              # non-secret values
pulumi stack output AZURE_CLIENT_ID
pulumi stack output AZURE_SUBSCRIPTION_ID
```

Set them (requires the GitHub CLI, `gh auth login`):

```bash
gh secret set AZURE_CLIENT_ID       --body "$(pulumi stack output AZURE_CLIENT_ID)"
gh secret set AZURE_TENANT_ID       --body "$(pulumi stack output AZURE_TENANT_ID)"
gh secret set AZURE_SUBSCRIPTION_ID --body "$(pulumi stack output AZURE_SUBSCRIPTION_ID)"

gh variable set AZURE_RESOURCE_GROUP  --body "$(pulumi stack output AZURE_RESOURCE_GROUP)"
gh variable set AZURE_CONTAINER_APP   --body "$(pulumi stack output AZURE_CONTAINER_APP)"
```

Then merge to `main` (or run the CD workflow manually) to deploy the real image.
On the **first** deploy the GHCR package is created private — set it to
**public** once (GitHub → your profile → Packages → the package → Package
settings → Change visibility → Public) so Container Apps can pull it. See
[../docs/cicd.md](../docs/cicd.md).

## Tear down

```bash
pulumi destroy
```
