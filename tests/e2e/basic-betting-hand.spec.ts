import { expect, test, type Browser, type Page } from "@playwright/test";

test("two players can play a basic betting hand through settlement", async ({ browser, page }) => {
  const inviteLink = await createTable(page, "Host");
  const playerPage = await joinTable(browser, inviteLink, "Grace");

  await page.getByRole("button", { name: "Start hand" }).click();
  await expect(page.getByRole("heading", { name: "Preflop" })).toBeVisible();
  await expect(playerPage.getByText("Grace posted big blind $10.")).toBeVisible();

  await page.getByRole("button", { name: "Call" }).click();
  await expect(playerPage.getByRole("button", { name: "Check" })).toBeEnabled();

  await playerPage.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("heading", { name: "Flop" })).toBeVisible();
  await expect(playerPage.getByText("Flop dealt.")).toBeVisible();

  await playerPage.getByRole("button", { name: "Check" }).click();
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("heading", { name: "Turn" })).toBeVisible();

  await playerPage.getByRole("button", { name: "Check" }).click();
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("heading", { name: "River" })).toBeVisible();

  await playerPage.getByRole("button", { name: "Check" }).click();
  await page.getByRole("button", { name: "Check" }).click();

  await expect(page.getByRole("heading", { name: "Settled" })).toBeVisible();
  await expect(page.getByText(/\$20 from the main pot/)).toBeVisible();
  await expect(playerPage.getByRole("heading", { name: "Settled" })).toBeVisible();
});

test("mobile layout keeps current player actions usable", async ({ browser, page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "Mobile usability is covered by mobile browser projects.");

  const inviteLink = await createTable(page, "Host");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const mobilePage = await mobileContext.newPage();

  await joinExistingPage(mobilePage, inviteLink, "Grace");
  await page.getByRole("button", { name: "Start hand" }).click();

  await expect(page.getByRole("button", { name: "Call" })).toBeVisible();
  await page.getByRole("button", { name: "Call" }).click();

  await expect(mobilePage.getByRole("button", { name: "Check" })).toBeVisible();
  await expect(mobilePage.getByRole("spinbutton", { name: "Raise to" })).toBeVisible();
  await expect(mobilePage.getByRole("button", { name: "Raise" })).toBeEnabled();

  await mobileContext.close();
});

async function createTable(page: Page, displayName: string): Promise<string> {
  await page.goto("/");
  await page.getByLabel("Your display name").fill(displayName);
  await page.getByRole("button", { name: "Create table" }).click();
  await expect(page.getByRole("heading", { name: /Table / })).toBeVisible();

  return page.getByLabel("Invite link").inputValue();
}

async function joinTable(browser: Browser, inviteLink: string, displayName: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await joinExistingPage(page, inviteLink, displayName);

  return page;
}

async function joinExistingPage(page: Page, inviteLink: string, displayName: string): Promise<void> {
  await page.goto(inviteLink);
  await page.getByLabel("Your display name").fill(displayName);
  await page.getByRole("button", { name: "Join table" }).click();
  await expect(page.getByRole("heading", { name: /Table / })).toBeVisible();
}
