import {
  BASE_URL,
  CROSS_ORIGIN_URL,
  applyDialog,
  chooseDate,
  clearExtensionStorage,
  dialog,
  expect,
  liveRegion,
  openPicker,
  test,
} from "./support.js";

test.describe("calendar driver and direct write", () => {
  test("drives a custom site calendar and learns only the format", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/custom.html`);
    await openPicker(worker, page, "#booking");

    await chooseDate(page, { year: 2026, month: 5, day: 20 });
    await applyDialog(page);

    await expect(page.locator("#booking")).toHaveValue("20/05/2026");
    await expect(dialog(page)).toHaveCount(0);
    await expect(liveRegion(page, "assertive")).toHaveText("Date set: 20/05/2026.");

    const origin = await page.evaluate(() => location.origin);
    await expect
      .poll(() =>
        worker.evaluate(async (pageOrigin) => {
          const stored = await chrome.storage.local.get("adp:formats");
          const formats = stored["adp:formats"] as
            Record<string, { pattern?: string; learnedAt?: number }> | undefined;
          const key = JSON.stringify([pageOrigin, "bookingDate"]);
          const direct = formats?.[key];
          if (direct) return direct.pattern ?? null;
          return Object.values(formats ?? {})[0]?.pattern ?? null;
        }, origin),
      )
      .toBe("dd/mm/yyyy");
  });

  test("drives an ASP.NET AJAX CalendarExtender calendar to a distant year", async ({
    page,
    worker,
  }) => {
    await page.goto(`${BASE_URL}/ajax-calendar.html`);
    const field = page.locator("#ctl00_ContentPlaceHolder1_Wizard1_txtDOB");
    await openPicker(worker, page, "#ctl00_ContentPlaceHolder1_Wizard1_txtDOB");

    await chooseDate(page, { year: 2001, month: 2, day: 2 });
    await applyDialog(page);

    await expect(field).toHaveValue("2/2/2001");
    await expect(field).toHaveAttribute("readonly", "readonly");
    await expect(dialog(page)).toHaveCount(0);
    await expect(field).toBeFocused();
    await expect(liveRegion(page, "assertive")).toHaveText("Date set: 2/2/2001.");
  });

  test("refuses a day that the site calendar marks as out of range", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/ajax-calendar.html?min=2026-01-10&max=2026-12-20`);
    const field = page.locator("#ctl00_ContentPlaceHolder1_Wizard1_txtDOB");
    await openPicker(worker, page, "#ctl00_ContentPlaceHolder1_Wizard1_txtDOB");

    await chooseDate(page, { year: 2026, month: 1, day: 5 });
    await applyDialog(page);

    await expect(liveRegion(page, "assertive")).toHaveText("This site does not allow that date.", {
      timeout: 20_000,
    });
    await expect(dialog(page)).toBeVisible();
    await expect(field).toHaveValue("2/2/2026");
  });

  test("writes directly when a visible placeholder proves the format", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/text-format.html`);
    await openPicker(worker, page, "#booking");

    await chooseDate(page, { year: 2026, month: 5, day: 20 });
    await applyDialog(page);

    await expect(page.locator("#booking")).toHaveValue("20/05/2026");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator("#booking")).toBeFocused();
  });

  test("refuses an ambiguous value and keeps the dialog open", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/ambiguous.html`);
    await openPicker(worker, page, "#reference");

    await chooseDate(page, { year: 2025, month: 4, day: 3 });
    await applyDialog(page);

    await expect(dialog(page)).toBeVisible();
    await expect(page.locator("#reference")).toHaveValue("03/04/2025");
    await expect(liveRegion(page, "assertive")).toHaveText(
      "I could not find the date format for this field, so I did not enter a date.",
    );
  });

  test("changes only the field that had focus", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/two-fields.html`);
    await openPicker(worker, page, "#start");

    await chooseDate(page, { year: 2026, month: 4, day: 2 });
    await applyDialog(page);

    await expect(page.locator("#start")).toHaveValue("02/04/2026");
    await expect(page.locator("#end")).toHaveValue("20/03/2026");
  });

  test("sets a month and year only calendar", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/month-year.html`);
    await openPicker(worker, page, "#billing");

    await chooseDate(page, { year: 2026, month: 11, day: 15 });
    await applyDialog(page);

    await expect(page.locator("#billing")).toHaveValue("11/2026");
    await expect(liveRegion(page, "assertive")).toHaveText(
      "Date set: 11/2026. This calendar only lets you choose month and year.",
    );
  });

  test("drives a React calendar", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/react.html`);
    await openPicker(worker, page, "#booking");

    await chooseDate(page, { year: 2026, month: 7, day: 4 });
    await applyDialog(page);

    await expect(page.locator("#booking")).toHaveValue("04/07/2026");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("stops when the calendar does not respond", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/stuck.html`);
    await openPicker(worker, page, "#booking");

    await chooseDate(page, { year: 2026, month: 5, day: 20 });
    await applyDialog(page);

    await expect(liveRegion(page, "assertive")).toHaveText(
      "The calendar did not respond, the date was not changed.",
      { timeout: 20_000 },
    );
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator("#booking")).toHaveValue("15/03/2026");
  });

  test("writes a readonly field and restores readonly", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/readonly.html`);
    await openPicker(worker, page, "#booking");

    await chooseDate(page, { year: 2026, month: 7, day: 7 });
    await applyDialog(page);

    await expect(page.locator("#booking")).toHaveValue("2026-07-07");
    await expect(page.locator("#booking")).toHaveAttribute("readonly", "");
  });

  test("works inside an open shadow root", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/shadow.html`);
    await openPicker(worker, page, "#shadow-date");

    await chooseDate(page, { year: 2026, month: 9, day: 9 });
    await applyDialog(page);

    await expect(page.locator("#shadow-date")).toHaveValue("2026-09-09");
    await expect(page.locator("#shadow-date")).toBeFocused();
  });

  test("works inside a same-origin iframe", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/iframe.html`);
    const frame = page.frameLocator('iframe[title="Booking form"]');
    await frame.locator("#booking").waitFor();
    await openPicker(worker, page, "#booking", frame);

    await chooseDate(frame, { year: 2026, month: 5, day: 20 });
    await applyDialog(frame);

    await expect(frame.locator("#booking")).toHaveValue("20/05/2026");
    await expect(dialog(frame)).toHaveCount(0);
  });

  test("works inside a cross-origin iframe", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/iframe-cross.html`);
    const frame = page.frameLocator('iframe[title="Booking form"]');
    await frame.locator("#booking").waitFor();
    expect(page.url()).toContain("127.0.0.1:4173");
    expect(CROSS_ORIGIN_URL).toContain("127.0.0.1:4174");
    await openPicker(worker, page, "#booking", frame);

    await chooseDate(frame, { year: 2026, month: 5, day: 20 });
    await applyDialog(frame);

    await expect(frame.locator("#booking")).toHaveValue("20/05/2026");
    await expect(dialog(frame)).toHaveCount(0);
  });

  test("copies a sanitized diagnostic report", async ({ page, worker }) => {
    await page.goto(`${BASE_URL}/custom.html`);
    await openPicker(worker, page, "#booking");

    await page.getByRole("button", { name: "Copy diagnostic report" }).click();

    await expect(liveRegion(page, "assertive")).toHaveText("Report copied.");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("Accessible Date Picker diagnostic report");

    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("http://127.0.0.1:4173");
    expect(text).toContain("Booking date");
    expect(text).not.toContain("custom-calendar.js");
    expect(text).not.toContain("data-adp-target");
  });
});

