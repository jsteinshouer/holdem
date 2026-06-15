import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "production-smoke.spec.ts",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8788",
    trace: "on-first-retry"
  },
  projects: [{ name: "production-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm start",
    env: {
      PORT: "8788",
      CLIENT_ORIGIN: "http://127.0.0.1:8788",
      DISCONNECTED_ACTION_GRACE_MS: "1000",
      HOST_AUTO_FOLD_AFTER_MS: "1500"
    },
    url: "http://127.0.0.1:8788/healthz",
    reuseExistingServer: false
  }
});
