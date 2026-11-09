import {
  BASE_URL,
  applyDialog,
  chooseDate,
  dialog,
  expect,
  liveRegion,
  openPicker,
  test,
} from "./support.js";

const target = { year: 2026, month: 6, day: 10 };

test.describe("site calendars and library adapters", () => {
  test("drives a jQuery UI calendar and lets the site handler run", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/jquery-ui.html`);
    await openPicker(worker, page, "#booking");

    await chooseDate(page, target);
    await applyDialog(page);

    await expect(page.locator("#booking")).toHaveValue("10/06/2026");
    await expect(page.locator("#status")).toHaveText("Chosen 10/06/2026");
    await expect(dialog(page)).toHaveCount(0);
    await expect(liveRegion(page, "assertive")).toHaveText("Date set: 10/06/2026.");
  });

  test("uses the jQuery UI adapter when the calendar cannot open", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/jquery-ui-blocked.html`);
    await openPicker(worker, page, "#booking");

    await chooseDate(page, target);
    await applyDialog(page);

    await expect(page.locator("#booking")).toHaveValue("10/06/2026");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("uses the flatpickr adapter when clicking cannot open the calendar", async ({
    page,
    worker,
  }) => {
    await page.goto(`${BASE_URL}/flatpickr-blocked.html`);
    await openPicker(worker, page, "#booking");

    await chooseDate(page, target);
    await applyDialog(page);

    await expect(page.locator("#booking")).toHaveValue("10/6/2026");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("uses the Pikaday adapter when its calendar is hidden", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/pikaday-blocked.html`);
    await openPicker(worker, page, "#booking");

    await chooseDate(page, target);
    await applyDialog(page);

    await expect(page.locator("#booking")).toHaveValue("10/06/2026");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("uses the bootstrap-datepicker adapter when its popup is hidden", async ({
    page,
    worker,
  }) => {
    await page.goto(`${BASE_URL}/bootstrap.html`);
    await page.addStyleTag({ content: ".datepicker-dropdown { display: none !important; }" });
    await openPicker(worker, page, "#booking");

    await chooseDate(page, target);
    await applyDialog(page);

    await expect(page.locator("#booking")).toHaveValue("10/06/2026");
    await expect(dialog(page)).toHaveCount(0);
  });
});
