/* Accessible Date Picker. No remote code, no network calls. */
"use strict";
(() => {
  // src/strings.ts
  var STRINGS = {
    extensionName: "Accessible Date Picker",
    extensionDescription: "Set dates in stubborn website calendars with a keyboard and screen reader.",
    dialogTitle: (label) => `Select date for: ${label}`,
    opened: (label) => `Date picker for ${label}. Day, month and year.`,
    working: "Setting date, please wait.",
    success: (value) => `Date set: ${value}.`,
    successMonthYear: (value) => `Date set: ${value}. This calendar only lets you choose month and year.`,
    notAllowed: "This site does not allow that date.",
    calendarNotFound: "I could not find the calendar for this field.",
    calendarStuck: "The calendar did not respond, the date was not changed.",
    formatUnknown: "I could not find the date format for this field, so I did not enter a date.",
    siteRejected: "The site did not accept the date. Please try again or use the diagnostic report.",
    notInput: "Focus is not on an input field.",
    cancelled: "Cancelled.",
    reportCopied: "Report copied.",
    reportCopyFailed: "I could not copy the report. Clipboard access was denied.",
    fieldFallbackLabel: "date field",
    dayLabel: "Day",
    monthLabel: "Month",
    yearLabel: "Year",
    applyLabel: "Apply",
    cancelLabel: "Cancel",
    diagnosticsLabel: "Copy diagnostic report",
    dialogBusy: "Date picker is busy.",
    clampAnnouncement: (monthName2, year, days, day) => `${monthName2} ${year}, ${days} days, day changed to ${day}.`,
    notAllowedTooltip: "This page does not allow extensions to run. Open a normal web page, the Chrome Web Store, or the PDF viewer cannot be changed.",
    restrictedBadge: "ERR",
    options: {
      pageTitle: "Accessible Date Picker options",
      heading: "Accessible Date Picker options",
      intro: "Use these settings to change the year range in the date dialog and to clear formats learned on websites.",
      shortcutsHeading: "Keyboard shortcut",
      shortcutsHelp: "Chrome manages extension shortcuts. Open the shortcut page, find Accessible Date Picker, and choose a key combination. Alt+Shift+D is the default.",
      openShortcuts: "Open Chrome keyboard shortcuts",
      shortcutPageError: "Chrome did not open the shortcut page. Open chrome://extensions/shortcuts in a new tab.",
      yearHeading: "Date range",
      earliestYear: "Earliest year",
      futureYears: "Number of future years",
      saveYearRange: "Save year range",
      yearRangeSaved: "Year range saved.",
      yearRangeSaveFailed: "The year range could not be saved.",
      yearRangeInvalid: "Enter a year between 1900 and 2100, and a future range between 0 and 200.",
      formatsHeading: "Learned date formats",
      formatsHelp: "Accessible Date Picker learns date formats from websites. It never stores a date. Clearing learned formats makes the extension ask less often on repeat visits.",
      forgetFormats: "Forget learned formats",
      formatsForgotten: "Learned formats forgotten.",
      formatsForgetFailed: "Learned formats could not be cleared.",
      privacyHeading: "Privacy",
      privacyText: "No network requests. No analytics. No remote code. Entered dates are never stored. Only date format patterns are stored locally.",
      helpHeading: "How to use",
      helpText: "Focus a date field on any website and press Alt+Shift+D, or click the Accessible Date Picker toolbar button. Choose Day, Month and Year, then press Enter or Apply.",
      closeHelp: "You can close these options and return to the page."
    },
    diagnostics: {
      title: "Accessible Date Picker diagnostic report",
      origin: "Origin",
      path: "Path",
      field: "Field HTML",
      ancestors: "Nearest ancestors",
      calendar: "Open calendar HTML",
      libraries: "Detected libraries",
      steps: "Driver steps",
      result: "Result",
      none: "None",
      unavailable: "Not available",
      notRun: "Not run yet."
    }
  };

  // src/shared/messages.ts
  var DEFAULT_CONFIG = {
    earliestYear: 1900,
    futureYears: 30
  };

  // src/shared/storage.ts
  var CONFIG_KEY = "adp:config";
  var FORMATS_KEY = "adp:formats";
  function clampEarliestYear(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONFIG.earliestYear;
    return Math.min(Math.max(Math.trunc(value), 1900), 2100);
  }
  function clampFutureYears(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONFIG.futureYears;
    return Math.min(Math.max(Math.trunc(value), 0), 200);
  }
  function sanitizeConfig(value) {
    if (!isRecord(value)) return { ...DEFAULT_CONFIG };
    return {
      earliestYear: clampEarliestYear(value.earliestYear),
      futureYears: clampFutureYears(value.futureYears)
    };
  }
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  async function readConfig() {
    try {
      const stored = await chrome.storage.local.get(CONFIG_KEY);
      return sanitizeConfig(stored[CONFIG_KEY]);
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
  async function writeConfig(config) {
    const clean = sanitizeConfig(config);
    await chrome.storage.local.set({ [CONFIG_KEY]: clean });
    return clean;
  }
  async function forgetFormats() {
    await chrome.storage.local.remove(FORMATS_KEY);
  }

  // src/options/options.ts
  var SHORTCUTS_URL = "chrome://extensions/shortcuts";
  function byId(id, type) {
    const element = document.getElementById(id);
    if (!(element instanceof type)) {
      throw new Error(`Options page is missing ${id}.`);
    }
    return element;
  }
  function setStatus(element, message) {
    element.textContent = message;
  }
  async function init() {
    const form = byId("year-form", HTMLFormElement);
    const earliestInput = byId("earliest-year", HTMLInputElement);
    const futureInput = byId("future-years", HTMLInputElement);
    const yearStatus = byId("year-status", HTMLElement);
    const formatsStatus = byId("formats-status", HTMLElement);
    const shortcutsButton = byId("open-shortcuts", HTMLButtonElement);
    const forgetButton = byId("forget-formats", HTMLButtonElement);
    const config = await readConfig();
    earliestInput.value = String(config.earliestYear);
    futureInput.value = String(config.futureYears);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const earliestYear = Number(earliestInput.value);
      const futureYears = Number(futureInput.value);
      if (!Number.isInteger(earliestYear) || earliestYear < 1900 || earliestYear > 2100 || !Number.isInteger(futureYears) || futureYears < 0 || futureYears > 200) {
        setStatus(yearStatus, STRINGS.options.yearRangeInvalid);
        earliestInput.focus();
        return;
      }
      void writeConfig({
        earliestYear: clampEarliestYear(earliestYear),
        futureYears: clampFutureYears(futureYears)
      }).then((saved) => {
        earliestInput.value = String(saved.earliestYear);
        futureInput.value = String(saved.futureYears);
        setStatus(yearStatus, STRINGS.options.yearRangeSaved);
      }).catch(() => {
        setStatus(yearStatus, STRINGS.options.yearRangeSaveFailed);
      });
    });
    forgetButton.addEventListener("click", () => {
      void forgetFormats().then(() => {
        setStatus(formatsStatus, STRINGS.options.formatsForgotten);
      }).catch(() => {
        setStatus(formatsStatus, STRINGS.options.formatsForgetFailed);
      });
    });
    shortcutsButton.addEventListener("click", () => {
      setStatus(byId("shortcut-status", HTMLElement), "");
      void chrome.tabs.create({ url: SHORTCUTS_URL }).catch(() => {
        setStatus(byId("shortcut-status", HTMLElement), STRINGS.options.shortcutPageError);
      });
    });
  }
  void init();
})();
