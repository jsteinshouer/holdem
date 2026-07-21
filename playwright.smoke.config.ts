import { defineConfig, devices } from "@playwright/test";

// Smoke-tests an ALREADY-DEPLOYED instance (no local webServer). Point it at the
// deployed URL via SMOKE_BASE_URL. Reuses tests/e2e/production-smoke.spec.ts,
// which drives a real multiplayer hand (create table -> join -> play to the flop)
// and therefore exercises the HTTP + WebSocket path end to end.
const baseURL = process.env.SMOKE_BASE_URL;

if (!baseURL) {
  throw new Error("SMOKE_BASE_URL must be set to the deployed app's base URL (e.g. https://<app>.azurecontainerapps.io).");
}

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "production-smoke.spec.ts",
  reporter: "list",
  // A freshly-promoted revision may still be warming; retry transient flakes.
  retries: 2,
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  projects: [{ name: "smoke-chromium", use: { ...devices["Desktop Chrome"] } }]
});
