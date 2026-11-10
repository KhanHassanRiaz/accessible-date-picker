import AxeBuilder from "@axe-core/playwright";
import {
  BASE_URL,
  activeInsideDialog,
  applyDialog,
  chooseDate,
  dialog,
  expect,
  liveRegion,
  openPicker,
  test,
} from "./support.js";

test.describe("dialog and native inputs", () => {
  test("opens an accessible modal dialog and sets a native date", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/native.html`);
    await openPicker(worker, page, "#appointment");

    const picker = dialog(page);
    await expect(picker).toHaveAttribute("aria-modal", "true");
    await expect(
      page.getByRole("heading", { name: "Select date for: Appointment date" }),
    ).toBeVisible();
    await expect.poll(() => activeInsideDialog(page)).toBe("day");

    await chooseDate(page, { year: 2026, month: 5, day: 20 });
    await applyDialog(page);

    await expect(page.locator("#appointment")).toHaveValue("2026-05-20");
    await expect(picker).toHaveCount(0);
    await expect(page.locator("#appointment")).toBeFocused();
    await expect(liveRegion(page, "assertive")).toHaveText("Date set: 2026-05-20.");
  });

  test("applies with Enter while focus is on a native select", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/native.html`);
    await openPicker(worker, page, "#appointment");

    await chooseDate(page, { year: 2026, month: 5, day: 20 });
    await page.locator('select[data-adp-select="day"]').focus();
    await page.keyboard.press("Enter");

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator("#appointment")).toHaveValue("2026-05-20");
    await expect(page.locator("#appointment")).toBeFocused();
    await expect(liveRegion(page, "assertive")).toHaveText("Date set: 2026-05-20.");
  });

  test("sets a native month input and announces the month-only result", async ({
    page,
    worker,
  }) => {
    await page.goto(`${BASE_URL}/native.html`);
    await openPicker(worker, page, "#billing");

    await chooseDate(page, { year: 2027, month: 11, day: 20 });
    await applyDialog(page);

    await expect(page.locator("#billing")).toHaveValue("2027-11");
    await expect(dialog(page)).toHaveCount(0);
    await expect(liveRegion(page, "assertive")).toHaveText(
      "Date set: 2027-11. This calendar only lets you choose month and year.",
    );
  });

  test("Escape cancels without changing the field and returns focus", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/text-format.html`);
    await openPicker(worker, page, "#booking");

    await expect.poll(() => activeInsideDialog(page)).toBe("day");
    await page.keyboard.press("Escape");

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator("#booking")).toHaveValue("15/03/2026");
    await expect(page.locator("#booking")).toBeFocused();
    await expect(liveRegion(page, "assertive")).toHaveText("Cancelled.");
  });

  test("keeps Tab and Shift+Tab inside the dialog", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/native.html`);
    await openPicker(worker, page, "#appointment");
    await expect.poll(() => activeInsideDialog(page)).toBe("day");

    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => activeInsideDialog(page)).toBe("Copy diagnostic report");

    await page.keyboard.press("Tab");
    await expect.poll(() => activeInsideDialog(page)).toBe("day");

    for (let index = 0; index < 5; index += 1) await page.keyboard.press("Tab");
    await expect.poll(() => activeInsideDialog(page)).toBe("Copy diagnostic report");

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("clamps the day when a month becomes shorter and announces it", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/native.html`);
    await openPicker(worker, page, "#appointment");

    await page.locator('select[data-adp-select="year"]').selectOption("2027");
    await page.locator('select[data-adp-select="month"]').selectOption("3");
    await page.locator('select[data-adp-select="day"]').selectOption("31");
    await page.locator('select[data-adp-select="month"]').selectOption("2");

    await expect(liveRegion(page, "polite")).toHaveText(
      "February 2027, 28 days, day changed to 28.",
    );
    await expect(page.locator('select[data-adp-select="day"]')).toHaveValue("28");

    await applyDialog(page);
    await expect(page.locator("#appointment")).toHaveValue("2027-02-28");
  });

  test("refuses dates outside the field min and max bounds", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/minmax.html`);
    await openPicker(worker, page, "#booking");

    const years = page.locator('select[data-adp-select="year"] option');
    await expect(years).toHaveCount(1);
    await expect(years.first()).toHaveText("2026");

    await chooseDate(page, { year: 2026, month: 3, day: 21 });
    await applyDialog(page);

    await expect(dialog(page)).toBeVisible();
    await expect(liveRegion(page, "assertive")).toHaveText("This site does not allow that date.");
    await expect(page.locator("#booking")).toHaveValue("2026-02-10");

    await page.locator('select[data-adp-select="day"]').selectOption("20");
    await applyDialog(page);
    await expect(page.locator("#booking")).toHaveValue("2026-03-20");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("has no automated accessibility violations", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/native.html`);
    await openPicker(worker, page, "#appointment");

    const host = page.locator("[data-adp-extension-ui]");
    const hostId = await host.getAttribute("id");
    expect(hostId).toBeTruthy();

    const results = await new AxeBuilder({ page }).include(`#${hostId}`).analyze();
    expect(results.violations).toEqual([]);
  });
});
