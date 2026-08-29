import { expect, test, type Browser, type Page } from "@playwright/test";

test("two players can play a basic betting hand through settlement", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile-"), "Mobile usability is covered by the mobile layout test.");

  const inviteLink = await createTable(page, "Host");
  const playerPage = await joinTable(browser, inviteLink, "Grace");

  await page.getByRole("button", { name: "Beginner tutorial" }).click();
  await expect(page.getByRole("dialog", { name: "Beginner tutorial" })).toContainText("side pots");
  await page.getByRole("button", { name: "Close" }).click();
  await showMobilePanelIfAvailable(page, "Chat");
  await page.getByLabel("Message").fill("hello from host");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(playerPage.getByText("hello from host")).toBeVisible();

  await clickRoomButton(page, "Start hand");
  await expect(page.getByRole("heading", { name: "Preflop" })).toBeVisible();
  await expect(playerPage.getByLabel("Public action log").getByText("Grace posted big blind $10.")).toBeVisible();

  await page.getByRole("button", { name: "Call" }).click();
  await expect(playerPage.getByRole("button", { name: "Check" })).toBeEnabled();

  await playerPage.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("heading", { name: "Flop" })).toBeVisible();
  await expect(playerPage.getByLabel("Public action log").getByText("Flop dealt.")).toBeVisible();

  await playerPage.getByRole("button", { name: "Check" }).click();
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("heading", { name: "Turn" })).toBeVisible();

  await playerPage.getByRole("button", { name: "Check" }).click();
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("heading", { name: "River" })).toBeVisible();

  await playerPage.getByRole("button", { name: "Check" }).click();
  await page.getByRole("button", { name: "Check" }).click();

  await expect(page.getByRole("heading", { name: "Settled" })).toBeVisible();
  await expect(page.getByLabel("Public action log").getByText(/\$20 from the main pot/)).toBeVisible();
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
  await mobilePage.getByRole("button", { name: "Chat" }).click();
  await expect(mobilePage.getByLabel("Table chat")).toBeVisible();
  await mobilePage.getByRole("button", { name: "Players" }).click();
  await expect(mobilePage.getByLabel("Player details")).toContainText("Grace");
  await mobilePage.getByRole("button", { name: "Manage" }).click();
  await expect(mobilePage.getByLabel("Invite link", { exact: true })).toBeVisible();
  await mobilePage.getByRole("button", { name: "Log" }).click();
  await clickRoomButton(page, "Start hand");

  await expect(mobilePage.getByRole("heading", { name: "Preflop" })).toBeVisible();
  await expect(mobilePage.getByLabel("Seated players")).toContainText("Grace");
  await expect(mobilePage.getByLabel("Community cards")).toBeVisible();
  await expect(mobilePage.getByLabel("Your hole cards")).toBeVisible();

  await expect(page.getByRole("button", { name: "Call" })).toBeVisible();
  await page.getByRole("button", { name: "Call" }).click();

  await expect(mobilePage.getByRole("button", { name: "Check" })).toBeVisible();
  await mobilePage.getByRole("button", { name: "Raise" }).click();
  await expect(mobilePage.getByRole("dialog", { name: "Raise" })).toContainText("Min raise");
  await expect(mobilePage.getByRole("spinbutton", { name: "Exact raise to" })).toBeVisible();
  await expect(mobilePage.getByRole("button", { name: /^Raise to/ })).toBeEnabled();
  await mobilePage.getByRole("button", { name: "Cancel" }).click();
  await mobilePage.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Grace checked.")).toBeVisible();

  await mobileContext.close();
});

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

  await joinExistingPage(page, inviteLink, displayName);

  return page;
}

async function joinExistingPage(page: Page, inviteLink: string, displayName: string): Promise<void> {
  await page.goto(inviteLink);
  await page.getByLabel("Your display name").fill(displayName);
  await page.getByRole("button", { name: "Join table" }).click();
  await expect(page.getByRole("heading", { name: /Table / })).toBeVisible();
}

async function clickRoomButton(page: Page, name: string): Promise<void> {
  const button = page.getByRole("button", { name });

  if (!(await button.isVisible())) {
    await showMobilePanelIfAvailable(page, "Help");
  }

  await button.click();
}

async function showMobilePanelIfAvailable(page: Page, name: "Chat" | "Help" | "Log"): Promise<void> {
  const tab = page.getByRole("button", { name: new RegExp(`^${name}`) });

  if (await tab.isVisible()) {
    await tab.click();
  }
}
