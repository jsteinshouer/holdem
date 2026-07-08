import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";

test("production build serves the app and supports a multiplayer hand path", async ({ browser, page }, testInfo) => {
  skipMobile(testInfo);

  const inviteLink = await createTable(page, "Host");
  const playerPage = await joinTable(browser, inviteLink, "Grace");

  await expect(page).toHaveURL(/\/table\//);
  await expect(page.getByLabel("Invite link", { exact: true })).toHaveValue(/\/table\//);
  await expect(playerPage.getByLabel("Seated players").locator("article", { hasText: "Seat 2" }).getByText("Grace")).toBeVisible();

  await page.getByRole("button", { name: "Start hand" }).click();
  await expect(page.getByRole("heading", { name: "Preflop" })).toBeVisible();

  await page.getByRole("button", { name: "Call" }).click();
  await expect(playerPage.getByRole("button", { name: "Check" })).toBeEnabled();
  await playerPage.getByRole("button", { name: "Check" }).click();

  await expect(page.getByRole("heading", { name: "Flop" })).toBeVisible();
  await expect(playerPage.getByLabel("Public action log").getByText("Flop dealt.")).toBeVisible();
});

async function createTable(page: Page, displayName: string): Promise<string> {
  await page.goto("/");
  await page.getByLabel("Your display name").fill(displayName);
  await page.getByRole("button", { name: "Create table" }).click();
  await expect(page.getByRole("heading", { name: /Table / })).toBeVisible();

  return page.getByLabel("Invite link", { exact: true }).inputValue();
}

function skipMobile(testInfo: TestInfo): void {
  test.skip(testInfo.project.name.startsWith("mobile-"), "Production smoke runs once per desktop browser.");
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
