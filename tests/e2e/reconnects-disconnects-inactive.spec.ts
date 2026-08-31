import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";

test("seated player refresh restores the same seat", async ({ browser, page }, testInfo) => {
  skipNonChromium(testInfo);

  const inviteLink = await createTable(page, "Host");
  const playerPage = await joinTable(browser, inviteLink, "Grace");

  await expect(playerPage.getByLabel("Seated players").getByText("Seat 2")).toBeVisible();
  await expect(playerPage.getByLabel("Seated players").locator("article", { hasText: "Seat 2" }).getByText("Grace")).toBeVisible();

  await playerPage.reload();

  await expect(playerPage.getByRole("heading", { name: /Table / })).toBeVisible();
  await expect(playerPage.getByLabel("Your display name")).toHaveCount(0);
  await expect(playerPage.getByLabel("Seated players").locator("article", { hasText: "Seat 2" }).getByText("Grace")).toBeVisible();
});

test("spectator refresh restores spectator identity", async ({ browser, page }, testInfo) => {
  skipNonChromium(testInfo);

  const inviteLink = await createTable(page, "Host");
  await joinTable(browser, inviteLink, "Grace");
  await page.getByRole("button", { name: "Start hand" }).click();
  const spectatorPage = await joinTable(browser, inviteLink, "Watcher");

  await expect(spectatorPage.getByRole("heading", { name: /Table / })).toBeVisible();
  await expect(spectatorPage.getByText("Watcher")).toBeVisible();

  await spectatorPage.reload();

  await expect(spectatorPage.getByRole("heading", { name: /Table / })).toBeVisible();
  await expect(spectatorPage.getByLabel("Your display name")).toHaveCount(0);
  await expect(spectatorPage.getByText("Watcher")).toBeVisible();
  await expect(spectatorPage.getByLabel("Manage table").getByText("watching", { exact: true })).toBeVisible();
});

test("disconnected current actor auto-folds after grace period", async ({ browser, page }, testInfo) => {
  skipNonChromium(testInfo);

  const inviteLink = await createTable(page, "Host");
  const playerPage = await joinTable(browser, inviteLink, "Grace");

  await page.getByRole("button", { name: "Start hand" }).click();
  await expect(playerPage.getByRole("heading", { name: "Preflop" })).toBeVisible();

  await page.close();

  await expect(playerPage.getByLabel("Public action log").getByText("Host folded.")).toBeVisible({ timeout: 5000 });
  await expect(playerPage.getByRole("heading", { name: "Settled" })).toBeVisible();
  await expect(playerPage.getByLabel("Public action log").getByText("Grace won $15 after everyone else folded.")).toBeVisible();
});

test("host can auto-fold connected inactive actor after threshold", async ({ browser, page }, testInfo) => {
  skipNonChromium(testInfo);

  const inviteLink = await createTable(page, "Host");
  await joinTable(browser, inviteLink, "Grace");

  await page.getByRole("button", { name: "Start hand" }).click();
  const autoFoldButton = page.getByRole("button", { name: "Auto-fold inactive" });

  await expect(autoFoldButton).toBeDisabled();
  await expect(autoFoldButton).toBeEnabled({ timeout: 5000 });
  await autoFoldButton.click();

  await expect(page.getByRole("heading", { name: "Settled" })).toBeVisible();
  await expect(page.getByLabel("Public action log").getByText("Host folded.")).toBeVisible();
});

function skipNonChromium(testInfo: TestInfo): void {
  test.skip(testInfo.project.name !== "chromium", "Reconnect lifecycle coverage runs once in Chromium.");
}

async function createTable(page: Page, displayName: string): Promise<string> {
  await page.goto("/");
  await page.getByLabel("Your display name").fill(displayName);
  await page.getByRole("button", { name: "Create table" }).click();
  await expect(page.getByRole("heading", { name: /Table / })).toBeVisible();

  return page.getByLabel("Invite link", { exact: true }).inputValue();
}

async function joinTable(browser: Browser, inviteLink: string, displayName: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(inviteLink);
  await page.getByLabel("Your display name").fill(displayName);
  await page.getByRole("button", { name: "Join table" }).click();
  await expect(page.getByRole("heading", { name: /Table / })).toBeVisible();

  return page;
}
