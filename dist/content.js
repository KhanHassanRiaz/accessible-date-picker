/* Accessible Date Picker. No remote code, no network calls. */
"use strict";
(() => {
  // src/content/announcer.ts
  var regions = null;
  var sequence = 0;
  var HIDDEN_STYLE = [
    "position:absolute",
    "width:1px",
    "height:1px",
    "margin:-1px",
    "padding:0",
    "border:0",
    "overflow:hidden",
    "clip:rect(0 0 0 0)",
    "clip-path:inset(50%)",
    "white-space:nowrap"
  ].join(";");
  function createRegion(priority, token) {
    const region = document.createElement("div");
    region.id = `adp-live-${priority}-${token}`;
    region.setAttribute("aria-live", priority);
    region.setAttribute("aria-atomic", "true");
    region.setAttribute("role", priority === "assertive" ? "alert" : "status");
    region.setAttribute("data-adp-live", priority);
    region.style.cssText = HIDDEN_STYLE;
    document.documentElement.append(region);
    return region;
  }
  function ensureRegions() {
    if (regions && regions.polite.isConnected && regions.assertive.isConnected) {
      if (regions.cleanupTimer !== null) {
        window.clearTimeout(regions.cleanupTimer);
        regions.cleanupTimer = null;
      }
      return regions;
    }
    if (regions) {
      regions.polite.remove();
      regions.assertive.remove();
      if (regions.cleanupTimer !== null) window.clearTimeout(regions.cleanupTimer);
    }
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    regions = {
      polite: createRegion("polite", token),
      assertive: createRegion("assertive", token),
      cleanupTimer: null,
      token
    };
    return regions;
  }
  function announce(message, priority = "polite") {
    const current = ensureRegions();
    const region = priority === "assertive" ? current.assertive : current.polite;
    const other = priority === "assertive" ? current.polite : current.assertive;
    other.textContent = "";
    region.textContent = "";
    sequence += 1;
    const currentSequence = sequence;
    window.setTimeout(() => {
      if (sequence !== currentSequence) return;
      if (!region.isConnected) return;
      region.textContent = message;
    }, 30);
  }
  function scheduleAnnouncementCleanup(delayMs = 1e4) {
    if (!regions) return;
    const current = regions;
    if (current.cleanupTimer !== null) window.clearTimeout(current.cleanupTimer);
    current.cleanupTimer = window.setTimeout(() => {
      current.polite.remove();
      current.assertive.remove();
      if (regions === current) regions = null;
    }, delayMs);
  }
  function cancelAnnouncementCleanup() {
    if (regions?.cleanupTimer !== null && regions?.cleanupTimer !== void 0) {
      window.clearTimeout(regions.cleanupTimer);
      regions.cleanupTimer = null;
    }
  }

  // src/content/fieldDetect.ts
  function deepActiveElement(document2) {
    let active = document2.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }
  function isTextEntryInput(element) {
    if (!(element instanceof HTMLInputElement)) return false;
    const type = element.type.toLowerCase();
    return type === "text" || type === "search" || type === "date" || type === "month";
  }
  function closestInput(element) {
    const parent = element.parentElement;
    if (!parent) return null;
    const siblingInput = parent.querySelector("input:not([type='hidden'])");
    return isTextEntryInput(siblingInput) ? siblingInput : null;
  }
  function nearestInput(element) {
    let current = element;
    const body = element.ownerDocument.body;
    for (let depth = 0; depth < 4 && current; depth += 1) {
      if (current === body || current === element.ownerDocument.documentElement) break;
      const previous = current.previousElementSibling;
      if (isTextEntryInput(previous)) return previous;
      const next = current.nextElementSibling;
      if (isTextEntryInput(next)) return next;
      if (isTextEntryInput(current)) return current;
      const within = current.querySelector("input:not([type='hidden'])");
      if (isTextEntryInput(within)) return within;
      current = current.parentElement;
    }
    return null;
  }
  function isButtonLike(element) {
    if (element instanceof HTMLButtonElement) return true;
    if (element instanceof HTMLAnchorElement) return true;
    const role = element.getAttribute("role");
    if (role === "button" || role === "link") return true;
    if (element instanceof HTMLElement && element.tabIndex >= 0) return true;
    return false;
  }
  function resolveFocusedField(document2) {
    const active = deepActiveElement(document2);
    if (!active) return { field: null, focusedElement: null, reason: "not-input" };
    if (isTextEntryInput(active)) {
      return { field: active, focusedElement: active, reason: "input" };
    }
    if (!isButtonLike(active)) {
      return { field: null, focusedElement: active, reason: "not-input" };
    }
    const controls = active.getAttribute("aria-controls");
    if (controls) {
      const root = active.getRootNode();
      for (const id of controls.split(/\s+/).filter(Boolean)) {
        const target = root instanceof ShadowRoot ? root.getElementById(id) : document2.getElementById(id);
        if (isTextEntryInput(target)) {
          return { field: target, focusedElement: active, reason: "related-input" };
        }
      }
    }
    const related = closestInput(active) ?? nearestInput(active);
    if (related) {
      return { field: related, focusedElement: active, reason: "related-input" };
    }
    return { field: null, focusedElement: active, reason: "not-input" };
  }
  function isDocumentFocused() {
    if (document.hasFocus()) return true;
    const active = deepActiveElement(document);
    return Boolean(active?.matches(":focus"));
  }

  // src/strings.ts
  var MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  var MONTH_ABBREVIATIONS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
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

  // src/shared/date.ts
  function daysInMonth(year, month) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return 0;
    }
    if (month === 2) {
      return isLeapYear(year) ? 29 : 28;
    }
    return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  }
  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }
  function isValidCivilDate(value) {
    return Number.isInteger(value.year) && value.year >= 1 && value.year <= 9999 && Number.isInteger(value.month) && value.month >= 1 && value.month <= 12 && Number.isInteger(value.day) && value.day >= 1 && value.day <= daysInMonth(value.year, value.month);
  }
  function clampDay(year, month, day) {
    const maximum = daysInMonth(year, month);
    if (maximum === 0) return 1;
    return Math.min(Math.max(1, Math.trunc(day)), maximum);
  }
  function clampDate(value) {
    const year = Math.min(Math.max(1, Math.trunc(value.year)), 9999);
    const month = Math.min(Math.max(1, Math.trunc(value.month)), 12);
    const day = clampDay(year, month, value.day);
    return { year, month, day };
  }
  function compareDates(a, b) {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  }
  function sameDate(a, b) {
    return a.year === b.year && a.month === b.month && a.day === b.day;
  }
  function toIsoDate(value) {
    return `${pad(value.year, 4)}-${pad(value.month, 2)}-${pad(value.day, 2)}`;
  }
  function toIsoMonth(value) {
    return `${pad(value.year, 4)}-${pad(value.month, 2)}`;
  }
  function parseIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const date = {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
    return isValidCivilDate(date) ? date : null;
  }
  function parseIsoMonth(value) {
    const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12 || year < 1 || year > 9999) return null;
    return { year, month };
  }
  function monthName(month) {
    return MONTH_NAMES[month - 1] ?? "";
  }
  function monthAbbreviation(month) {
    return MONTH_ABBREVIATIONS[month - 1] ?? "";
  }
  function monthFromName(value) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    const full = MONTH_NAMES.findIndex((name) => name.toLowerCase() === normalized);
    if (full >= 0) return full + 1;
    const abbreviated = MONTH_ABBREVIATIONS.findIndex((name) => name.toLowerCase() === normalized);
    if (abbreviated >= 0) return abbreviated + 1;
    if (normalized === "sept") return 9;
    return null;
  }
  function resolveTwoDigitYear(value) {
    if (value >= 0 && value <= 68) return 2e3 + value;
    return 1900 + value;
  }
  function pad(value, length) {
    return String(value).padStart(length, "0");
  }

  // src/shared/formats.ts
  var GENERIC_PATTERN = /(?<![A-Za-z])([dDmMyY]{1,4}(?:[/.\- ,]+[dDmMyY]{1,4})+)(?![A-Za-z])/;
  function tokenizePattern(pattern) {
    const pieces = [];
    let index = 0;
    while (index < pattern.length) {
      const character = pattern[index];
      if (character === void 0) return null;
      if (/[/.\- ,]/.test(character)) {
        pieces.push({ kind: "month", text: character });
        index += 1;
        continue;
      }
      const match = /^[dmy]+/.exec(pattern.slice(index));
      if (!match) return null;
      const tokenText = match[0];
      const normalized = tokenText.toLowerCase();
      let kind;
      if (normalized === "d") kind = "day";
      else if (normalized === "dd") kind = "dayPadded";
      else if (normalized === "m") kind = "month";
      else if (normalized === "mm") kind = "monthPadded";
      else if (normalized === "mmm") kind = "monthShort";
      else if (normalized === "mmmm") kind = "monthLong";
      else if (normalized === "yy") kind = "yearTwo";
      else if (normalized === "yyyy") kind = "yearFour";
      else return null;
      pieces.push({ kind, text: tokenText });
      index += tokenText.length;
    }
    return pieces;
  }
  function canonicalPattern(pattern) {
    const tokens = tokenizePattern(pattern.trim());
    if (!tokens) return null;
    return tokens.map((token) => {
      if (/^[/.\- ,]$/.test(token.text)) {
        return { kind: "separator", text: token.text === " " ? " " : token.text };
      }
      return { kind: token.kind, text: token.text };
    });
  }
  function convertGenericTokens(raw) {
    const output = [];
    let index = 0;
    while (index < raw.length) {
      const character = raw[index];
      if (character === void 0) return null;
      if (/[/.\- ,]/.test(character)) {
        output.push(character === " " ? " " : character);
        index += 1;
        continue;
      }
      const match = /^[dDmMyY]+/.exec(raw.slice(index));
      if (!match) return null;
      const token = match[0];
      const lower = token.toLowerCase();
      let canonical;
      if (lower === "d") canonical = "d";
      else if (lower === "dd") canonical = "dd";
      else if (lower === "m") canonical = "m";
      else if (lower === "mm") canonical = "mm";
      else if (lower === "mmm") canonical = "mmm";
      else if (lower === "mmmm") canonical = "mmmm";
      else if (lower === "yy") canonical = "yy";
      else if (lower === "yyyy") canonical = "yyyy";
      else return null;
      output.push(canonical);
      index += token.length;
    }
    const result = output.join("");
    return isValidPattern(result) ? result : null;
  }
  function convertLibraryTokens(raw, library) {
    const output = [];
    let index = 0;
    const source = raw.trim();
    while (index < source.length) {
      const character = source[index];
      if (character === void 0) return null;
      if (/[/.\- ,]/.test(character)) {
        output.push(character === " " ? " " : character);
        index += 1;
        continue;
      }
      const match = /^[A-Za-z]+/.exec(source.slice(index));
      if (!match) return null;
      const token = match[0];
      let canonical = null;
      if (library === "jquery-ui") {
        if (token === "d") canonical = "d";
        else if (token === "dd") canonical = "dd";
        else if (token === "m") canonical = "m";
        else if (token === "mm") canonical = "mm";
        else if (token === "M") canonical = "mmm";
        else if (token === "MM") canonical = "mmmm";
        else if (token === "y") canonical = "yy";
        else if (token === "yy") canonical = "yyyy";
      } else if (library === "bootstrap-datepicker") {
        if (token === "d") canonical = "d";
        else if (token === "dd") canonical = "dd";
        else if (token === "m") canonical = "m";
        else if (token === "mm") canonical = "mm";
        else if (token === "M") canonical = "mmm";
        else if (token === "MM") canonical = "mmmm";
        else if (token === "yy") canonical = "yy";
        else if (token === "yyyy") canonical = "yyyy";
      } else if (library === "flatpickr") {
        if (token === "d") canonical = "dd";
        else if (token === "j") canonical = "d";
        else if (token === "dd") canonical = "dd";
        else if (token === "m") canonical = "mm";
        else if (token === "n") canonical = "m";
        else if (token === "mm") canonical = "mm";
        else if (token === "M") canonical = "mmm";
        else if (token === "MM") canonical = "mmmm";
        else if (token === "F") canonical = "mmmm";
        else if (token === "y") canonical = "yy";
        else if (token === "Y") canonical = "yyyy";
        else if (token === "yyyy") canonical = "yyyy";
      } else if (library === "pikaday") {
        if (token === "D") canonical = "d";
        else if (token === "DD") canonical = "dd";
        else if (token === "M") canonical = "m";
        else if (token === "MM") canonical = "mm";
        else if (token === "MMM") canonical = "mmm";
        else if (token === "MMMM") canonical = "mmmm";
        else if (token === "YY") canonical = "yy";
        else if (token === "YYYY") canonical = "yyyy";
      } else {
        canonical = null;
      }
      if (!canonical) return null;
      output.push(canonical);
      index += token.length;
    }
    const result = output.join("");
    return isValidPattern(result) ? result : null;
  }
  function isValidPattern(pattern) {
    if (!pattern.trim()) return false;
    if (!pattern.includes("y") || !/[mM]/.test(pattern)) return false;
    const tokens = canonicalPattern(pattern);
    if (!tokens) return false;
    const kinds = tokens.filter((token) => token.kind !== "separator").map((token) => token.kind);
    const hasYear = kinds.includes("yearTwo") || kinds.includes("yearFour");
    const hasMonth = kinds.includes("month") || kinds.includes("monthPadded") || kinds.includes("monthShort") || kinds.includes("monthLong");
    return hasYear && hasMonth;
  }
  function normalizeGenericFormat(raw) {
    if (!raw) return null;
    const match = GENERIC_PATTERN.exec(raw);
    if (!match?.[1]) return null;
    return convertGenericTokens(match[1]);
  }
  function normalizeLibraryFormat(raw, library) {
    if (!raw) return null;
    return convertLibraryTokens(raw, library);
  }
  function patternHasDay(pattern) {
    return /d/i.test(pattern);
  }
  function tokenRegex(kind) {
    switch (kind) {
      case "day":
      case "month":
        return String.raw`(\d{1,2})`;
      case "dayPadded":
      case "monthPadded":
        return String.raw`(\d{1,2})`;
      case "yearTwo":
        return String.raw`(\d{2})`;
      case "yearFour":
        return String.raw`(\d{4})`;
      case "monthShort":
        return "([A-Za-z]{3,4})";
      case "monthLong":
        return "([A-Za-z]{3,})";
    }
  }
  function parseWithFormat(value, pattern) {
    const tokens = canonicalPattern(pattern);
    if (!tokens) return null;
    let source = "^";
    const kinds = [];
    for (const token of tokens) {
      if (token.kind === "separator") {
        source += token.text === " " ? String.raw`\s+` : escapeRegExp(token.text);
      } else {
        source += tokenRegex(token.kind);
        kinds.push(token.kind);
      }
    }
    source += "$";
    const match = new RegExp(source, "i").exec(value.trim());
    if (!match) return null;
    let year = null;
    let month = null;
    let day = null;
    let captureIndex = 1;
    for (const kind of kinds) {
      const raw = match[captureIndex] ?? "";
      captureIndex += 1;
      if (kind === "day" || kind === "dayPadded") {
        day = Number(raw);
      } else if (kind === "month" || kind === "monthPadded" || kind === "monthShort" || kind === "monthLong") {
        month = kind === "monthShort" || kind === "monthLong" ? monthFromName(raw) : Number(raw);
      } else if (kind === "yearTwo") {
        year = resolveTwoDigitYear(Number(raw));
      } else {
        year = Number(raw);
      }
    }
    if (year === null || month === null) return null;
    if (day === null) {
      return {
        year,
        month,
        day: null,
        valid: month >= 1 && month <= 12 && year >= 1 && year <= 9999
      };
    }
    const candidate = { year, month, day };
    return {
      ...candidate,
      valid: isValidCivilDate(candidate)
    };
  }
  function formatWithPattern(date, pattern) {
    const tokens = canonicalPattern(pattern);
    if (!tokens) return null;
    let output = "";
    for (const token of tokens) {
      if (token.kind === "separator") {
        output += token.text;
        continue;
      }
      switch (token.kind) {
        case "day":
          output += String(date.day);
          break;
        case "dayPadded":
          output += pad(date.day, 2);
          break;
        case "month":
          output += String(date.month);
          break;
        case "monthPadded":
          output += pad(date.month, 2);
          break;
        case "monthShort":
          output += monthAbbreviation(date.month);
          break;
        case "monthLong":
          output += monthName(date.month);
          break;
        case "yearTwo":
          output += pad(date.year % 100, 2);
          break;
        case "yearFour":
          output += pad(date.year, 4);
          break;
      }
    }
    return output;
  }
  function splitValue(value) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const matches2 = trimmed.split(/([/.\- ,]+)/);
    const parts = matches2.filter((_, index) => index % 2 === 0);
    const separators = matches2.filter((_, index) => index % 2 === 1);
    if (!parts.length || separators.length !== parts.length - 1) return null;
    if (parts.some((part) => part.length === 0)) return null;
    return {
      parts,
      separators: separators.map((separator) => separator.trim() ? separator : " ")
    };
  }
  function classifyPart(text) {
    if (monthFromName(text)) return "monthName";
    if (/^\d{4}$/.test(text)) return "yearFour";
    if (/^\d{1,2}$/.test(text)) return "numeric";
    return null;
  }
  function inferFormatFromValue(value) {
    const split = splitValue(value);
    if (!split) return { pattern: null, ambiguous: false, sawHint: false, reason: "empty" };
    const kinds = split.parts.map(classifyPart);
    if (kinds.some((kind) => kind === null)) {
      return { pattern: null, ambiguous: false, sawHint: true, reason: "unrecognized value" };
    }
    const monthNameIndex = kinds.indexOf("monthName");
    if (monthNameIndex >= 0) {
      const numeric = [];
      let year = null;
      let yearIndex = -1;
      for (const [index, part] of split.parts.entries()) {
        if (index === monthNameIndex) continue;
        if (kinds[index] === "yearFour") {
          year = Number(part);
          yearIndex = index;
        } else {
          numeric.push({ index, part: { text: part, value: Number(part), isYearFour: false } });
        }
      }
      if (year === null) {
        const candidate = numeric.find((entry) => entry.part.text.length === 2);
        if (candidate && numeric.length >= 2) {
          year = resolveTwoDigitYear(candidate.part.value);
          yearIndex = candidate.index;
          numeric.splice(numeric.indexOf(candidate), 1);
        }
      }
      if (year === null || numeric.length > 1) {
        return {
          pattern: null,
          ambiguous: true,
          sawHint: true,
          reason: "month name without a clear year"
        };
      }
      const dayEntry = numeric[0];
      if (!dayEntry) {
        return { pattern: null, ambiguous: false, sawHint: true, reason: "month and year only" };
      }
      const patternParts = split.parts.map((part, index) => {
        if (index === monthNameIndex) {
          return monthAbbreviation(monthFromName(part) ?? 1).toLowerCase() === part.toLowerCase() ? "mmm" : "mmmm";
        }
        if (index === yearIndex) return "yyyy";
        return part.length === 2 ? "dd" : "d";
      });
      return {
        pattern: combinePattern(patternParts, split.separators),
        ambiguous: false,
        sawHint: true,
        reason: "month name"
      };
    }
    const yearFourIndex = kinds.indexOf("yearFour");
    if (yearFourIndex >= 0) {
      if (split.parts.length === 2) {
        const monthIndex = yearFourIndex === 0 ? 1 : 0;
        const patternParts = split.parts.map((part, index) => {
          if (index === yearFourIndex) return "yyyy";
          return part.length === 2 ? "mm" : "m";
        });
        if (monthIndex < 0)
          return { pattern: null, ambiguous: false, sawHint: true, reason: "no month" };
        return {
          pattern: combinePattern(patternParts, split.separators),
          ambiguous: false,
          sawHint: true,
          reason: "year and month only"
        };
      }
      if (split.parts.length !== 3) {
        return { pattern: null, ambiguous: true, sawHint: true, reason: "unusual part count" };
      }
      if (yearFourIndex === 0) {
        const patternParts = [
          "yyyy",
          split.parts[1]?.length === 2 ? "mm" : "m",
          split.parts[2]?.length === 2 ? "dd" : "d"
        ];
        return {
          pattern: combinePattern(patternParts, split.separators),
          ambiguous: false,
          sawHint: true,
          reason: "year first"
        };
      }
      if (yearFourIndex === 2) {
        const first = Number(split.parts[0]);
        const second = Number(split.parts[1]);
        if (first > 12 && second <= 12) {
          const patternParts = [
            split.parts[0]?.length === 2 ? "dd" : "d",
            split.parts[1]?.length === 2 ? "mm" : "m",
            "yyyy"
          ];
          return {
            pattern: combinePattern(patternParts, split.separators),
            ambiguous: false,
            sawHint: true,
            reason: "day first by value"
          };
        }
        if (second > 12 && first <= 12) {
          const patternParts = [
            split.parts[0]?.length === 2 ? "mm" : "m",
            split.parts[1]?.length === 2 ? "dd" : "d",
            "yyyy"
          ];
          return {
            pattern: combinePattern(patternParts, split.separators),
            ambiguous: false,
            sawHint: true,
            reason: "month first by value"
          };
        }
        return {
          pattern: null,
          ambiguous: true,
          sawHint: true,
          reason: "day and month both 12 or less"
        };
      }
      return {
        pattern: null,
        ambiguous: true,
        sawHint: true,
        reason: "year in an unexpected position"
      };
    }
    if (split.parts.length === 3) {
      const first = Number(split.parts[0]);
      const second = Number(split.parts[1]);
      const thirdPart = split.parts[2] ?? "";
      if (thirdPart.length !== 2) {
        return { pattern: null, ambiguous: true, sawHint: true, reason: "no clear year" };
      }
      if (first > 31 || second > 31) {
        return { pattern: null, ambiguous: true, sawHint: true, reason: "invalid numeric value" };
      }
      if (first > 12 && second <= 12) {
        return {
          pattern: combinePattern(
            [
              split.parts[0]?.length === 2 ? "dd" : "d",
              split.parts[1]?.length === 2 ? "mm" : "m",
              "yy"
            ],
            split.separators
          ),
          ambiguous: false,
          sawHint: true,
          reason: "day first by value"
        };
      }
      if (second > 12 && first <= 12) {
        return {
          pattern: combinePattern(
            [
              split.parts[0]?.length === 2 ? "mm" : "m",
              split.parts[1]?.length === 2 ? "dd" : "d",
              "yy"
            ],
            split.separators
          ),
          ambiguous: false,
          sawHint: true,
          reason: "month first by value"
        };
      }
      return {
        pattern: null,
        ambiguous: true,
        sawHint: true,
        reason: "two digit year with ambiguous day and month"
      };
    }
    return { pattern: null, ambiguous: true, sawHint: true, reason: "no four digit year" };
  }
  function combinePattern(parts, separators) {
    if (parts.length === 0 || separators.length !== parts.length - 1) return null;
    let output = "";
    for (let index = 0; index < parts.length; index += 1) {
      output += parts[index] ?? "";
      if (index < separators.length) output += separators[index] ?? " ";
    }
    return isValidPattern(output) ? output : null;
  }
  function detectDateFormat(clues) {
    let ambiguous = false;
    let sawHint = false;
    const learned = normalizeGenericFormat(clues.learned ?? null);
    if (learned) {
      return { pattern: learned, source: "learned format", ambiguous: false, sawHint: true };
    }
    if (clues.value) {
      const inference = inferFormatFromValue(clues.value);
      sawHint ||= inference.sawHint;
      if (inference.pattern) {
        return {
          pattern: inference.pattern,
          source: `current value (${inference.reason})`,
          ambiguous: false,
          sawHint: true
        };
      }
      ambiguous ||= inference.ambiguous;
    }
    const placeholder = normalizeGenericFormat(clues.placeholder ?? null);
    if (placeholder) {
      return { pattern: placeholder, source: "placeholder", ambiguous: false, sawHint: true };
    }
    for (const attribute of clues.attributes ?? []) {
      const normalized = normalizeGenericFormat(attribute);
      if (normalized) {
        return { pattern: normalized, source: "data attribute", ambiguous: false, sawHint: true };
      }
      sawHint ||= Boolean(attribute.trim());
    }
    for (const label of clues.labelTexts ?? []) {
      const normalized = normalizeGenericFormat(label);
      if (normalized) {
        return {
          pattern: normalized,
          source: "label or accessibility text",
          ambiguous: false,
          sawHint: true
        };
      }
      sawHint ||= GENERIC_PATTERN.test(label);
    }
    if (clues.library?.format) {
      const normalized = normalizeLibraryFormat(clues.library.format, clues.library.name);
      if (normalized) {
        return {
          pattern: normalized,
          source: `library configuration (${clues.library.name})`,
          ambiguous: false,
          sawHint: true
        };
      }
    }
    for (const otherValue of clues.otherFieldValues ?? []) {
      const inference = inferFormatFromValue(otherValue);
      if (inference.pattern) {
        return {
          pattern: inference.pattern,
          source: "another date field on the page",
          ambiguous: false,
          sawHint: true
        };
      }
      ambiguous ||= inference.ambiguous;
      sawHint ||= inference.sawHint;
    }
    return {
      pattern: null,
      source: "no usable format clue",
      ambiguous,
      sawHint
    };
  }
  function deriveLearnedPattern(value) {
    const direct = inferFormatFromValue(value);
    if (direct.pattern) return direct.pattern;
    return null;
  }
  function derivePatternFromResult(value, result) {
    const split = splitValue(value);
    if (!split) return null;
    const patternParts = [];
    let hasYear = false;
    let hasMonth = false;
    let daySeen = false;
    const usedRoles = /* @__PURE__ */ new Set();
    for (const part of split.parts) {
      if (monthFromName(part)) {
        if (usedRoles.has("month")) return null;
        const month = monthFromName(part) ?? 0;
        const isShort = monthAbbreviation(month).toLowerCase() === part.toLowerCase() || month === 5 && part.toLowerCase() === "may";
        patternParts.push(isShort ? "mmm" : "mmmm");
        usedRoles.add("month");
        hasMonth = true;
        continue;
      }
      if (!/^\d{1,4}$/.test(part)) return null;
      if (part.length === 4 && Number(part) === result.year && !usedRoles.has("year")) {
        patternParts.push("yyyy");
        usedRoles.add("year");
        hasYear = true;
        continue;
      }
      if (part.length === 2 && Number(part) === result.year % 100 && !usedRoles.has("year") && !usedRoles.has("day") && !usedRoles.has("month") && !hasYear) {
        if (Number(part) !== result.day && Number(part) !== result.month) {
          patternParts.push("yy");
          usedRoles.add("year");
          hasYear = true;
          continue;
        }
      }
      if (Number(part) === result.month && !usedRoles.has("month")) {
        patternParts.push(part.length === 2 ? "mm" : "m");
        usedRoles.add("month");
        hasMonth = true;
        continue;
      }
      if (Number(part) === result.day && !usedRoles.has("day")) {
        patternParts.push(part.length === 2 ? "dd" : "d");
        usedRoles.add("day");
        daySeen = true;
        continue;
      }
      return null;
    }
    if (!hasYear || !hasMonth) return null;
    if (!daySeen && !patternHasDay(value)) {
    }
    const pattern = combinePattern(patternParts, split.separators);
    if (!pattern) return null;
    const parsed = parseWithFormat(value, pattern);
    if (!parsed?.valid) return null;
    if (parsed.year !== result.year || parsed.month !== result.month) return null;
    if (parsed.day !== null && result.day !== parsed.day) {
      return pattern;
    }
    return pattern;
  }
  function looseParseDate(value) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const monthNameInValue = findMonthName(trimmed);
    if (monthNameInValue) {
      const withoutMonth = `${trimmed.slice(0, monthNameInValue.index)} ${trimmed.slice(
        monthNameInValue.index + monthNameInValue.text.length
      )}`;
      const numbers = [...withoutMonth.matchAll(/\d{1,4}/g)].map((match) => ({
        text: match[0],
        value: Number(match[0])
      }));
      const fourDigit = numbers.find((entry) => entry.text.length === 4);
      let year = fourDigit?.value ?? null;
      let day = null;
      if (year === null) {
        const twoDigit = numbers.find((entry) => entry.text.length === 2);
        if (twoDigit) {
          year = resolveTwoDigitYear(twoDigit.value);
        }
      }
      for (const number of numbers) {
        if (number === fourDigit) continue;
        if (year !== null && number.value === year % 100 && number.text.length === 2 && day === null) {
          continue;
        }
        day ??= number.value;
      }
      if (year === null) return null;
      const month = monthNameInValue.month;
      const valid = month >= 1 && month <= 12 && year >= 1 && (day === null || day >= 1 && day <= clampDay(year, month, 31));
      return { year, month, day, valid, ambiguous: false };
    }
    const numeric = /^(\d{1,4})([/.\- ,])(\d{1,2})(?:\2(\d{1,4}))?$/.exec(trimmed);
    if (!numeric) {
      const parts2 = splitValue(trimmed);
      if (!parts2) return null;
      if (parts2.parts.some((part) => !/^\d{1,4}$/.test(part))) return null;
      return parseNumericLoose(parts2.parts);
    }
    const parts = [numeric[1] ?? "", numeric[3] ?? ""];
    if (numeric[4]) parts.push(numeric[4]);
    const split = splitValue(trimmed);
    return split ? parseNumericLoose(split.parts) : null;
  }
  function parseNumericLoose(parts) {
    if (parts.length === 2) {
      const yearPart = parts.find((part) => part.length === 4);
      if (!yearPart) return null;
      const year2 = Number(yearPart);
      const monthPart2 = parts.find((part) => part !== yearPart) ?? "";
      const month = Number(monthPart2);
      if (month < 1 || month > 12) return null;
      return { year: year2, month, day: null, valid: year2 >= 1, ambiguous: false };
    }
    if (parts.length !== 3) return null;
    if (parts.some((part) => !/^\d{1,4}$/.test(part))) return null;
    const numericParts = parts.map((part) => ({ text: part, value: Number(part) }));
    const yearFourIndex = numericParts.findIndex((part) => part.text.length === 4);
    let year;
    let dayPart;
    let monthPart;
    let ambiguous = false;
    if (yearFourIndex === 0) {
      year = numericParts[0]?.value ?? 0;
      monthPart = numericParts[1] ?? { text: "", value: 0 };
      dayPart = numericParts[2] ?? { text: "", value: 0 };
    } else if (yearFourIndex === 2) {
      year = numericParts[2]?.value ?? 0;
      dayPart = numericParts[0] ?? { text: "", value: 0 };
      monthPart = numericParts[1] ?? { text: "", value: 0 };
      if (dayPart.value <= 12 && monthPart.value <= 12 && dayPart.value !== monthPart.value) {
        ambiguous = true;
      } else if (dayPart.value <= 12 && monthPart.value > 12) {
        [dayPart, monthPart] = [monthPart, dayPart];
      }
    } else {
      const third = numericParts[2];
      if (third?.text.length !== 2) return null;
      year = resolveTwoDigitYear(third.value);
      dayPart = numericParts[0] ?? { text: "", value: 0 };
      monthPart = numericParts[1] ?? { text: "", value: 0 };
      if (dayPart.value <= 12 && monthPart.value <= 12 && dayPart.value !== monthPart.value)
        ambiguous = true;
      else if (dayPart.value <= 12 && monthPart.value > 12)
        [dayPart, monthPart] = [monthPart, dayPart];
    }
    if (dayPart.value < 1 || monthPart.value < 1 || monthPart.value > 12) return null;
    if (dayPart.value > clampDay(year, monthPart.value, 31)) return null;
    return {
      year,
      month: monthPart.value,
      day: dayPart.value,
      valid: true,
      ambiguous
    };
  }
  function findMonthName(value) {
    const lower = value.toLowerCase();
    const candidates = [
      ...MONTH_NAMES.map((name, index) => ({ name: name.toLowerCase(), month: index + 1 })),
      ...MONTH_ABBREVIATIONS.map((name, index) => ({ name: name.toLowerCase(), month: index + 1 })),
      { name: "sept", month: 9 }
    ].sort((a, b) => b.name.length - a.name.length);
    for (const candidate of candidates) {
      const index = lower.indexOf(candidate.name);
      if (index >= 0) {
        return {
          index,
          text: value.slice(index, index + candidate.name.length),
          month: candidate.month
        };
      }
    }
    return null;
  }
  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function formatHintFromAttributes(element) {
    const names = [
      "data-date-format",
      "data-format",
      "data-datepicker-format",
      "data-input-format",
      "data-fp-format",
      "data-format-date",
      "data-datepattern",
      "data-pattern",
      "format"
    ];
    const values = [];
    for (const name of names) {
      const value = element.getAttribute(name);
      if (value) values.push(value);
    }
    return values;
  }

  // src/shared/messages.ts
  var DEFAULT_CONFIG = {
    earliestYear: 1900,
    futureYears: 30
  };

  // src/shared/verify.ts
  function verifyFieldValue(value, target, mode, format = null) {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        ok: false,
        value,
        parsed: null,
        ambiguous: false,
        usedFormat: null,
        reason: "the field is empty"
      };
    }
    if (format) {
      const parsed = parseWithFormat(trimmed, format);
      if (parsed?.valid && matches(parsed, target, mode)) {
        return {
          ok: true,
          value,
          parsed,
          ambiguous: false,
          usedFormat: format,
          reason: "matched the known format"
        };
      }
    }
    const loose = looseParseDate(trimmed);
    if (!loose?.valid) {
      return {
        ok: false,
        value,
        parsed: loose,
        ambiguous: loose?.ambiguous ?? false,
        usedFormat: format,
        reason: "the value could not be parsed"
      };
    }
    if (loose.ambiguous) {
      return {
        ok: false,
        value,
        parsed: loose,
        ambiguous: true,
        usedFormat: format,
        reason: "day and month are ambiguous"
      };
    }
    if (!matches(loose, target, mode)) {
      return {
        ok: false,
        value,
        parsed: loose,
        ambiguous: false,
        usedFormat: format,
        reason: "the value does not match the requested date"
      };
    }
    return {
      ok: true,
      value,
      parsed: loose,
      ambiguous: false,
      usedFormat: format,
      reason: "matched by loose parsing"
    };
  }
  function matches(parsed, target, mode) {
    if (parsed.year !== target.year || parsed.month !== target.month) return false;
    if (mode === "month-year") return true;
    return parsed.day === target.day;
  }

  // src/content/dom.ts
  var POINTER_EVENT_INIT = {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true
  };
  function allRoots() {
    const roots = [document];
    const queue = [document];
    while (queue.length) {
      const root = queue.shift();
      if (!root) continue;
      const elements = root.querySelectorAll("*");
      for (const element of elements) {
        if (element.shadowRoot) {
          roots.push(element.shadowRoot);
          queue.push(element.shadowRoot);
        }
      }
    }
    return roots;
  }
  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    if (!element.isConnected) return false;
    const rects = element.getClientRects();
    if (rects.length === 0) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
    if (Number.parseFloat(style.opacity) === 0) return false;
    return true;
  }
  var CLIPPING_OVERFLOW = /^(?:hidden|clip|auto|scroll)$/;
  function isClippedAway(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return true;
    const documentElement = element.ownerDocument.documentElement;
    const body = element.ownerDocument.body;
    let node = element.parentNode;
    while (node) {
      if (node instanceof ShadowRoot) {
        node = node.host;
        continue;
      }
      if (!(node instanceof Element)) break;
      if (node !== documentElement && node !== body) {
        const style = getComputedStyle(node);
        const clipsX = CLIPPING_OVERFLOW.test(style.overflowX || style.overflow || "");
        const clipsY = CLIPPING_OVERFLOW.test(style.overflowY || style.overflow || "");
        if (clipsX || clipsY) {
          const box = node.getBoundingClientRect();
          if (clipsX && (rect.right <= box.left || rect.left >= box.right)) return true;
          if (clipsY && (rect.bottom <= box.top || rect.top >= box.bottom)) return true;
        }
      }
      node = node.parentNode;
    }
    return false;
  }
  function isVisibleUnclipped(element) {
    return isVisible(element) && !isClippedAway(element);
  }
  function rectCenter(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
  function dispatchClickSequence(element, point = rectCenter(element)) {
    const view = element.ownerDocument.defaultView;
    if (!view) return;
    const baseInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view,
      clientX: point.x,
      clientY: point.y,
      screenX: point.x,
      screenY: point.y,
      button: 0,
      buttons: 1
    };
    const PointerEventConstructor = view.PointerEvent;
    element.dispatchEvent(
      new PointerEventConstructor("pointerdown", {
        ...baseInit,
        ...POINTER_EVENT_INIT
      })
    );
    element.dispatchEvent(new view.MouseEvent("mousedown", baseInit));
    element.dispatchEvent(
      new PointerEventConstructor("pointerup", {
        ...baseInit,
        ...POINTER_EVENT_INIT,
        buttons: 0
      })
    );
    element.dispatchEvent(new view.MouseEvent("mouseup", { ...baseInit, buttons: 0 }));
    element.dispatchEvent(
      new view.MouseEvent("click", {
        ...baseInit,
        buttons: 0,
        detail: 1
      })
    );
  }
  function dispatchKey(target, key) {
    const view = target instanceof Element ? target.ownerDocument.defaultView : window;
    if (!view) return;
    const init = {
      key,
      code: key === "Escape" ? "Escape" : key,
      bubbles: true,
      cancelable: true,
      composed: true
    };
    target.dispatchEvent(new view.KeyboardEvent("keydown", init));
    target.dispatchEvent(new view.KeyboardEvent("keyup", init));
  }
  function focusWithoutScroll(element) {
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  }
  function nativeInputValueSetter(input, value) {
    const view = input.ownerDocument.defaultView;
    const descriptor = view ? Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "value") : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (descriptor?.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }
  }
  function nativeSelectValueSetter(select, value) {
    const view = select.ownerDocument.defaultView;
    const descriptor = view ? Object.getOwnPropertyDescriptor(view.HTMLSelectElement.prototype, "value") : Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    if (descriptor?.set) {
      descriptor.set.call(select, value);
    } else {
      select.value = value;
    }
  }
  function dispatchInputEvents(element) {
    const view = element.ownerDocument.defaultView;
    if (!view) return;
    element.dispatchEvent(new view.Event("input", { bubbles: true, composed: true }));
    element.dispatchEvent(new view.Event("change", { bubbles: true, composed: true }));
  }
  function isControlDisabled(element) {
    if (element instanceof HTMLButtonElement && element.disabled) return true;
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      if (element.disabled) return true;
    }
    if (element.getAttribute("aria-disabled") === "true") return true;
    const className = typeof element.className === "string" ? element.className : "";
    return /(?:^|\s)(?:disabled|is-disabled|ui-state-disabled|flatpickr-disabled|pika-disabled|ajax__calendar_invalid)(?:\s|$)/i.test(
      className
    );
  }
  function hasDisabledAncestor(element, boundary) {
    let current = element;
    while (current) {
      if (isControlDisabled(current)) return true;
      if (current === boundary) break;
      current = current.parentElement;
    }
    return false;
  }
  function waitForMutationOrTimeout(timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      const observers = [];
      const finish = (mutated) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        for (const observer of observers) observer.disconnect();
        resolve(mutated);
      };
      const roots = allRoots();
      for (const root of roots) {
        const target = root instanceof Document ? root.documentElement : root;
        const observer = new MutationObserver(() => {
          finish(true);
        });
        observer.observe(target, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true
        });
        observers.push(observer);
      }
      const timer = window.setTimeout(() => {
        finish(false);
      }, timeoutMs);
    });
  }
  function shortText(element, limit = 200) {
    return element.textContent.replace(/\s+/g, " ").trim().slice(0, limit);
  }

  // src/content/calendar.ts
  var OUTSIDE_CLASS = /(^|\s)(old|new|outside|other-month|othermonth|prev-month|next-month|prevmonday|nextmonday|adjacent|is-outside-month|is-other-month|prevMonthDay|nextMonthDay|datepicker-other-month|otherMonth|ajax__calendar_other|ajax__calendar_othermonth)(\s|$)/;
  var DISABLED_CLASS = /(^|\s)(disabled|is-disabled|ui-state-disabled|flatpickr-disabled|pika-disabled|ajax__calendar_invalid)(\s|$)/i;
  var CELL_SELECTOR = "td,th,button,a,span,div,[role='gridcell'],[data-date],[data-day],[data-month],[data-year]";
  var HEADER_SELECTORS = [
    ".ajax__calendar_title",
    ".datepicker-switch",
    ".ui-datepicker-title",
    ".flatpickr-current-month",
    ".pika-label",
    "[class*='calendar-title' i]",
    "[class*='calendar_title' i]",
    "[class*='picker-title' i]",
    "[class*='datepicker-title' i]",
    "[class*='calendar-header' i]",
    "[class*='picker-header' i]"
  ];
  var KNOWN_CONTAINER_HINTS = /(datepicker|date-picker|calendar|flatpickr|pika|ui-datepicker|daterangepicker|react-datepicker|date-field|date-field|month-picker|year-picker)/i;
  function isExtensionUi(element) {
    let node = element;
    let guard = 0;
    while (guard < 30) {
      guard += 1;
      if (node instanceof Element && node.hasAttribute("data-adp-extension-ui")) return true;
      if (node.parentNode) {
        node = node.parentNode;
      } else if (node instanceof ShadowRoot) {
        node = node.host;
      } else {
        break;
      }
    }
    return false;
  }
  function snapshotVisibleElements() {
    const result = /* @__PURE__ */ new Set();
    for (const root of allRoots()) {
      for (const element of root.querySelectorAll("*")) {
        if (isExtensionUi(element)) continue;
        if (isVisible(element)) result.add(element);
      }
    }
    return result;
  }
  function hintText(element) {
    const className = typeof element.className === "string" ? element.className : "";
    return `${className} ${element.id} ${element.getAttribute("role") ?? ""} ${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("class") ?? ""}`;
  }
  function textMentionsMonth(text) {
    const lower = text.toLowerCase();
    let count = 0;
    for (const name of MONTH_NAMES) {
      if (lower.includes(name.toLowerCase())) count += 1;
    }
    for (const name of MONTH_ABBREVIATIONS) {
      if (!lower.includes(name.toLowerCase())) continue;
      const fullName = MONTH_NAMES[MONTH_ABBREVIATIONS.indexOf(name)] ?? "";
      if (!fullName || !lower.includes(fullName.toLowerCase())) count += 1;
    }
    return count;
  }
  function textMentionsWeekday(text) {
    return /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      text
    );
  }
  function uniqueDayNumbers(text) {
    const seen = /* @__PURE__ */ new Set();
    for (const match of text.matchAll(/\b(?:[1-9]|[12]\d|3[01])\b/g)) {
      const value = Number(match[0]);
      if (value >= 1 && value <= 31) seen.add(value);
    }
    return seen.size;
  }
  function countCellLike(root) {
    return root.querySelectorAll(CELL_SELECTOR).length;
  }
  function rectDistance(a, b) {
    const first = a.getBoundingClientRect();
    const second = b.getBoundingClientRect();
    const ax = first.left + first.width / 2;
    const ay = first.top + first.height / 2;
    const bx = second.left + second.width / 2;
    const by = second.top + second.height / 2;
    return Math.hypot(ax - bx, ay - by);
  }
  function scoreCandidate(element, field, beforeVisible) {
    if (element === field) return 0;
    if (element.matches("html, body, script, style, link, meta, input, select, textarea, option")) {
      return 0;
    }
    if (element === element.ownerDocument.documentElement) return 0;
    if (!isVisibleUnclipped(element)) return 0;
    const text = shortText(element, 25e3);
    if (!text) return 0;
    const hints = hintText(element);
    const role = element.getAttribute("role");
    const explicitHints = KNOWN_CONTAINER_HINTS.test(hints) || role === "grid" || role === "dialog" || element.matches("[data-datepicker], [data-calendar]");
    if (!explicitHints) {
      if (element.matches("form, main, nav, header, footer, article, section")) return 0;
      if (element.contains(field)) return 0;
      const controls = element.querySelectorAll(
        "input:not([type='hidden']), select, textarea"
      ).length;
      if (controls > 12) return 0;
      if (text.length > 12e3) return 0;
    }
    let score = 0;
    if (KNOWN_CONTAINER_HINTS.test(hints)) score += 32;
    if (role === "grid") score += 12;
    if (role === "dialog") score += 10;
    if (element.matches("table")) score += 5;
    if (element.matches("[role='dialog'], [role='grid'], [data-datepicker], [data-calendar]"))
      score += 6;
    const months = textMentionsMonth(text);
    score += Math.min(36, months * 3);
    if (textMentionsWeekday(text)) score += 8;
    score += Math.min(15, uniqueDayNumbers(text));
    score += Math.min(15, Math.trunc(countCellLike(element) / 3));
    score += Math.min(10, Math.trunc(rectDistance(element, field) < 900 ? 10 : 0));
    if (beforeVisible && !beforeVisible.has(element)) score += 12;
    if (text.length > 25e3) score -= 25;
    const hasDateSignal = months > 0 || textMentionsWeekday(text) || uniqueDayNumbers(text) >= 8;
    if (!hasDateSignal && !KNOWN_CONTAINER_HINTS.test(hints)) score -= 20;
    if (score < 34) return 0;
    if (element.getBoundingClientRect().width < 40) return 0;
    return score;
  }
  function elementDepth(element) {
    let depth = 0;
    let current = element;
    while (current) {
      depth += 1;
      current = current.parentElement;
    }
    return depth;
  }
  function findCalendarCandidate(field, beforeVisible = null) {
    const candidates = [];
    let inspected = 0;
    for (const root of allRoots()) {
      for (const element of root.querySelectorAll("*")) {
        inspected += 1;
        if (inspected > 2e4) break;
        if (isExtensionUi(element)) continue;
        const hints = hintText(element);
        const stronglyContainer = KNOWN_CONTAINER_HINTS.test(hints) || element.matches("table, [role='grid'], [role='dialog']") || element.querySelector("td, [role='gridcell'], [data-date], [data-day]") !== null;
        if (!stronglyContainer) continue;
        const score = scoreCandidate(element, field, beforeVisible);
        if (score > 0) {
          candidates.push({ element, score, depth: elementDepth(element) });
        }
      }
      if (inspected > 2e4) break;
    }
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.depth - b.depth;
    });
    return candidates[0]?.element ?? null;
  }
  function visibleWithin(root, selector) {
    return [...root.querySelectorAll(selector)].filter(
      (element) => !isExtensionUi(element) && isVisibleUnclipped(element)
    );
  }
  function deepestUnique(elements) {
    const set = new Set(elements);
    return elements.filter((element) => {
      for (const other of set) {
        if (other !== element && element.contains(other)) return false;
      }
      return true;
    });
  }
  function cellClassText(element) {
    const className = typeof element.className === "string" ? element.className : "";
    return className;
  }
  function isOutside(element, root) {
    let current = element;
    let guard = 0;
    while (current && guard < 4) {
      guard += 1;
      if (OUTSIDE_CLASS.test(cellClassText(current))) return true;
      if (current === root) break;
      current = current.parentElement;
    }
    return false;
  }
  function isCellDisabled(element, root) {
    return isControlDisabled(element) || DISABLED_CLASS.test(cellClassText(element)) || element.getAttribute("data-disabled") === "true" || hasDisabledAncestor(element, root);
  }
  function cellDate(element) {
    const candidates = [
      element.getAttribute("data-date"),
      element.getAttribute("data-day"),
      element.getAttribute("data-value"),
      element.getAttribute("value"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("datetime")
    ].filter((value) => Boolean(value));
    for (const candidate of candidates) {
      const parsed = looseParseDate(candidate);
      if (parsed?.valid && parsed.day !== null) {
        return { year: parsed.year, month: parsed.month, day: parsed.day };
      }
    }
    return null;
  }
  function isPartOf(element, container) {
    if (!container) return false;
    return element === container || container.contains(element) || element.contains(container);
  }
  function cellIsExcluded(element, header, prev, next) {
    return isPartOf(element, header) || isPartOf(element, prev) || isPartOf(element, next);
  }
  function collectDayCells(root, header, prev, next) {
    const raw = [];
    for (const element of visibleWithin(root, CELL_SELECTOR)) {
      if (cellIsExcluded(element, header, prev, next)) continue;
      const text = shortText(element, 12);
      if (!/^(?:[1-9]|[12]\d|3[01])$/.test(text)) continue;
      if (!element.matches("td,th,button,a,[role='gridcell'],[data-date],[data-day]")) {
        if (!element.closest("table, [role='grid'], [class*='calendar'], [class*='picker']"))
          continue;
      }
      raw.push(element);
    }
    const elements = deepestUnique(raw);
    const cells = [];
    for (const element of elements) {
      if (isOutside(element, root)) continue;
      cells.push({
        element,
        value: Number(shortText(element, 12)),
        date: cellDate(element),
        disabled: isCellDisabled(element, root),
        outside: false
      });
    }
    return cells;
  }
  function collectNamedCells(root, header, prev, next, type) {
    const raw = [];
    for (const element of visibleWithin(root, CELL_SELECTOR)) {
      if (cellIsExcluded(element, header, prev, next)) continue;
      const text = shortText(element, 30).replace(/\.$/, "");
      let value = null;
      if (type === "month") {
        value = monthFromName(text);
      } else if (/^\d{4}$/.test(text)) {
        value = Number(text);
      }
      if (value === null) continue;
      if (!element.matches("td,th,button,a,span,[role='gridcell'],[data-month],[data-year]")) {
        if (!element.closest("table, [role='grid'], [class*='calendar'], [class*='picker']"))
          continue;
      }
      raw.push(element);
    }
    const elements = deepestUnique(raw);
    const seen = /* @__PURE__ */ new Set();
    const cells = [];
    for (const element of elements) {
      const text = shortText(element, 30).replace(/\.$/, "");
      const value = type === "month" ? monthFromName(text) : Number(text);
      if (value === null || seen.has(value)) continue;
      if (isOutside(element, root)) continue;
      seen.add(value);
      cells.push({
        element,
        value,
        date: null,
        disabled: isCellDisabled(element, root),
        outside: false
      });
    }
    return cells;
  }
  function collectDecadeCells(root) {
    const cells = [];
    for (const element of visibleWithin(root, CELL_SELECTOR)) {
      const text = shortText(element, 30);
      const match = /^(\d{4})\s*[-–—]\s*(\d{4})$/.exec(text);
      if (!match) continue;
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (end < start) continue;
      cells.push({
        element,
        start,
        end,
        disabled: isCellDisabled(element, root)
      });
    }
    return deepestUnique(cells.map((cell) => cell.element)).map((element) => {
      const text = shortText(element, 30);
      const match = /^(\d{4})\s*[-–—]\s*(\d{4})$/.exec(text);
      return {
        element,
        start: Number(match?.[1] ?? 0),
        end: Number(match?.[2] ?? 0),
        disabled: isCellDisabled(element, root)
      };
    });
  }
  function findHeaderControl(root) {
    for (const selector of HEADER_SELECTORS) {
      const candidates = visibleWithin(root, selector).filter((element) => {
        const text = shortText(element, 120);
        return text.length > 0;
      });
      if (candidates.length) {
        candidates.sort((a, b) => elementDepth(a) - elementDepth(b));
        return candidates[0] ?? null;
      }
    }
    return null;
  }
  function parseHeaderText(text) {
    const rangeMatch = /(\d{4})\s*[-–—]\s*(\d{4})/.exec(text);
    const range = rangeMatch ? [Number(rangeMatch[1]), Number(rangeMatch[2])] : null;
    const monthMatch = new RegExp(
      `(${[...MONTH_NAMES, ...MONTH_ABBREVIATIONS, "Sept"].join("|")})\\.?`,
      "i"
    ).exec(text);
    const month = monthMatch?.[1] ? monthFromName(monthMatch[1]) : null;
    const withoutMonth = monthMatch ? `${text.slice(0, monthMatch.index)} ${text.slice(monthMatch.index + monthMatch[0].length)}` : text;
    const yearMatch = /\b(\d{4})\b/.exec(withoutMonth);
    return {
      year: yearMatch ? Number(yearMatch[1]) : range?.[0] ?? null,
      month,
      range
    };
  }
  function headerTextForView(root, header) {
    const pieces = [];
    if (header) pieces.push(shortText(header, 240));
    const known = visibleWithin(root, HEADER_SELECTORS.join(","));
    for (const element of known) {
      const text = shortText(element, 120);
      if (text) pieces.push(text);
      for (const input of element.querySelectorAll("input")) {
        if (input instanceof HTMLInputElement && input.value) pieces.push(input.value);
      }
    }
    if (!pieces.length) {
      pieces.push(shortText(root, 1e3));
    }
    return pieces.join(" ");
  }
  function selectedControlTexts(root) {
    let month = null;
    let year = null;
    for (const select of visibleWithin(root, "select")) {
      if (!(select instanceof HTMLSelectElement) || select.selectedOptions.length === 0) continue;
      const text = select.selectedOptions[0]?.textContent.trim() ?? "";
      const monthValue = monthFromName(text);
      if (monthValue !== null && month === null) month = monthValue;
      if (/^\d{4}$/.test(text) && year === null) year = Number(text);
    }
    for (const input of visibleWithin(root, "input")) {
      if (!(input instanceof HTMLInputElement) || input.value.trim() === "") continue;
      const value = input.value.trim();
      if (/^\d{4}$/.test(value) && year === null) year = Number(value);
    }
    return { month, year };
  }
  function findNav(root, direction) {
    const candidates = [];
    for (const element of visibleWithin(root, "button,a,[role='button'],span,div,td,th")) {
      if (element.matches("input, select")) continue;
      const text = shortText(element, 30);
      const hints = `${hintText(element)} ${element.getAttribute("title") ?? ""} ${text}`;
      let score = 0;
      if (direction === "prev") {
        if (/ui-datepicker-prev|flatpickr-prev-month|pika-prev|ajax__calendar_prev|(^|\s)prev(\s|$)/i.test(
          hints
        )) {
          score += 50;
        }
        if (/\b(prev|previous|back|earlier)\b/i.test(hints)) score += 35;
        if (/^[«‹<←◀]$/.test(text)) score += 30;
      } else {
        if (/ui-datepicker-next|flatpickr-next-month|pika-next|ajax__calendar_next|(^|\s)next(\s|$)/i.test(
          hints
        )) {
          score += 50;
        }
        if (/\b(next|forward|later)\b/i.test(hints)) score += 35;
        if (/^[»›>→▶]$/.test(text)) score += 30;
      }
      if (!score) continue;
      if (/^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= 31) continue;
      candidates.push({ element, score, depth: elementDepth(element) });
    }
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.depth - a.depth;
    });
    const best = candidates[0];
    if (!best) return null;
    const tied = candidates.filter((entry) => entry.score === best.score);
    return deepestUnique(tied.map((entry) => entry.element))[0] ?? best.element;
  }
  function analyzeCalendar(root) {
    if (!root.isConnected || !isVisible(root)) return null;
    const header = findHeaderControl(root);
    const prev = findNav(root, "prev");
    const next = findNav(root, "next");
    const headerText = headerTextForView(root, header);
    const parsedHeader = parseHeaderText(headerText);
    const selected = selectedControlTexts(root);
    const headerYear = selected.year ?? parsedHeader.year;
    const headerMonth = selected.month ?? parsedHeader.month;
    const dayCells = collectDayCells(root, header, prev, next);
    const monthCells = collectNamedCells(root, header, prev, next, "month");
    const yearCells = collectNamedCells(root, header, prev, next, "year");
    const decadeCells = collectDecadeCells(root);
    const uniqueDays = new Set(dayCells.map((cell) => cell.value));
    const uniqueMonths = new Set(monthCells.map((cell) => cell.value));
    const uniqueYears = new Set(yearCells.map((cell) => cell.value));
    let kind = "unknown";
    if (uniqueDays.size >= 20) kind = "day";
    else if (uniqueMonths.size >= 10) kind = "month";
    else if (uniqueYears.size >= 4) kind = "year";
    else if (decadeCells.length >= 2) kind = "decade";
    let year = headerYear;
    let month = headerMonth;
    if (kind === "day" && year !== null && month !== null) {
      for (const cell of dayCells) {
        if (!cell.date) continue;
        if (cell.date.year !== year || cell.date.month !== month) continue;
      }
      const dated = dayCells.find((cell) => cell.date !== null)?.date;
      if (dated) {
        const mismatch = dayCells.some(
          (cell) => cell.date !== null && (cell.date.year !== year || cell.date.month !== month) && cell.element.getAttribute("data-date")
        );
        if (mismatch && headerYear === null) {
          year = dated.year;
          month = dated.month;
        }
      }
    }
    if (kind === "day" && (year === null || month === null)) {
      const firstDate = dayCells.find((cell) => cell.date !== null)?.date;
      if (firstDate) {
        year = firstDate.year;
        month = firstDate.month;
      }
    }
    if (kind === "month" && year === null) {
      const dated = optionYears(root);
      year = dated;
    }
    if (kind === "year" && year === null && uniqueYears.size) {
      year = Math.min(...uniqueYears);
    }
    const signature = [
      kind,
      year ?? "?",
      month ?? "?",
      shortText(header ?? root, 80),
      uniqueDays.size,
      [...uniqueDays].sort((a, b) => a - b).join(","),
      [...uniqueYears].sort((a, b) => a - b).join(","),
      [...uniqueMonths].sort((a, b) => a - b).join(",")
    ].join("|");
    return {
      root,
      kind,
      year,
      month,
      header,
      headerText,
      prev,
      next,
      dayCells,
      monthCells,
      yearCells,
      decadeCells,
      signature
    };
  }
  function optionYears(root) {
    for (const select of visibleWithin(root, "select")) {
      if (!(select instanceof HTMLSelectElement)) continue;
      const years = [...select.options].map((option) => option.textContent.trim()).filter((text) => /^\d{4}$/.test(text)).map(Number);
      if (years.length) return Math.min(...years);
    }
    return null;
  }
  function findMonthSelect(root) {
    for (const select of visibleWithin(root, "select")) {
      if (!(select instanceof HTMLSelectElement) || select.disabled) continue;
      const monthOptions = [...select.options].filter(
        (option) => monthFromName(option.textContent.trim()) !== null
      );
      if (monthOptions.length >= 8) return select;
    }
    return null;
  }
  function findYearSelect(root) {
    for (const select of visibleWithin(root, "select")) {
      if (!(select instanceof HTMLSelectElement) || select.disabled) continue;
      const yearOptions = [...select.options].filter(
        (option) => /^\d{4}$/.test(option.textContent.trim())
      );
      if (yearOptions.length >= 2) return select;
    }
    return null;
  }
  function findYearInput(root) {
    const inputs = visibleWithin(root, "input").filter(
      (element) => element instanceof HTMLInputElement
    );
    const preferred = inputs.find((input) => {
      const className = typeof input.className === "string" ? input.className : "";
      return /year|cur-year|numInput/i.test(`${className} ${input.name} ${input.id}`);
    });
    if (preferred && !preferred.disabled) return preferred;
    return inputs.find((input) => /^\d{4}$/.test(input.value) && !input.disabled) ?? null;
  }
  function findYearOption(select, year) {
    return [...select.options].find((option) => option.textContent.trim() === String(year)) ?? null;
  }
  function findMonthOption(select, month) {
    return [...select.options].find((option) => monthFromName(option.textContent.trim()) === month) ?? null;
  }

  // src/content/dialog.ts
  var STYLE = `
:host {
  all: initial;
}
.adp-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.62);
  box-sizing: border-box;
}
.adp-dialog {
  box-sizing: border-box;
  width: min(42rem, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 24px;
  border: 3px solid #111111;
  border-radius: 12px;
  background: #ffffff;
  color: #111111;
  font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  font-size: 18px;
  line-height: 1.45;
  text-align: left;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}
.adp-title {
  margin: 0 0 18px;
  font-size: 24px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.adp-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: 0 0 20px;
}
.adp-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}
.adp-field label {
  font-weight: 700;
}
.adp-field select {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  padding: 8px;
  border: 2px solid #333333;
  border-radius: 6px;
  background: #ffffff;
  color: #111111;
  font: inherit;
}
.adp-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.adp-button {
  min-height: 48px;
  padding: 10px 18px;
  border: 2px solid #111111;
  border-radius: 7px;
  background: #ffffff;
  color: #111111;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.adp-button-primary {
  background: #004f9e;
  color: #ffffff;
}
.adp-button-secondary {
  background: #ffffff;
  color: #111111;
}
.adp-diagnostics {
  margin-top: 16px;
  border-style: dashed;
}
.adp-button:disabled,
.adp-field select:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
.adp-dialog :focus-visible {
  outline: 4px solid #005fcc;
  outline-offset: 3px;
}
@media (max-width: 34rem) {
  .adp-fields {
    grid-template-columns: 1fr;
  }
  .adp-dialog {
    padding: 18px;
  }
}
@media (prefers-color-scheme: dark) {
  .adp-dialog {
    border-color: #ffffff;
    background: #151515;
    color: #ffffff;
  }
  .adp-field select {
    border-color: #e6e6e6;
    background: #1e1e1e;
    color: #ffffff;
  }
  .adp-button {
    border-color: #ffffff;
    background: #1e1e1e;
    color: #ffffff;
  }
  .adp-button-primary {
    background: #8ab4f8;
    color: #0b1020;
  }
  .adp-dialog :focus-visible {
    outline-color: #8ab4f8;
  }
}
@media (forced-colors: active) {
  .adp-backdrop {
    background: Canvas;
  }
  .adp-dialog,
  .adp-field select,
  .adp-button {
    border-color: CanvasText;
    background: Canvas;
    color: CanvasText;
    box-shadow: none;
  }
  .adp-button-primary {
    background: ButtonFace;
    color: ButtonText;
  }
  .adp-dialog :focus-visible {
    outline: 4px solid Highlight;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
    transition: none !important;
    animation: none !important;
  }
}
`;
  function randomToken() {
    return Math.random().toString(36).slice(2, 10);
  }
  var DateDialog = class {
    options;
    host = null;
    shadow = null;
    dialog = null;
    daySelect = null;
    monthSelect = null;
    yearSelect = null;
    applyButton = null;
    cancelButton = null;
    diagnosticsButton = null;
    busy = false;
    closed = false;
    idToken = randomToken();
    keydownHandler;
    constructor(options) {
      this.options = options;
      this.keydownHandler = (event) => {
        this.handleKeydown(event);
      };
    }
    open() {
      if (this.host) return;
      const host = document.createElement("div");
      host.id = `adp-dialog-host-${this.idToken}`;
      host.setAttribute("data-adp-extension-ui", "true");
      host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; display: block;";
      const shadow = host.attachShadow({ mode: "open" });
      this.host = host;
      this.shadow = shadow;
      const style = document.createElement("style");
      style.textContent = STYLE;
      shadow.append(style);
      const backdrop = document.createElement("div");
      backdrop.className = "adp-backdrop";
      const dialog = document.createElement("div");
      dialog.className = "adp-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", `adp-title-${this.idToken}`);
      dialog.tabIndex = -1;
      this.dialog = dialog;
      const title = document.createElement("h1");
      title.className = "adp-title";
      title.id = `adp-title-${this.idToken}`;
      title.textContent = STRINGS.dialogTitle(this.options.label);
      dialog.append(title);
      const fields = document.createElement("div");
      fields.className = "adp-fields";
      const bounds = this.normalizedBounds();
      const initial = this.clampToBounds(this.options.initialDate, bounds);
      this.daySelect = this.createSelect(
        "day",
        STRINGS.dayLabel,
        Array.from({ length: 31 }, (_, index) => ({
          value: String(index + 1),
          text: String(index + 1)
        })),
        fields
      );
      this.monthSelect = this.createSelect(
        "month",
        STRINGS.monthLabel,
        Array.from({ length: 12 }, (_, index) => ({
          value: String(index + 1),
          text: monthName(index + 1)
        })),
        fields
      );
      this.yearSelect = this.createSelect(
        "year",
        STRINGS.yearLabel,
        Array.from({ length: bounds.maxYear - bounds.minYear + 1 }, (_, index) => {
          const year = bounds.minYear + index;
          return { value: String(year), text: String(year) };
        }),
        fields
      );
      this.monthSelect.value = String(initial.month);
      this.yearSelect.value = String(initial.year);
      this.renderDays(initial.month, initial.year, initial.day);
      dialog.append(fields);
      const buttons = document.createElement("div");
      buttons.className = "adp-buttons";
      this.applyButton = this.createButton(
        STRINGS.applyLabel,
        "adp-button adp-button-primary",
        () => {
          void this.apply();
        }
      );
      this.cancelButton = this.createButton(
        STRINGS.cancelLabel,
        "adp-button adp-button-secondary",
        () => {
          this.cancel();
        }
      );
      buttons.append(this.applyButton, this.cancelButton);
      dialog.append(buttons);
      this.diagnosticsButton = this.createButton(
        STRINGS.diagnosticsLabel,
        "adp-button adp-diagnostics",
        () => {
          void this.runDiagnostics();
        }
      );
      dialog.append(this.diagnosticsButton);
      backdrop.append(dialog);
      shadow.append(backdrop);
      document.documentElement.append(host);
      host.addEventListener("keydown", this.keydownHandler, true);
      this.monthSelect.addEventListener("change", () => {
        this.handleMonthYearChange();
      });
      this.yearSelect.addEventListener("change", () => {
        this.handleMonthYearChange();
      });
      window.requestAnimationFrame(() => {
        if (this.daySelect?.isConnected) {
          focusWithoutScroll(this.daySelect);
        }
      });
    }
    normalizedBounds() {
      const minYear = Math.min(this.options.bounds.minYear, this.options.bounds.maxYear);
      const maxYear = Math.max(this.options.bounds.minYear, this.options.bounds.maxYear);
      return {
        minYear,
        maxYear,
        minDate: this.options.bounds.minDate,
        maxDate: this.options.bounds.maxDate
      };
    }
    clampToBounds(date, bounds) {
      const year = Math.min(Math.max(date.year, bounds.minYear), bounds.maxYear);
      return clampDate({ year, month: date.month, day: date.day });
    }
    createSelect(name, labelText, options, parent) {
      const wrapper = document.createElement("div");
      wrapper.className = "adp-field";
      const label = document.createElement("label");
      label.textContent = labelText;
      label.htmlFor = `adp-${name}-${this.idToken}`;
      const select = document.createElement("select");
      select.id = `adp-${name}-${this.idToken}`;
      select.name = name;
      select.setAttribute("data-adp-select", name);
      for (const option of options) {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.text;
        select.append(element);
      }
      wrapper.append(label, select);
      parent.append(wrapper);
      return select;
    }
    createButton(text, className, action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = text;
      button.addEventListener("click", action);
      return button;
    }
    renderDays(month, year, preferredDay) {
      if (!this.daySelect) return;
      const previous = Number(this.daySelect.value) || preferredDay;
      const maximum = Math.max(1, daysInMonth(year, month));
      const day = Math.min(Math.max(1, previous), maximum);
      this.daySelect.replaceChildren();
      for (let index = 1; index <= maximum; index += 1) {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = String(index);
        this.daySelect.append(option);
      }
      this.daySelect.value = String(day);
    }
    handleMonthYearChange() {
      if (!this.monthSelect || !this.yearSelect || !this.daySelect) return;
      const month = Number(this.monthSelect.value);
      const year = Number(this.yearSelect.value);
      if (!Number.isInteger(month) || !Number.isInteger(year)) return;
      const previousDay = Number(this.daySelect.value);
      const maximum = daysInMonth(year, month);
      this.renderDays(month, year, previousDay);
      const day = Number(this.daySelect.value);
      if (previousDay > maximum) {
        announce(STRINGS.clampAnnouncement(monthName(month), year, maximum, day), "polite");
      }
    }
    getSelectedDate() {
      if (!this.daySelect || !this.monthSelect || !this.yearSelect) {
        throw new Error("Dialog controls are unavailable.");
      }
      return clampDate({
        day: Number(this.daySelect.value),
        month: Number(this.monthSelect.value),
        year: Number(this.yearSelect.value)
      });
    }
    async apply() {
      if (this.busy || this.closed) return;
      const date = this.getSelectedDate();
      const bounds = this.normalizedBounds();
      if (bounds.minDate && compareCivil(date, bounds.minDate) < 0) {
        announce(STRINGS.notAllowed, "assertive");
        return;
      }
      if (bounds.maxDate && compareCivil(date, bounds.maxDate) > 0) {
        announce(STRINGS.notAllowed, "assertive");
        return;
      }
      this.setBusy(true);
      try {
        await this.options.callbacks.onApply(date);
      } catch {
        this.setBusy(false);
      }
    }
    cancel() {
      if (this.closed) return;
      if (this.busy) {
        announce(STRINGS.dialogBusy, "assertive");
        return;
      }
      this.options.callbacks.onCancel();
    }
    async runDiagnostics() {
      if (this.busy) return;
      try {
        await this.options.callbacks.onDiagnostics();
      } catch {
        announce(STRINGS.reportCopyFailed, "assertive");
      }
    }
    handleKeydown(event) {
      event.stopPropagation();
      if (this.closed) return;
      const pathTarget = event.composedPath()[0];
      const target = pathTarget instanceof HTMLElement ? pathTarget : null;
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancel();
        return;
      }
      if (event.key === "Tab") {
        if (!this.shadow) return;
        const focusable = this.focusableElements();
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const currentIndex = target ? focusable.indexOf(target) : -1;
        let nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
        if (currentIndex === -1) nextIndex = event.shiftKey ? focusable.length - 1 : 0;
        if (nextIndex < 0) nextIndex = focusable.length - 1;
        if (nextIndex >= focusable.length) nextIndex = 0;
        const next = focusable[nextIndex];
        if (next) {
          event.preventDefault();
          focusWithoutScroll(next);
        }
        return;
      }
      if (event.key === "Enter") {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
        event.preventDefault();
        void this.apply();
      }
    }
    focusableElements() {
      if (!this.shadow) return [];
      const candidates = this.shadow.querySelectorAll(
        "select:not(:disabled), button:not(:disabled)"
      );
      return [...candidates].filter((element) => element.isConnected);
    }
    setBusy(busy) {
      this.busy = busy;
      this.dialog?.setAttribute("aria-busy", busy ? "true" : "false");
      for (const control of [
        this.daySelect,
        this.monthSelect,
        this.yearSelect,
        this.applyButton,
        this.diagnosticsButton,
        this.cancelButton
      ]) {
        if (control) control.disabled = busy;
      }
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      if (this.host) {
        this.host.removeEventListener("keydown", this.keydownHandler, true);
        this.host.remove();
      }
      this.host = null;
      this.shadow = null;
      this.dialog = null;
      this.daySelect = null;
      this.monthSelect = null;
      this.yearSelect = null;
      this.applyButton = null;
      this.cancelButton = null;
      this.diagnosticsButton = null;
    }
    focusFirst() {
      if (this.daySelect?.isConnected) {
        focusWithoutScroll(this.daySelect);
      }
    }
    isOpen() {
      return this.host !== null && !this.closed;
    }
    isBusy() {
      return this.busy;
    }
    selectedDate() {
      return this.getSelectedDate();
    }
    selectDay(day) {
      if (!this.daySelect) return;
      this.daySelect.value = String(day);
    }
    isDateWithinBounds(date) {
      const bounds = this.normalizedBounds();
      if (bounds.minDate && compareCivil(date, bounds.minDate) < 0) return false;
      if (bounds.maxDate && compareCivil(date, bounds.maxDate) > 0) return false;
      return !sameDate(date, { year: 0, month: 0, day: 0 });
    }
  };
  function compareCivil(a, b) {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  }

  // src/content/driver.ts
  var DriverStop = class extends Error {
    status;
    constructor(status, message) {
      super(message);
      this.name = "DriverStop";
      this.status = status;
    }
  };
  function sleep(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }
  function currentMonthIndex(view) {
    if (view.year === null || view.month === null) return null;
    return view.year * 12 + (view.month - 1);
  }
  var CalendarDriver = class {
    field;
    target;
    startedAt = performance.now();
    log = [];
    steps = 0;
    mode = "day";
    lastView = null;
    lastCalendar = null;
    noChangeStreak = 0;
    constructor(field, target) {
      this.field = field;
      this.target = target;
    }
    async run() {
      if (this.field.disabled) {
        return this.result("not-allowed", "the field is disabled", null);
      }
      this.logStep("start", `target ${this.target.year}-${this.target.month}-${this.target.day}`);
      let root = null;
      try {
        root = await this.openCalendar();
        if (!root) {
          return this.result("not-found", "no calendar popup appeared", null);
        }
        this.lastCalendar = root;
        let view = analyzeCalendar(root);
        if (!view) {
          await sleep(120);
          root = this.refreshCalendar() ?? root;
          view = analyzeCalendar(root);
        }
        if (!view) {
          return this.result("failed", "the calendar view could not be recognized", root);
        }
        this.lastView = view;
        await this.execute(view);
        await sleep(120);
        await this.closeCalendarIfOpen();
        await sleep(120);
        const finalValue = this.field.value;
        return {
          status: "success",
          mode: this.mode,
          value: finalValue,
          detail: "calendar operation completed",
          log: this.log,
          calendarElement: this.lastCalendar
        };
      } catch (error) {
        const stop = error instanceof DriverStop ? error : new DriverStop("failed", error instanceof Error ? error.message : String(error));
        try {
          await this.closeCalendarIfOpen();
        } catch {
        }
        await sleep(60);
        const calendar = this.lastCalendar;
        return {
          status: stop.status,
          mode: this.mode,
          value: this.field.value,
          detail: stop.message,
          log: this.log,
          calendarElement: calendar
        };
      }
    }
    result(status, detail, calendarElement) {
      return {
        status,
        mode: this.mode,
        value: this.field.value,
        detail,
        log: this.log,
        calendarElement
      };
    }
    logStep(action, detail) {
      this.log.push({
        step: this.steps,
        elapsedMs: Math.round(performance.now() - this.startedAt),
        action,
        detail
      });
    }
    checkBudget() {
      if (performance.now() - this.startedAt > 1e4) {
        throw new DriverStop("stuck", "the 10 second calendar time budget was exceeded");
      }
      if (this.steps >= 40) {
        throw new DriverStop("stuck", "the 40 step calendar limit was reached");
      }
    }
    async openCalendar() {
      const visibleBefore = snapshotVisibleElements();
      const existing = findCalendarCandidate(this.field);
      if (existing && this.recognizeCalendar(existing)) {
        this.logStep("calendar", "found an already open calendar");
        return existing;
      }
      focusWithoutScroll(this.field);
      await sleep(120);
      const afterFocus = findCalendarCandidate(this.field);
      if (afterFocus && this.recognizeCalendar(afterFocus)) {
        this.logStep("calendar", "calendar opened when the field received focus");
        return afterFocus;
      }
      if (this.field.disabled) throw new DriverStop("not-allowed", "the field is disabled");
      this.steps += 1;
      this.logStep("click field", "requested the field calendar");
      dispatchClickSequence(this.field);
      let found = await this.waitForCalendar(visibleBefore, 600);
      if (found) return found;
      const buttons = this.findCalendarButtons();
      for (const button of buttons.slice(0, 4)) {
        if (!button.isConnected || !isVisible(button) || isControlDisabled(button)) continue;
        if (this.steps >= 40 || performance.now() - this.startedAt > 1e4) break;
        const snapshot = snapshotVisibleElements();
        this.steps += 1;
        this.logStep("click calendar button", shortText(button, 80) || "icon button");
        dispatchClickSequence(button);
        found = await this.waitForCalendar(snapshot, 600);
        if (found) return found;
      }
      return null;
    }
    recognizeCalendar(element) {
      const view = analyzeCalendar(element);
      return view && view.kind !== "unknown" ? view : null;
    }
    async waitForCalendar(beforeVisible, timeoutMs) {
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        const candidate = findCalendarCandidate(this.field, beforeVisible) ?? findCalendarCandidate(this.field);
        if (candidate && this.recognizeCalendar(candidate)) {
          this.logStep("calendar", "calendar popup detected");
          return candidate;
        }
        await waitForMutationOrTimeout(Math.min(80, Math.max(10, deadline - performance.now())));
      }
      return null;
    }
    findCalendarButtons() {
      const candidates = [];
      const roots = allRoots();
      const id = this.field.id;
      if (id) {
        for (const root of roots) {
          for (const controlled of root.querySelectorAll("[aria-controls]")) {
            const controls = (controlled.getAttribute("aria-controls") ?? "").split(/\s+/);
            if (!controls.includes(id)) continue;
            if (isVisible(controlled) && !isControlDisabled(controlled)) candidates.push(controlled);
          }
        }
      }
      let current = this.field;
      for (let depth = 0; depth < 4; depth += 1) {
        const near = current.parentElement;
        if (!near) break;
        for (const element of near.querySelectorAll(
          "button, input[type='image'], [role='button'], a, span[class*='calendar' i], span[class*='date' i], i[class*='calendar' i]"
        )) {
          if (element === this.field || !isVisible(element) || isControlDisabled(element)) continue;
          const hints = `${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""} ${element.getAttribute("alt") ?? ""} ${typeof element.className === "string" ? element.className : ""} ${shortText(element, 40)}`;
          if (!/(calendar|date|picker|icon)/i.test(hints) && element.querySelector("svg") === null) {
            continue;
          }
          candidates.push(element);
        }
        current = near;
      }
      return [...new Set(candidates)];
    }
    refreshCalendar() {
      if (this.lastCalendar?.isConnected && isVisible(this.lastCalendar) && this.recognizeCalendar(this.lastCalendar)) {
        return this.lastCalendar;
      }
      const found = findCalendarCandidate(this.field);
      if (found && this.recognizeCalendar(found)) return found;
      return null;
    }
    readView() {
      const root = this.refreshCalendar();
      if (!root) {
        this.lastView = null;
        return null;
      }
      const view = analyzeCalendar(root);
      this.lastView = view;
      if (view) this.lastCalendar = root;
      return view;
    }
    async awaitChange(beforeField, beforeSignature) {
      await sleep(35);
      const next = this.readView();
      const changed = next === null || this.field.value !== beforeField || next.signature !== beforeSignature && beforeSignature !== null;
      if (changed) {
        this.noChangeStreak = 0;
      } else {
        this.noChangeStreak += 1;
      }
      return next;
    }
    async click(element, action, allowNoChange = false) {
      this.checkBudget();
      if (!element.isConnected || !isVisible(element)) {
        throw new DriverStop("failed", `${action}: the control is no longer visible`);
      }
      if (isControlDisabled(element) || hasDisabledAncestor(element, this.lastView?.root)) {
        throw new DriverStop("not-allowed", `${action}: the control is disabled`);
      }
      const beforeField = this.field.value;
      const beforeSignature = this.lastView?.signature ?? null;
      this.steps += 1;
      const clickStarted = performance.now();
      dispatchClickSequence(element);
      await waitForMutationOrTimeout(400);
      const next = await this.awaitChange(beforeField, beforeSignature);
      this.logStep(
        action,
        `${Math.round(performance.now() - clickStarted)} ms, ${next?.kind ?? "closed"}`
      );
      if (!allowNoChange && this.noChangeStreak >= 2) {
        throw new DriverStop("stuck", `${action}: the calendar did not change`);
      }
      return this.field.value !== beforeField || next === null || beforeSignature !== null && next.signature !== beforeSignature;
    }
    async setControls(includeMonth) {
      this.checkBudget();
      let interacted = false;
      let root = this.lastView?.root;
      if (!root) return false;
      const yearSelect = findYearSelect(root);
      if (yearSelect) {
        const option = findYearOption(yearSelect, this.target.year);
        if (option) {
          nativeSelectValueSetter(yearSelect, option.value);
          dispatchInputEvents(yearSelect);
          interacted = true;
          this.logStep("set year select", String(this.target.year));
          await sleep(120);
          root = this.readView()?.root ?? root;
        }
      } else {
        const yearInput = findYearInput(root);
        if (yearInput) {
          nativeInputValueSetter(yearInput, String(this.target.year));
          dispatchInputEvents(yearInput);
          interacted = true;
          this.logStep("set year input", String(this.target.year));
          await sleep(120);
          root = this.readView()?.root ?? root;
        }
      }
      if (includeMonth) {
        const monthSelect = findMonthSelect(root);
        if (monthSelect) {
          const option = findMonthOption(monthSelect, this.target.month);
          if (option) {
            nativeSelectValueSetter(monthSelect, option.value);
            dispatchInputEvents(monthSelect);
            interacted = true;
            this.logStep("set month select", String(this.target.month));
            await sleep(150);
            this.readView();
          }
        }
      }
      if (interacted) this.noChangeStreak = 0;
      return interacted;
    }
    async clickDay(view) {
      if (view.year !== this.target.year || view.month !== this.target.month) {
        throw new DriverStop("failed", "attempted to choose a day in the wrong month");
      }
      const candidates = view.dayCells.filter((cell2) => cell2.value === this.target.day);
      const exact = candidates.find(
        (cell2) => cell2.date?.year === this.target.year && cell2.date.month === this.target.month && cell2.date.day === this.target.day
      ) ?? candidates.find((cell2) => cell2.date === null);
      const cell = exact ?? candidates[0];
      if (!cell) {
        throw new DriverStop("failed", `day ${this.target.day} was not present in the calendar`);
      }
      if (cell.disabled) {
        throw new DriverStop("not-allowed", `day ${this.target.day} is disabled`);
      }
      const beforeField = this.field.value;
      const beforeSignature = view.signature;
      this.steps += 1;
      const started = performance.now();
      dispatchClickSequence(cell.element);
      await waitForMutationOrTimeout(400);
      let next = await this.awaitChange(beforeField, beforeSignature);
      if (next && this.field.value === beforeField && next.signature === beforeSignature) {
        await sleep(300);
        next = this.readView();
      }
      this.logStep("click day", `${Math.round(performance.now() - started)} ms`);
      if (next && this.field.value === beforeField && next.signature === beforeSignature) {
        const alreadyCorrect = verifyFieldValue(this.field.value, this.target, "day").ok;
        if (alreadyCorrect) return;
        throw new DriverStop("stuck", "the day click did not change the date");
      }
      this.mode = "day";
    }
    async execute(initialView) {
      const initialKind = initialView.kind;
      let view = initialView;
      if (initialKind === "month" || initialKind === "year" || initialKind === "decade") {
        this.mode = "month-year";
      }
      let directTried = false;
      let zoomTried = false;
      let zoomAttempts = 0;
      let monthZoomTried = false;
      let safety = 0;
      for (; ; ) {
        safety += 1;
        if (safety > 80) throw new DriverStop("stuck", "the calendar entered an unexpected loop");
        this.checkBudget();
        switch (view.kind) {
          case "day": {
            this.mode = "day";
            if (view.year === this.target.year && view.month === this.target.month) {
              await this.clickDay(view);
              return;
            }
            if (!directTried) {
              directTried = true;
              const interacted = await this.setControls(true);
              if (interacted) {
                view = this.readView();
                if (!view) {
                  this.mode = "month-year";
                  return;
                }
                continue;
              }
            }
            if (!zoomTried) {
              if (!view.header) {
                zoomTried = true;
                continue;
              }
              if (zoomAttempts < 3) {
                const beforeSignature = view.signature;
                await this.click(view.header, "open month or year view", true);
                zoomAttempts += 1;
                const next = this.readView();
                if (!next) {
                  throw new DriverStop("failed", "the calendar closed while opening the month view");
                }
                if (next.kind !== "day" || next.signature !== beforeSignature) {
                  view = next;
                  continue;
                }
              }
              zoomTried = true;
              continue;
            }
            view = await this.navigateMonth(view);
            continue;
          }
          case "month": {
            if (view.year === null) {
              throw new DriverStop("failed", "the calendar month view has no readable year");
            }
            if (view.year !== this.target.year) {
              const direct = await this.setControls(false);
              if (direct) {
                view = this.readView();
                if (!view) {
                  this.mode = "month-year";
                  return;
                }
                continue;
              }
              if (!monthZoomTried && view.header) {
                monthZoomTried = true;
                const beforeSignature = view.signature;
                await this.click(view.header, "open year view", true);
                const zoomed = this.readView();
                if (zoomed && zoomed.signature !== beforeSignature && (zoomed.kind === "year" || zoomed.kind === "decade")) {
                  view = zoomed;
                  continue;
                }
              }
              view = await this.navigateYear(view);
              continue;
            }
            const cell = view.monthCells.find((entry) => entry.value === this.target.month);
            if (!cell) {
              throw new DriverStop("failed", "the requested month is not visible");
            }
            if (cell.disabled) {
              throw new DriverStop("not-allowed", "the requested month is disabled");
            }
            const beforeField = this.field.value;
            await this.click(cell.element, "choose month");
            const next = this.readView();
            if (!next) {
              this.mode = "month-year";
              return;
            }
            if (next.kind === "day") {
              this.mode = "day";
              view = next;
              continue;
            }
            if (next.kind === "month") {
              this.mode = "month-year";
              if (this.field.value !== beforeField) return;
              throw new DriverStop("stuck", "the month click did not open a day view");
            }
            view = next;
            continue;
          }
          case "year": {
            const yearCell = view.yearCells.find((entry) => entry.value === this.target.year);
            if (yearCell) {
              if (yearCell.disabled) {
                throw new DriverStop("not-allowed", "the requested year is disabled");
              }
              await this.click(yearCell.element, "choose year");
              const next = this.readView();
              if (!next) {
                this.mode = "month-year";
                return;
              }
              view = next;
              continue;
            }
            view = await this.navigateYearGrid(view);
            continue;
          }
          case "decade": {
            const decade = view.decadeCells.find(
              (cell) => !cell.disabled && this.target.year >= cell.start && this.target.year <= cell.end
            );
            if (decade) {
              await this.click(decade.element, "choose decade");
              const next = this.readView();
              if (!next) {
                this.mode = "month-year";
                return;
              }
              view = next;
              continue;
            }
            view = await this.navigateDecade(view);
            continue;
          }
          case "unknown": {
            await sleep(120);
            const next = this.readView();
            if (!next || next.kind === "unknown") {
              throw new DriverStop("failed", "the calendar view could not be recognized");
            }
            view = next;
            continue;
          }
        }
      }
      throw new DriverStop("failed", "the calendar disappeared unexpectedly");
    }
    async navigateMonth(view) {
      const current = currentMonthIndex(view);
      if (current === null) throw new DriverStop("failed", "the displayed month is unknown");
      const targetIndex = this.target.year * 12 + (this.target.month - 1);
      const direction = targetIndex > current ? "next" : "prev";
      const control = direction === "next" ? view.next : view.prev;
      if (!control) throw new DriverStop("failed", `the ${direction} month control was not found`);
      if (isControlDisabled(control)) {
        throw new DriverStop("not-allowed", `the ${direction} month control is disabled`);
      }
      await this.click(control, `go to ${direction} month`);
      const next = this.readView();
      if (!next) throw new DriverStop("failed", "the calendar closed while changing months");
      if (next.kind !== "day") return next;
      if (next.signature === view.signature) {
        throw new DriverStop("stuck", "the month did not change");
      }
      return next;
    }
    async navigateYear(view) {
      if (view.year === null) throw new DriverStop("failed", "the displayed year is unknown");
      const direction = this.target.year > view.year ? "next" : "prev";
      const control = direction === "next" ? view.next : view.prev;
      if (!control) throw new DriverStop("failed", `the ${direction} year control was not found`);
      if (isControlDisabled(control)) {
        throw new DriverStop("not-allowed", `the ${direction} year control is disabled`);
      }
      await this.click(control, `go to ${direction} year`);
      const next = this.readView();
      if (!next) throw new DriverStop("failed", "the calendar closed while changing years");
      return next;
    }
    async navigateYearGrid(view) {
      const years = view.yearCells.map((cell) => cell.value);
      if (!years.length) throw new DriverStop("failed", "no year cells were found");
      const min = Math.min(...years);
      const max = Math.max(...years);
      const direction = this.target.year < min ? "prev" : this.target.year > max ? "next" : null;
      if (direction === null) {
        throw new DriverStop("failed", "the requested year is not present in the year grid");
      }
      const control = direction === "next" ? view.next : view.prev;
      if (!control) throw new DriverStop("failed", `the ${direction} year control was not found`);
      if (isControlDisabled(control)) {
        throw new DriverStop("not-allowed", `the ${direction} year control is disabled`);
      }
      await this.click(control, `go to ${direction} year page`);
      const next = this.readView();
      if (!next) throw new DriverStop("failed", "the calendar closed while changing year pages");
      return next;
    }
    async navigateDecade(view) {
      const cells = view.decadeCells;
      if (!cells.length) throw new DriverStop("failed", "no decade cells were found");
      const min = Math.min(...cells.map((cell) => cell.start));
      const max = Math.max(...cells.map((cell) => cell.end));
      const direction = this.target.year < min ? "prev" : "next";
      const control = direction === "next" ? view.next : view.prev;
      if (!control) throw new DriverStop("failed", `the ${direction} decade control was not found`);
      if (isControlDisabled(control)) {
        throw new DriverStop("not-allowed", `the ${direction} decade control is disabled`);
      }
      if (this.target.year <= max && this.target.year >= min) {
        throw new DriverStop("not-allowed", "the requested year is disabled");
      }
      await this.click(control, `go to ${direction} decade`);
      const next = this.readView();
      if (!next) throw new DriverStop("failed", "the calendar closed while changing decades");
      return next;
    }
    async closeCalendarIfOpen() {
      if (!this.lastCalendar?.isConnected || !isVisible(this.lastCalendar) || !this.recognizeCalendar(this.lastCalendar)) {
        return;
      }
      this.logStep("close calendar", "pressing Escape");
      dispatchKey(document, "Escape");
      await sleep(120);
      if (isVisible(this.lastCalendar) && this.recognizeCalendar(this.lastCalendar)) {
        this.logStep("close calendar", "clicking outside the calendar");
        dispatchClickSequence(document.body, { x: 1, y: 1 });
        await sleep(120);
      }
    }
  };

  // src/content/labels.ts
  function cleanLabelText(value) {
    return value.replace(/\s+/g, " ").replace(/^[\s*•·:–—-]+/u, "").replace(/[\s*•·:–—-]+$/u, "").trim();
  }
  function rootFor(element) {
    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root : element.ownerDocument;
  }
  function elementById(root, id) {
    return root.getElementById(id);
  }
  function textFromIds(element, ids) {
    const root = rootFor(element);
    const parts = [];
    for (const id of ids.split(/\s+/).filter(Boolean)) {
      const target = elementById(root, id);
      if (target) {
        const text = cleanLabelText(target.textContent);
        if (text) parts.push(text);
      }
    }
    return parts.length ? parts.join(" ") : null;
  }
  function labelFor(element) {
    const root = rootFor(element);
    const labels = root.querySelectorAll("label[for]");
    const id = element.getAttribute("id");
    if (!id) return null;
    for (const label of labels) {
      if (label.getAttribute("for") === id) {
        const text = cleanLabelText(label.textContent);
        if (text) return text;
      }
    }
    return null;
  }
  function wrappingLabel(element) {
    const label = element.closest("label");
    if (!label) return null;
    const clone = label.cloneNode(true);
    for (const input of clone.querySelectorAll("input, select, textarea")) {
      input.remove();
    }
    const text = cleanLabelText(clone.textContent);
    return text || null;
  }
  function groupText(element) {
    const fieldset = element.closest("fieldset");
    const legend = fieldset?.querySelector("legend");
    if (legend) {
      const text = cleanLabelText(legend.textContent);
      if (text) return text;
    }
    let current = element;
    for (let depth = 0; depth < 4 && current; depth += 1) {
      let sibling = current.previousElementSibling;
      while (sibling) {
        const text = cleanLabelText(sibling.textContent);
        if (text && text.length <= 120 && !sibling.querySelector("input, select, textarea")) {
          return text;
        }
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }
    return null;
  }
  function getFieldLabel(field) {
    const labelledBy = field.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = textFromIds(field, labelledBy);
      if (text) return text;
    }
    const ariaLabel = cleanLabelText(field.getAttribute("aria-label") ?? "");
    if (ariaLabel) return ariaLabel;
    const explicit = labelFor(field);
    if (explicit) return explicit;
    const wrapping = wrappingLabel(field);
    if (wrapping) return wrapping;
    const title = cleanLabelText(field.getAttribute("title") ?? "");
    if (title) return title;
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      const placeholder = cleanLabelText(field.placeholder);
      if (placeholder) return placeholder;
    }
    const group = groupText(field);
    if (group) return group;
    return STRINGS.fieldFallbackLabel;
  }
  function getAriaDescription(field) {
    const describedBy = field.getAttribute("aria-describedby");
    if (!describedBy) return "";
    return textFromIds(field, describedBy) ?? "";
  }

  // src/content/layers.ts
  function sleep2(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }
  async function sendBackground(request) {
    try {
      return await chrome.runtime.sendMessage(request);
    } catch {
      return null;
    }
  }
  async function applyNativeLayer(field, target) {
    const type = field.type.toLowerCase();
    if (type !== "date" && type !== "month") {
      return {
        status: "not-applicable",
        value: field.value,
        mode: "day",
        format: null,
        detail: "not a native date or month input"
      };
    }
    if (field.disabled) {
      return {
        status: "not-allowed",
        value: field.value,
        mode: type === "month" ? "month-year" : "day",
        format: type === "month" ? "yyyy-mm" : "yyyy-mm-dd",
        detail: "native input is disabled"
      };
    }
    const value = type === "month" ? toIsoMonth(target) : toIsoDate(target);
    focusWithoutScroll(field);
    nativeInputValueSetter(field, value);
    dispatchInputEvents(field);
    await sleep2(80);
    return {
      status: "applied",
      value: field.value,
      mode: type === "month" ? "month-year" : "day",
      format: type === "month" ? "yyyy-mm" : "yyyy-mm-dd",
      detail: `set native ${type} input`
    };
  }
  function isInClosedShadowRoot(element) {
    const root = element.getRootNode();
    if (!(root instanceof ShadowRoot)) return false;
    return root.host.shadowRoot !== root;
  }
  function temporaryToken() {
    return `adp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  async function withTargetAttribute(field, action) {
    if (isInClosedShadowRoot(field)) return null;
    const token = temporaryToken();
    field.setAttribute("data-adp-target", token);
    try {
      return await action(token);
    } finally {
      if (field.getAttribute("data-adp-target") === token) {
        field.removeAttribute("data-adp-target");
      }
    }
  }
  async function tryLibraryAdapter(field, target) {
    if (!(field instanceof HTMLInputElement)) {
      return {
        outcome: {
          status: "not-applicable",
          value: "",
          mode: "day",
          format: null,
          detail: "field is not an input"
        },
        info: null
      };
    }
    if (isInClosedShadowRoot(field)) {
      return {
        outcome: {
          status: "not-applicable",
          value: field.value,
          mode: "day",
          format: null,
          detail: "field is inside a closed shadow root; MAIN world cannot reach it"
        },
        info: null
      };
    }
    const response = await withTargetAttribute(field, async (token) => {
      return sendBackground({
        type: "adp:library",
        token,
        year: target.year,
        month: target.month,
        day: target.day,
        mode: "set"
      });
    });
    const info = response?.info ?? null;
    if (!response?.ok || !info?.supported) {
      return {
        outcome: {
          status: "not-applicable",
          value: field.value,
          mode: "day",
          format: info?.format ?? null,
          detail: info ? `library ${info.name} was not usable` : "no known date library found"
        },
        info
      };
    }
    await sleep2(100);
    return {
      outcome: {
        status: "applied",
        value: info.value ?? field.value,
        mode: "day",
        format: null,
        detail: `set through ${info.name}${info.version ? ` ${info.version}` : ""}`
      },
      info
    };
  }
  async function inspectLibraries(field) {
    const response = await withTargetAttribute(field, async (token) => {
      return sendBackground({
        type: "adp:library",
        token,
        year: 2e3,
        month: 1,
        day: 1,
        mode: "inspect"
      });
    });
    return response?.info ?? null;
  }
  function deepRootOf(element) {
    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root : element.ownerDocument;
  }
  function dateLikeOtherFields(field) {
    const root = deepRootOf(field);
    const result = [];
    const hints = /(date|birth|dob|issue|expiry|expire|month|year)/i;
    for (const candidate of root.querySelectorAll("input")) {
      if (!(candidate instanceof HTMLInputElement) || candidate === field) continue;
      if (!candidate.value.trim()) continue;
      const type = candidate.type.toLowerCase();
      const looksLikeDate = type === "date" || type === "month" || hints.test(candidate.name) || hints.test(candidate.id) || hints.test(candidate.getAttribute("aria-label") ?? "") || hints.test(candidate.placeholder) || hints.test(candidate.className);
      if (!looksLikeDate) continue;
      if (type === "date" && !parseIsoDate(candidate.value)) continue;
      if (type === "month" && !parseIsoMonth(candidate.value)) continue;
      result.push(candidate);
      if (result.length >= 5) break;
    }
    return result;
  }
  function collectOtherFieldValues(field) {
    return dateLikeOtherFields(field).map((candidate) => candidate.value.trim()).filter(Boolean).slice(0, 5);
  }
  function detectWriteFormat(field, label, dependencies) {
    const attributes = formatHintFromAttributes(field);
    if (field instanceof HTMLInputElement) {
      const type = field.type.toLowerCase();
      if (type === "date") attributes.push("yyyy-mm-dd");
      if (type === "month") attributes.push("yyyy-mm");
    }
    const labelTexts = [
      label,
      field.getAttribute("aria-label") ?? "",
      field.getAttribute("title") ?? "",
      getAriaDescription(field)
    ].filter(Boolean);
    return detectDateFormat({
      learned: dependencies.learnedFormat,
      value: field.value,
      placeholder: field.placeholder,
      attributes,
      labelTexts,
      library: dependencies.libraryInfo ? { name: dependencies.libraryInfo.name, format: dependencies.libraryInfo.format } : null,
      otherFieldValues: collectOtherFieldValues(field)
    });
  }
  async function applyDirectWrite(field, target, label, dependencies) {
    const detection = detectWriteFormat(field, label, dependencies);
    if (!detection.pattern) {
      return {
        status: "format-unknown",
        value: field.value,
        mode: "day",
        format: null,
        detail: detection.source,
        detection
      };
    }
    if (field.disabled) {
      return {
        status: "not-allowed",
        value: field.value,
        mode: patternHasDay(detection.pattern) ? "day" : "month-year",
        format: detection.pattern,
        detail: "field is disabled",
        detection
      };
    }
    const value = formatWithPattern(target, detection.pattern);
    if (value === null) {
      return {
        status: "format-unknown",
        value: field.value,
        mode: "day",
        format: null,
        detail: "format could not produce a value",
        detection
      };
    }
    const hadReadonly = field.hasAttribute("readonly");
    if (hadReadonly) field.removeAttribute("readonly");
    try {
      focusWithoutScroll(field);
      nativeInputValueSetter(field, value);
      dispatchInputEvents(field);
      if (field.ownerDocument.defaultView) {
        const view = field.ownerDocument.defaultView;
        field.dispatchEvent(new view.FocusEvent("focus", { composed: true }));
        field.dispatchEvent(new view.FocusEvent("blur", { composed: true }));
      }
      field.blur();
      await sleep2(500);
    } finally {
      if (hadReadonly && field.isConnected) field.setAttribute("readonly", "");
    }
    return {
      status: "applied",
      value: field.value,
      mode: patternHasDay(detection.pattern) ? "day" : "month-year",
      format: detection.pattern,
      detail: `${detection.source}: ${detection.pattern}`,
      detection
    };
  }
  async function loadExtensionConfig() {
    const response = await sendBackground({ type: "adp:get-config" });
    return response?.config ?? null;
  }
  async function loadLearnedFormat(origin, fieldKey) {
    const response = await sendBackground({
      type: "adp:get-format",
      origin,
      fieldKey
    });
    return response?.format ?? null;
  }
  async function storeLearnedFormat(origin, fieldKey, pattern) {
    const response = await sendBackground({
      type: "adp:set-format",
      origin,
      fieldKey,
      pattern
    });
    return Boolean(response?.ok);
  }

  // src/content/flow.ts
  var activeFlow = null;
  function isFlowActive() {
    return activeFlow !== null;
  }
  var ContentFlow = class _ContentFlow {
    field;
    label;
    fieldKey;
    origin;
    dialog = null;
    config = DEFAULT_CONFIG;
    learnedFormat = null;
    fieldFormat = null;
    libraryInfo = null;
    driverResult = null;
    flowLog = [];
    startedAt = performance.now();
    lastResult = STRINGS.diagnostics.notRun;
    dialogClosed = false;
    completed = false;
    constructor(field, label) {
      this.field = field;
      this.label = label;
      this.origin = location.origin || `${location.protocol}//${location.host}`;
      this.fieldKey = fieldKeyFor(field, label);
    }
    static async start(field) {
      if (activeFlow) return;
      const label = getFieldLabel(field);
      const flow = new _ContentFlow(field, label);
      activeFlow = flow;
      try {
        await flow.open();
      } catch {
        activeFlow = null;
        announce(STRINGS.siteRejected, "assertive");
        scheduleAnnouncementCleanup();
      }
    }
    async open() {
      const [config, learned] = await Promise.all([
        loadExtensionConfig(),
        loadLearnedFormat(this.origin, this.fieldKey)
      ]);
      this.config = normalizeConfig(config ?? DEFAULT_CONFIG);
      this.learnedFormat = learned;
      this.fieldFormat = detectWriteFormat(this.field, this.label, {
        learnedFormat: learned,
        libraryInfo: null
      }).pattern;
      this.log("start", `field label: ${this.label}`);
      const bounds = yearBoundsFor(this.field, this.config);
      const fallbackDate = clampDate({
        year: Math.min(Math.max((/* @__PURE__ */ new Date()).getFullYear(), bounds.minYear), bounds.maxYear),
        month: 1,
        day: 1
      });
      const initialDate = parseInitialDate(this.field, this.learnedFormat ?? this.fieldFormat) ?? fallbackDate;
      const dialog = new DateDialog({
        field: this.field,
        label: this.label,
        initialDate,
        bounds,
        callbacks: {
          onApply: async (date) => {
            await this.runApply(date);
          },
          onCancel: () => {
            this.cancel();
          },
          onDiagnostics: async () => {
            await this.copyDiagnostics();
          }
        }
      });
      this.dialog = dialog;
      dialog.open();
      cancelAnnouncementCleanup();
      announce(STRINGS.opened(this.label), "polite");
    }
    async runApply(target) {
      this.log("apply", `target ${target.year}-${target.month}-${target.day}`);
      announce(STRINGS.working, "polite");
      try {
        await this.applyTarget(target);
      } catch (error) {
        this.log("error", error instanceof Error ? error.message : String(error));
        this.lastResult = STRINGS.siteRejected;
        if (this.dialog?.isOpen()) {
          this.dialog.setBusy(false);
          this.dialog.focusFirst();
          announce(STRINGS.siteRejected, "assertive");
        } else {
          this.restoreFocusAndFinish(STRINGS.siteRejected);
        }
      }
    }
    async applyTarget(target) {
      if (this.field.disabled) {
        this.failInDialog(STRINGS.notAllowed);
        return;
      }
      const bounds = yearBoundsFor(this.field, this.config);
      if (bounds.minDate && compareDates(target, bounds.minDate) < 0) {
        this.failInDialog(STRINGS.notAllowed);
        return;
      }
      if (bounds.maxDate && compareDates(target, bounds.maxDate) > 0) {
        this.failInDialog(STRINGS.notAllowed);
        return;
      }
      const type = this.field.type.toLowerCase();
      const native = await applyNativeLayer(this.field, target);
      this.log("layer 0", `${native.status}: ${native.detail}`);
      if (native.status === "not-allowed") {
        this.failInDialog(STRINGS.notAllowed);
        return;
      }
      if (native.status === "applied") {
        const outcome2 = await this.trySuccess(
          this.field.value,
          target,
          native.mode,
          native.format,
          "native input"
        );
        if (outcome2 !== "mismatch") return;
      }
      if (type === "date" || type === "month") {
        this.failInDialog(STRINGS.siteRejected);
        return;
      }
      const driver = new CalendarDriver(this.field, target);
      const result = await driver.run();
      this.driverResult = result;
      for (const entry of result.log) {
        this.log(`driver ${entry.action}`, `${entry.elapsedMs} ms: ${entry.detail}`);
      }
      if (result.status === "not-allowed") {
        this.failInDialog(STRINGS.notAllowed);
        return;
      }
      if (result.status === "stuck") {
        this.failInDialog(STRINGS.calendarStuck);
        return;
      }
      if (result.status === "success") {
        const outcome2 = await this.trySuccess(
          result.value,
          target,
          result.mode,
          this.learnedFormat ?? this.fieldFormat,
          "calendar driver"
        );
        if (outcome2 !== "mismatch") return;
      }
      const library = await tryLibraryAdapter(this.field, target);
      if (library.info) this.libraryInfo = library.info;
      this.log(
        "layer B",
        `${library.outcome.status}: ${library.outcome.detail}${library.info?.name ? ` (${library.info.name})` : ""}`
      );
      if (library.outcome.status === "not-allowed") {
        this.failInDialog(STRINGS.notAllowed);
        return;
      }
      if (library.outcome.status === "applied") {
        const libraryFormat = this.learnedFormat ?? normalizeLibraryFormat(library.info?.format ?? null, library.info?.name ?? "unknown") ?? this.fieldFormat;
        const outcome2 = await this.trySuccess(
          this.field.value,
          target,
          "day",
          libraryFormat,
          "library adapter"
        );
        if (outcome2 !== "mismatch") return;
      }
      const dependencies = {
        learnedFormat: this.learnedFormat,
        libraryInfo: this.libraryInfo
      };
      const direct = await applyDirectWrite(this.field, target, this.label, dependencies);
      this.log("layer C", `${direct.status}: ${direct.detail}; source ${direct.detection.source}`);
      if (direct.status === "format-unknown") {
        this.failInDialog(STRINGS.formatUnknown);
        return;
      }
      if (direct.status === "not-allowed") {
        this.failInDialog(STRINGS.notAllowed);
        return;
      }
      if (direct.status === "not-applicable") {
        this.failInDialog(STRINGS.calendarNotFound);
        return;
      }
      const outcome = await this.trySuccess(
        this.field.value,
        target,
        direct.mode,
        direct.format,
        `direct write (${direct.detection.source})`
      );
      if (outcome === "mismatch") {
        this.failInDialog(STRINGS.siteRejected);
      }
    }
    async trySuccess(value, target, mode, format, source) {
      const verification = verifyFieldValue(value, target, mode, format);
      this.log(
        "verify",
        `${source}: ${verification.ok ? "ok" : "failed"} (${verification.reason}); format ${format ?? "unknown"}`
      );
      if (!verification.ok) return "mismatch";
      const success = await this.completeSuccess(target, mode, format);
      return success ? "success" : "final-failure";
    }
    async completeSuccess(target, mode, format) {
      this.dialog?.close();
      this.dialogClosed = true;
      focusWithoutScroll(this.field);
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      const finalValue = this.field.value;
      const finalVerification = verifyFieldValue(finalValue, target, mode, format);
      this.log(
        "final verify",
        `${finalVerification.ok ? "ok" : "failed"} (${finalVerification.reason}); value read after focus return`
      );
      if (!finalVerification.ok) {
        this.lastResult = STRINGS.siteRejected;
        this.completed = true;
        activeFlow = null;
        announce(STRINGS.siteRejected, "assertive");
        scheduleAnnouncementCleanup();
        return false;
      }
      this.learnFormat(finalValue, finalVerification.parsed, target, format);
      const message = mode === "month-year" ? STRINGS.successMonthYear(finalValue) : STRINGS.success(finalValue);
      this.lastResult = message;
      this.completed = true;
      activeFlow = null;
      announce(message, "assertive");
      scheduleAnnouncementCleanup();
      return true;
    }
    learnFormat(value, parsed, target, format) {
      const actual = parsed ? { year: parsed.year, month: parsed.month, day: parsed.day ?? target.day } : target;
      const pattern = (format && parseWithFormat(value, format)?.valid ? format : null) ?? deriveLearnedPattern(value) ?? derivePatternFromResult(value, actual);
      if (!pattern) return;
      this.learnedFormat = pattern;
      void storeLearnedFormat(this.origin, this.fieldKey, pattern).then((ok) => {
        this.log("learn format", `${pattern}: ${ok ? "stored" : "not stored"}`);
      });
    }
    failInDialog(message) {
      this.lastResult = message;
      if (this.dialog?.isOpen()) {
        this.dialog.setBusy(false);
        this.dialog.focusFirst();
        announce(message, "assertive");
        return;
      }
      this.restoreFocusAndFinish(message);
    }
    restoreFocusAndFinish(message) {
      this.dialog?.close();
      this.dialogClosed = true;
      focusWithoutScroll(this.field);
      this.lastResult = message;
      announce(message, "assertive");
      scheduleAnnouncementCleanup();
      activeFlow = null;
    }
    cancel() {
      this.lastResult = STRINGS.cancelled;
      this.dialog?.close();
      this.dialogClosed = true;
      focusWithoutScroll(this.field);
      announce(STRINGS.cancelled, "assertive");
      scheduleAnnouncementCleanup();
      activeFlow = null;
      this.completed = true;
    }
    async copyDiagnostics() {
      this.log("diagnostics", "copy requested");
      const inspect = await inspectLibraries(this.field);
      if (inspect) this.libraryInfo = inspect;
      const report = this.buildDiagnosticReport();
      const copied = await copyTextToClipboard(report);
      if (copied) {
        announce(STRINGS.reportCopied, "assertive");
      } else {
        announce(STRINGS.reportCopyFailed, "assertive");
        this.dialog?.focusFirst();
      }
    }
    buildDiagnosticReport() {
      const fieldHtml = sanitizedOuterHtml(this.field, true, 2048);
      const ancestorParts = [];
      let ancestorBudget = 4096;
      let ancestor = this.field.parentElement;
      for (let depth = 0; depth < 3 && ancestor && ancestorBudget > 0; depth += 1) {
        const html = sanitizedOuterHtml(ancestor, false, ancestorBudget);
        ancestorParts.push(html);
        ancestorBudget -= Math.min(html.length, ancestorBudget);
        ancestor = ancestor.parentElement;
      }
      const driverCalendar = this.driverResult?.calendarElement;
      const openCalendar = driverCalendar?.isConnected ? driverCalendar : findCalendarCandidate(this.field);
      const calendarHtml = openCalendar ? sanitizedOuterHtml(openCalendar, true, 20480) : STRINGS.diagnostics.none;
      const libraries = describeLibrary(this.libraryInfo);
      const stepLines = [
        ...this.flowLog.map((entry) => `${entry.elapsedMs} ms ${entry.action}: ${entry.detail}`),
        ...(this.driverResult?.log ?? []).map(
          (entry) => `${entry.elapsedMs} ms driver #${entry.step} ${entry.action}: ${entry.detail}`
        )
      ];
      return [
        STRINGS.diagnostics.title,
        "",
        `${STRINGS.diagnostics.origin}: ${this.origin}`,
        `${STRINGS.diagnostics.path}: ${location.pathname}`,
        "",
        `${STRINGS.diagnostics.field}:`,
        fieldHtml,
        "",
        `${STRINGS.diagnostics.ancestors}:`,
        ancestorParts.join("\n\n") || STRINGS.diagnostics.none,
        "",
        `${STRINGS.diagnostics.calendar}:`,
        calendarHtml,
        "",
        `${STRINGS.diagnostics.libraries}:`,
        libraries,
        "",
        `${STRINGS.diagnostics.steps}:`,
        stepLines.join("\n") || STRINGS.diagnostics.none,
        "",
        `${STRINGS.diagnostics.result}:`,
        this.lastResult
      ].join("\n");
    }
    log(action, detail) {
      this.flowLog.push({
        elapsedMs: Math.round(performance.now() - this.startedAt),
        action,
        detail
      });
    }
    get isCompleted() {
      return this.completed;
    }
    get wasDialogClosed() {
      return this.dialogClosed;
    }
  };
  function normalizeConfig(config) {
    const earliestYear = Number.isInteger(config.earliestYear) ? Math.min(Math.max(config.earliestYear, 1), 9999) : DEFAULT_CONFIG.earliestYear;
    const futureYears = Number.isInteger(config.futureYears) ? Math.min(Math.max(config.futureYears, 0), 200) : DEFAULT_CONFIG.futureYears;
    return { earliestYear, futureYears };
  }
  function fieldKeyFor(field, label) {
    const value = [
      field.name,
      field.id,
      label,
      field.placeholder,
      field.getAttribute("aria-label") ?? "",
      "date-field"
    ].map((part) => part.trim()).find((part) => part.length > 0) ?? "date-field";
    return value.replace(/\s+/g, " ").slice(0, 160);
  }
  function parseInitialDate(field, learnedFormat) {
    const value = field.value.trim();
    if (!value) return null;
    const type = field.type.toLowerCase();
    if (type === "date") return parseIsoDate(value);
    if (type === "month") {
      const month = parseIsoMonth(value);
      return month ? { ...month, day: 1 } : null;
    }
    if (learnedFormat) {
      const parsed = parseWithFormat(value, learnedFormat);
      if (parsed?.valid) {
        return {
          year: parsed.year,
          month: parsed.month,
          day: parsed.day ?? 1
        };
      }
    }
    const loose = looseParseDate(value);
    if (loose?.valid && !loose.ambiguous) {
      return { year: loose.year, month: loose.month, day: loose.day ?? 1 };
    }
    return null;
  }
  function parseBoundary(field, attribute) {
    const raw = field.getAttribute(attribute)?.trim();
    if (!raw) return null;
    const iso = parseIsoDate(raw);
    if (iso) return iso;
    const month = parseIsoMonth(raw);
    if (month) {
      return {
        ...month,
        day: attribute === "max" ? daysInMonth(month.year, month.month) : 1
      };
    }
    const loose = looseParseDate(raw);
    if (loose?.valid) {
      return {
        year: loose.year,
        month: loose.month,
        day: loose.day ?? (attribute === "max" ? daysInMonth(loose.year, loose.month) : 1)
      };
    }
    const yearMatch = /\b(\d{4})\b/.exec(raw);
    if (yearMatch) {
      const year = Number(yearMatch[1]);
      return {
        year,
        month: attribute === "max" ? 12 : 1,
        day: attribute === "max" ? 31 : 1
      };
    }
    return null;
  }
  function yearBoundsFor(field, config) {
    const minDate = parseBoundary(field, "min");
    const maxDate = parseBoundary(field, "max");
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    let minYear = minDate?.year ?? config.earliestYear;
    let maxYear = maxDate?.year ?? currentYear + config.futureYears;
    if (maxYear < minYear) {
      minYear = config.earliestYear;
      maxYear = currentYear + config.futureYears;
    }
    return { minYear, maxYear, minDate, maxDate };
  }
  function describeLibrary(info) {
    if (!info || info.name === "unknown") return STRINGS.diagnostics.none;
    const parts = [info.name];
    if (info.version) parts.push(`version ${info.version}`);
    if (info.format) parts.push(`format ${info.format}`);
    parts.push(info.supported ? "adapter available" : "adapter unavailable");
    if (info.error) parts.push(`error ${info.error}`);
    return parts.join(", ");
  }
  function sanitizedOuterHtml(element, keepTargetValue, limit) {
    try {
      const clone = element.cloneNode(true);
      for (const script of clone.querySelectorAll("script")) script.remove();
      for (const input of clone.querySelectorAll("input")) {
        if (!keepTargetValue) input.removeAttribute("value");
        input.removeAttribute("data-adp-target");
      }
      if (clone instanceof HTMLInputElement) clone.removeAttribute("data-adp-target");
      const html = clone.outerHTML;
      return html.length > limit ? `${html.slice(0, limit)}
[truncated]` : html;
    } catch {
      return STRINGS.diagnostics.unavailable;
    }
  }
  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  // src/content/index.ts
  var START_MESSAGE = "adp:start";
  function activeFrameIsChildFrame() {
    const active = deepActiveElement(document);
    return active instanceof HTMLIFrameElement;
  }
  function shouldHandleStart() {
    if (!isDocumentFocused()) return false;
    if (activeFrameIsChildFrame()) return false;
    return true;
  }
  async function startFromFocusedField() {
    if (isFlowActive()) return;
    if (!shouldHandleStart()) return;
    const focused = resolveFocusedField(document);
    if (!focused.field) {
      announce(STRINGS.notInput, "assertive");
      scheduleAnnouncementCleanup();
      return;
    }
    await ContentFlow.start(focused.field);
  }
  function registerStartListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (typeof message !== "object" || message === null || message.type !== START_MESSAGE) {
        return false;
      }
      if (!shouldHandleStart()) return false;
      void startFromFocusedField().then(() => {
        sendResponse({ ok: true });
      }).catch(() => {
        sendResponse({ ok: false });
      });
      return true;
    });
  }
  if (!window.__adpContentLoaded) {
    window.__adpContentLoaded = true;
    registerStartListener();
  }
})();