test.describe("options page", () => {
  test("saves the year range and forgets learned formats", async ({
    page,
    worker,
    extensionId,
  }) => {
    await clearExtensionStorage(worker);
    await page.goto(`chrome-extension://${extensionId}/options/options.html`);

    await expect(
      page.getByRole("heading", { name: "Accessible Date Picker options", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open Chrome keyboard shortcuts" }),
    ).toBeVisible();

    await page.getByLabel("Earliest year").fill("2000");
    await page.getByLabel("Number of future years").fill("5");
    await page.getByRole("button", { name: "Save year range" }).click();
    await expect(page.locator("#year-status")).toHaveText("Year range saved.");

    await expect
      .poll(() =>
        worker.evaluate(async () => {
          const stored = await chrome.storage.local.get("adp:config");
          return stored["adp:config"] as { earliestYear: number; futureYears: number };
        }),
      )
      .toEqual({ earliestYear: 2000, futureYears: 5 });

    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        "adp:formats": { test: { pattern: "dd/mm/yyyy", learnedAt: 1 } },
      });
    });
    await page.getByRole("button", { name: "Forget learned formats" }).click();
    await expect(page.locator("#formats-status")).toHaveText("Learned formats forgotten.");
    await expect
      .poll(() =>
        worker.evaluate(async () => {
          const stored = await chrome.storage.local.get("adp:formats");
          return stored["adp:formats"] ?? null;
        }),
      )
      .toBeNull();
  });
});
