import { BASE_URL, applyDialog, chooseDate, dialog, expect, openPicker, test } from "./support.js";

const target = { year: 2000, month: 6, day: 10 };

test.describe("Zebra DatePicker", () => {
  test("drives the calendar and runs the site's onClose age handler", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/zebra.html`);
    await openPicker(worker, page, "#date_of_birth");

    await chooseDate(page, target);
    await applyDialog(page);

    await expect(page.locator("#date_of_birth")).toHaveValue("10-Jun-2000");
    await expect(page.locator("#age_from_date_birth")).toHaveValue("26");
    await expect(page.locator("#status")).toHaveText("closed");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("uses the Zebra adapter when the popup cannot be shown", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/zebra-blocked.html`);
    await openPicker(worker, page, "#date_of_birth");

    await chooseDate(page, target);
    await applyDialog(page);

    await expect(page.locator("#date_of_birth")).toHaveValue("10-Jun-2000");
    await expect(page.locator("#age_from_date_birth")).toHaveValue("26");
    await expect(page.locator("#status")).toHaveText("closed");
    await expect(dialog(page)).toHaveCount(0);
  });
});
