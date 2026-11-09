/* Accessible Date Picker. No remote code, no network calls. */

// src/bridge/mainWorld.ts
function mainWorldLibraryAdapter(token, year, month, day, mode) {
  const none = {
    name: "unknown",
    version: null,
    format: null,
    supported: false,
    value: null
  };
  function deepFind(root, depth) {
    if (depth > 10) return null;
    const direct = root.querySelector(`[data-adp-target="${token}"]`);
    if (direct) return direct;
    for (const element2 of root.querySelectorAll("*")) {
      if (element2.shadowRoot) {
        const found = deepFind(element2.shadowRoot, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  function cleanup() {
    try {
      if (element?.getAttribute("data-adp-target") === token) {
        element.removeAttribute("data-adp-target");
      }
    } catch {
    }
  }
  let element = null;
  try {
    element = deepFind(document, 0);
  } catch {
    element = null;
  }
  if (!element) {
    return { ok: false, info: none };
  }
  const page = window;
  const input = element;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  let info = { ...none };
  const jq = page.jQuery ?? page.$;
  const flatpickrInstance = element._flatpickr;
  const pikadayHandle = element;
  const pikadayInstance = pikadayHandle._pikaday ?? pikadayHandle.pikaday;
  function formatPikadayDate(value, pattern) {
    if (!pattern) return null;
    const day2 = value.getDate();
    const month2 = value.getMonth() + 1;
    const year2 = value.getFullYear();
    const monthLong = [
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
    ][month2 - 1];
    let output = "";
    let index = 0;
    while (index < pattern.length) {
      const token2 = /^(YYYY|YY|MMMM|MMM|MM|M|DD|D)/.exec(pattern.slice(index))?.[0];
      if (!token2) {
        output += pattern[index] ?? "";
        index += 1;
        continue;
      }
      switch (token2) {
        case "D":
          output += String(day2);
          break;
        case "DD":
          output += String(day2).padStart(2, "0");
          break;
        case "M":
          output += String(month2);
          break;
        case "MM":
          output += String(month2).padStart(2, "0");
          break;
        case "MMM":
          output += (monthLong ?? "").slice(0, 3);
          break;
        case "MMMM":
          output += monthLong ?? "";
          break;
        case "YY":
          output += String(year2 % 100).padStart(2, "0");
          break;
        case "YYYY":
          output += String(year2).padStart(4, "0");
          break;
      }
      index += token2.length;
    }
    return output;
  }
  try {
    if (flatpickrInstance && typeof flatpickrInstance.setDate === "function") {
      const library = "flatpickr";
      info = {
        name: library,
        version: page.flatpickr?.version ?? null,
        format: flatpickrInstance.config?.dateFormat ?? null,
        supported: true,
        value: input.value
      };
      if (mode === "set") {
        flatpickrInstance.setDate(date, true);
      }
    } else {
      let handled = false;
      if (jq && typeof jq === "function") {
        const wrapped = jq(element);
        const instance = wrapped.data?.("datepicker");
        if (instance) {
          const isJqueryUi = Boolean(instance.settings);
          const isBootstrap = typeof instance.format === "string" || typeof instance.update === "function";
          if (isJqueryUi) {
            const pluginAvailable = typeof wrapped.datepicker === "function";
            info = {
              name: "jquery-ui",
              version: jq.ui?.version ?? null,
              format: instance.settings?.dateFormat ?? null,
              supported: pluginAvailable || typeof instance.setDate === "function",
              value: input.value
            };
            if (mode === "set") {
              if (pluginAvailable) {
                wrapped.datepicker?.("setDate", date);
                jq.datepicker?._selectDate?.(element);
              } else if (typeof instance.setDate === "function") {
                instance.setDate(date);
              }
            }
            handled = true;
          } else if (isBootstrap) {
            info = {
              name: "bootstrap-datepicker",
              version: jq.fn?.datepicker?.version ?? jq.fn?.datepicker?.Constructor?.version ?? null,
              format: instance.format ?? null,
              supported: typeof instance.setDate === "function" || typeof instance.update === "function",
              value: input.value
            };
            if (mode === "set") {
              if (typeof instance.setDate === "function") instance.setDate(date);
              else if (typeof instance.update === "function") instance.update(date);
            }
            handled = true;
          }
        }
      }
      if (!handled && pikadayInstance && typeof pikadayInstance.setDate === "function") {
        const settings = pikadayInstance._o;
        info = {
          name: "pikaday",
          version: page.Pikaday?.version ?? null,
          format: settings?.format ?? null,
          supported: true,
          value: input.value
        };
        if (mode === "set") {
          const hasOwnToString = settings ? Object.prototype.hasOwnProperty.call(settings, "toString") : false;
          const originalToString = settings?.toString ?? null;
          const previousToString = hasOwnToString && typeof originalToString === "function" ? originalToString : null;
          if (settings) {
            settings.toString = (value, format) => {
              if (previousToString) return previousToString(value, format);
              return formatPikadayDate(value, format) ?? value.toDateString();
            };
          }
          try {
            pikadayInstance.setDate(date, true);
          } finally {
            if (settings) {
              if (hasOwnToString) settings.toString = originalToString;
              else delete settings.toString;
            }
          }
        }
      }
    }
  } catch (error) {
    cleanup();
    return {
      ok: false,
      info: {
        ...info,
        error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        value: input.value
      }
    };
  }
  cleanup();
  return { ok: info.supported, info: { ...info, value: input.value } };
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
function monthName(month) {
  return MONTH_NAMES[month - 1] ?? "";
}
function monthAbbreviation(month) {
  return MONTH_ABBREVIATIONS[month - 1] ?? "";
}
function pad(value, length) {
  return String(value).padStart(length, "0");
}

// src/shared/formats.ts
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

// src/shared/messages.ts
var DEFAULT_CONFIG = {
  earliestYear: 1900,
  futureYears: 30
};

// src/shared/storage.ts
var CONFIG_KEY = "adp:config";
var FORMATS_KEY = "adp:formats";
var MAX_FORMATS = 500;
var MAX_ORIGIN_LENGTH = 300;
var MAX_FIELD_KEY_LENGTH = 160;
var MAX_PATTERN_LENGTH = 40;
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
function sanitizeOrigin(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ORIGIN_LENGTH) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}
function sanitizeFieldKey(value) {
  if (typeof value !== "string") return null;
  const cleaned = stripControlCharacters(value.replace(/\s+/g, " ")).trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_FIELD_KEY_LENGTH);
}
function sanitizePattern(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PATTERN_LENGTH) return null;
  const produced = formatWithPattern({ year: 2e3, month: 1, day: 2 }, trimmed);
  return produced === null ? null : trimmed;
}
function formatStorageKey(origin, fieldKey) {
  return JSON.stringify([origin, fieldKey]);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasControlCharacters(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
function stripControlCharacters(value) {
  let output = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) continue;
    output += character;
  }
  return output;
}
function parseFormats(value) {
  if (!isRecord(value)) return {};
  const formats = {};
  for (const [key, record] of Object.entries(value)) {
    if (!isRecord(record)) continue;
    const pattern = sanitizePattern(record.pattern);
    if (!pattern) continue;
    const learnedAt = typeof record.learnedAt === "number" && Number.isFinite(record.learnedAt) ? record.learnedAt : 0;
    formats[key] = { pattern, learnedAt };
  }
  return formats;
}
async function readConfig() {
  try {
    const stored = await chrome.storage.local.get(CONFIG_KEY);
    return sanitizeConfig(stored[CONFIG_KEY]);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
async function ensureDefaultConfig() {
  try {
    const stored = await chrome.storage.local.get(CONFIG_KEY);
    if (stored[CONFIG_KEY] === void 0) {
      await chrome.storage.local.set({ [CONFIG_KEY]: { ...DEFAULT_CONFIG } });
    }
  } catch {
  }
}
async function readFormat(origin, fieldKey) {
  try {
    const stored = await chrome.storage.local.get(FORMATS_KEY);
    const formats = parseFormats(stored[FORMATS_KEY]);
    const record = formats[formatStorageKey(origin, fieldKey)];
    return record?.pattern ?? null;
  } catch {
    return null;
  }
}
async function writeFormat(origin, fieldKey, pattern) {
  const cleanOrigin = sanitizeOrigin(origin);
  const cleanFieldKey = sanitizeFieldKey(fieldKey);
  const cleanPattern = sanitizePattern(pattern);
  if (!cleanOrigin || !cleanFieldKey || !cleanPattern) return false;
  try {
    const stored = await chrome.storage.local.get(FORMATS_KEY);
    const formats = parseFormats(stored[FORMATS_KEY]);
    formats[formatStorageKey(cleanOrigin, cleanFieldKey)] = {
      pattern: cleanPattern,
      learnedAt: Date.now()
    };
    const entries = Object.entries(formats).sort(
      ([, first], [, second]) => second.learnedAt - first.learnedAt
    );
    const limited = Object.fromEntries(entries.slice(0, MAX_FORMATS));
    await chrome.storage.local.set({ [FORMATS_KEY]: limited });
    return true;
  } catch {
    return false;
  }
}

// src/background/index.ts
var START_MESSAGE = { type: "adp:start" };
var CONTENT_SCRIPT = "content.js";
var UNKNOWN_LIBRARY = {
  name: "unknown",
  version: null,
  format: null,
  supported: false,
  value: null
};
function isTestBuild() {
  return false;
}
function tabIdOf(tab) {
  return typeof tab?.id === "number" ? tab.id : null;
}
function isRestrictedUrl(rawUrl) {
  if (!rawUrl) return true;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "file:") {
    return true;
  }
  if (url.hostname === "chromewebstore.google.com") return true;
  if (url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore")) {
    return true;
  }
  return false;
}
async function showRestrictedBadge(tabId) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#9b1c1c" });
    await chrome.action.setBadgeText({ tabId, text: STRINGS.restrictedBadge });
    await chrome.action.setTitle({ tabId, title: STRINGS.notAllowedTooltip });
  } catch {
  }
}
async function clearBadge(tabId) {
  try {
    await chrome.action.setBadgeText({ tabId, text: "" });
    await chrome.action.setTitle({
      tabId,
      title: `${STRINGS.extensionName}: ${STRINGS.extensionDescription}`
    });
  } catch {
  }
}
async function startForTab(tabId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return false;
  }
  if (isRestrictedUrl(tab.url)) {
    await showRestrictedBadge(tabId);
    return false;
  }
  await clearBadge(tabId);
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: [CONTENT_SCRIPT]
    });
  } catch {
    await showRestrictedBadge(tabId);
    return false;
  }
  try {
    await chrome.tabs.sendMessage(tabId, START_MESSAGE);
    return true;
  } catch {
    return false;
  }
}
async function startActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tabId = tabIdOf(tab);
  if (tabId === null) return false;
  return startForTab(tabId);
}
function validLibraryRequest(request) {
  return typeof request.token === "string" && /^adp-[a-z0-9-]{1,80}$/.test(request.token) && typeof request.year === "number" && Number.isInteger(request.year) && request.year >= 1 && request.year <= 9999 && typeof request.month === "number" && Number.isInteger(request.month) && request.month >= 1 && request.month <= 12 && typeof request.day === "number" && Number.isInteger(request.day) && request.day >= 1 && request.day <= 31 && (request.mode === "set" || request.mode === "inspect");
}
function isLibraryResponse(value) {
  if (!isRecord(value) || typeof value.ok !== "boolean" || !isRecord(value.info)) return false;
  return typeof value.info.name === "string" && typeof value.info.supported === "boolean";
}
async function runLibraryAdapter(request, sender) {
  if (!validLibraryRequest(request)) {
    return { ok: false, info: { ...UNKNOWN_LIBRARY, error: "invalid request" } };
  }
  const tabId = sender.tab?.id;
  const frameId = sender.frameId;
  if (typeof tabId !== "number" || typeof frameId !== "number") {
    return { ok: false, info: { ...UNKNOWN_LIBRARY, error: "no sender frame" } };
  }
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      injectImmediately: true,
      func: mainWorldLibraryAdapter,
      args: [request.token, request.year, request.month, request.day, request.mode]
    });
    const result = results[0]?.result;
    if (isLibraryResponse(result)) return result;
    return { ok: false, info: { ...UNKNOWN_LIBRARY, error: "no adapter result" } };
  } catch (error) {
    return {
      ok: false,
      info: {
        ...UNKNOWN_LIBRARY,
        error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500)
      }
    };
  }
}
function handleMessage(message, sender, sendResponse) {
  if (!isRecord(message) || typeof message.type !== "string") return false;
  switch (message.type) {
    case "adp:library": {
      void runLibraryAdapter(message, sender).then(sendResponse);
      return true;
    }
    case "adp:get-config": {
      void readConfig().then((config) => ({ config })).then(sendResponse);
      return true;
    }
    case "adp:get-format": {
      const origin = typeof message.origin === "string" ? message.origin : "";
      const fieldKey = typeof message.fieldKey === "string" ? message.fieldKey : "";
      void readFormat(origin, fieldKey).then((format) => ({ format })).then(sendResponse);
      return true;
    }
    case "adp:set-format": {
      void writeFormat(message.origin, message.fieldKey, message.pattern).then((ok) => ({ ok })).then(sendResponse);
      return true;
    }
    default:
      return false;
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return handleMessage(message, sender, sendResponse);
});
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-date-picker") return;
  const tabId = tabIdOf(tab);
  if (tabId !== null) void startForTab(tabId);
});
chrome.action.onClicked.addListener((tab) => {
  const tabId = tabIdOf(tab);
  if (tabId !== null) void startForTab(tabId);
});
chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultConfig();
});
if (isTestBuild()) {
  const testGlobal = globalThis;
  testGlobal.__adpTestStartActive = startActiveTab;
  testGlobal.__adpTestStartTab = startForTab;
}
export {
  startForTab
};
