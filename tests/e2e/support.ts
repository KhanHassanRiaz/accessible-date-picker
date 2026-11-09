import {
  test as base,
  expect,
  chromium,
  type BrowserContext,
  type Frame,
  type FrameLocator,
  type Page,
  type Worker,
} from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BASE_URL = "http://127.0.0.1:4173";
export const CROSS_ORIGIN_URL = "http://127.0.0.1:4174";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const extensionPath = path.join(root, "dist");

export interface ExtensionFixtures {
  context: BrowserContext;
  page: Page;
  worker: Worker;
  extensionId: string;
}

export const test = base.extend<ExtensionFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "adp-e2e-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: BASE_URL,
    });
    await use(context);
    await context.close();
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 3 });
  },

  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage());
    await use(page);
  },

  worker: async ({ context }, use) => {
    let worker = context.serviceWorkers()[0];
    worker ??= await context.waitForEvent("serviceworker", { timeout: 20_000 });
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const ready = await worker.evaluate(
        () => typeof (globalThis as { __adpTestStartTab?: unknown }).__adpTestStartTab,
      );
      if (ready === "function") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const ready = await worker.evaluate(
      () => typeof (globalThis as { __adpTestStartTab?: unknown }).__adpTestStartTab,
    );
    if (ready !== "function") throw new Error("The test build did not expose its start hook.");
    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    const id = new URL(worker.url()).host;
    await use(id);
  },
});

export { expect };

type PickerScope = Page | Frame | FrameLocator;

export function dialog(scope: PickerScope) {
  return scope.locator('[role="dialog"]');
}

export function liveRegion(scope: PickerScope, priority: "polite" | "assertive") {
  return scope.locator(`[data-adp-live="${priority}"]`);
}

export function field(scope: PickerScope, selector: string) {
  return scope.locator(selector);
}

export async function openPicker(
  worker: Worker,
  page: Page,
  selector: string,
  scope: PickerScope = page,
): Promise<void> {
  await page.bringToFront();
  await scope.locator(selector).focus();
  const tabId = await worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url === url)?.id ?? null;
  }, page.url());
  if (tabId === null) throw new Error(`No browser tab found for ${page.url()}`);
  const started = await worker.evaluate(async (id) => {
    const hook = (
      globalThis as {
        __adpTestStartTab?: (tabId: number) => Promise<boolean>;
      }
    ).__adpTestStartTab;
    return hook ? await hook(id) : false;
  }, tabId);
  if (!started) throw new Error("The content script did not handle the start message.");
  await expect(dialog(scope)).toBeVisible();
}

export async function chooseDate(
  scope: PickerScope,
  date: { year: number; month: number; day: number },
): Promise<void> {
  await scope.locator('select[data-adp-select="year"]').selectOption(String(date.year));
  await scope.locator('select[data-adp-select="month"]').selectOption(String(date.month));
  await scope.locator('select[data-adp-select="day"]').selectOption(String(date.day));
}

export async function applyDialog(scope: PickerScope): Promise<void> {
  await scope.getByRole("button", { name: "Apply", exact: true }).click();
}

export async function activeInsideDialog(page: Page): Promise<string> {
  return page.evaluate(() => {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (!(active instanceof HTMLElement)) return "";
    const selected = active.getAttribute("data-adp-select");
    if (selected) return selected;
    return active.textContent.replace(/\s+/g, " ").trim();
  });
}

export async function clearExtensionStorage(worker: Worker): Promise<void> {
  await worker.evaluate(async () => {
    await chrome.storage.local.clear();
  });
}
