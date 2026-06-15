import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: "production-smoke.spec.ts",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 15"] } }
  ],
  webServer: [
    {
      command: "pnpm --filter @friendly-holdem/server dev",
      env: {
        CLIENT_ORIGIN: "http://127.0.0.1:5173",
        DISCONNECTED_ACTION_GRACE_MS: "1000",
        HOST_AUTO_FOLD_AFTER_MS: "1500"
      },
      url: "http://127.0.0.1:8787",
      reuseExistingServer: true
    },
    {
      command: "pnpm --filter @friendly-holdem/client dev --host 127.0.0.1",
      env: {
        VITE_SERVER_URL: "http://127.0.0.1:8787"
      },
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true
    }
  ]
});
