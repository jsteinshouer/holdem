import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as containerregistry from "@pulumi/azure-native/containerregistry";
import * as app from "@pulumi/azure-native/app";
import * as authorization from "@pulumi/azure-native/authorization";
import * as azuread from "@pulumi/azuread";
import * as random from "@pulumi/random";

const config = new pulumi.Config();
const location = config.get("location") ?? "eastus";
const namePrefix = config.get("namePrefix") ?? "friendly-holdem";
const acrName = config.get("acrName") ?? "friendlyholdemacr";
const imageName = config.get("imageName") ?? "friendly-holdem";
const githubRepo = config.get("githubRepo") ?? "jsteinshouer/holdem";
const githubBranch = config.get("githubBranch") ?? "main";

// Well-known built-in role definition GUIDs.
const CONTRIBUTOR_ROLE_ID = "b24988ac-6180-42a0-ab88-20f7382dd24c";
const ACR_PULL_ROLE_ID = "7f951dda-4ed3-4680-a7ca-43fe172d538d";

// Throwaway image so the Container App can be created before any real image
// exists in ACR. The CD pipeline replaces it on the first deploy. nginx's
// unprivileged image listens on 8080, matching our app's ingress target port,
// and is pulled anonymously from Docker Hub (no registry auth needed).
const PLACEHOLDER_IMAGE = "nginxinc/nginx-unprivileged:stable";

const clientConfig = pulumi.output(authorization.getClientConfig());

const resourceGroup = new resources.ResourceGroup("rg", {
  resourceGroupName: `${namePrefix}-rg`,
  location,
});

const registry = new containerregistry.Registry("acr", {
  resourceGroupName: resourceGroup.name,
  registryName: acrName,
  location,
  sku: { name: "Basic" },
  adminUserEnabled: false,
});

const environment = new app.ManagedEnvironment("env", {
  resourceGroupName: resourceGroup.name,
  environmentName: `${namePrefix}-env`,
  location,
});

// The Container App is provisioned with a placeholder image. Registry auth,
// the running image, revisions, revision mode and traffic weights are all owned
// by the CD pipeline, so they're ignored here to avoid `pulumi up` reverting
// live deployments.
const containerApp = new app.ContainerApp(
  "app",
  {
    resourceGroupName: resourceGroup.name,
    containerAppName: namePrefix,
    location,
    managedEnvironmentId: environment.id,
    identity: { type: "SystemAssigned" },
    configuration: {
      ingress: {
        external: true,
        targetPort: 8080,
        transport: "Auto",
        traffic: [{ latestRevision: true, weight: 100 }],
      },
      activeRevisionsMode: "Single",
    },
    template: {
      containers: [
        {
          name: "app",
          image: PLACEHOLDER_IMAGE,
          resources: { cpu: 0.25, memory: "0.5Gi" },
          env: [{ name: "ACTIVE_TABLE_PERSISTENCE", value: "memory" }],
        },
      ],
      scale: { minReplicas: 0, maxReplicas: 1 },
    },
  },
  {
    ignoreChanges: [
      "template",
      "configuration.registries",
      "configuration.activeRevisionsMode",
      "configuration.ingress.traffic",
    ],
  }
);

// Let the Container App's managed identity pull images from ACR.
const acrPullName = new random.RandomUuid("acr-pull-name");
new authorization.RoleAssignment("acr-pull", {
  roleAssignmentName: acrPullName.result,
  principalId: containerApp.identity.apply((id) => id!.principalId!),
  principalType: "ServicePrincipal",
  roleDefinitionId: pulumi.interpolate`/subscriptions/${clientConfig.subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${ACR_PULL_ROLE_ID}`,
  scope: registry.id,
});

// --- GitHub Actions OIDC identity ---------------------------------------------
const adApp = new azuread.Application("github-oidc", {
  displayName: `${namePrefix}-github-oidc`,
});

const servicePrincipal = new azuread.ServicePrincipal("github-oidc-sp", {
  clientId: adApp.clientId,
});

new azuread.ApplicationFederatedIdentityCredential("github-main", {
  applicationId: adApp.id,
  displayName: "github-main",
  issuer: "https://token.actions.githubusercontent.com",
  subject: `repo:${githubRepo}:ref:refs/heads/${githubBranch}`,
  audiences: ["api://AzureADTokenExchange"],
});

// The service principal deploys via `az acr build` + Container Apps updates.
// Contributor on the resource group covers both; tighten later if desired.
const contributorName = new random.RandomUuid("sp-contributor-name");
new authorization.RoleAssignment("sp-contributor", {
  roleAssignmentName: contributorName.result,
  principalId: servicePrincipal.objectId,
  principalType: "ServicePrincipal",
  roleDefinitionId: pulumi.interpolate`/subscriptions/${clientConfig.subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${CONTRIBUTOR_ROLE_ID}`,
  scope: resourceGroup.id,
});

// --- Outputs: map straight onto the GitHub secrets/variables the CD needs -----
export const resourceGroupName = resourceGroup.name;
export const acrLoginServer = registry.loginServer;
export const containerAppFqdn = containerApp.configuration.apply(
  (c) => c?.ingress?.fqdn ?? ""
);
export const containerAppUrl = containerAppFqdn.apply((f) => (f ? `https://${f}` : ""));

// GitHub secrets
export const AZURE_CLIENT_ID = adApp.clientId;
export const AZURE_TENANT_ID = clientConfig.tenantId;
export const AZURE_SUBSCRIPTION_ID = clientConfig.subscriptionId;

// GitHub variables
export const ACR_NAME = registry.name;
export const IMAGE_NAME = pulumi.output(imageName);
export const AZURE_RESOURCE_GROUP = resourceGroup.name;
export const AZURE_CONTAINER_APP = containerApp.name;
