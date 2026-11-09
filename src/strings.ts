// All user-facing text lives here so it can be translated in one place.
// Month names and abbreviations are also used by the date parser and calendar driver.

export const MONTH_NAMES = [
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
  "December",
] as const;

export const MONTH_ABBREVIATIONS = [
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
  "Dec",
] as const;

export const STRINGS = {
  extensionName: "Accessible Date Picker",
  extensionDescription:
    "Set dates in stubborn website calendars with a keyboard and screen reader.",
  dialogTitle: (label: string) => `Select date for: ${label}`,
  opened: (label: string) => `Date picker for ${label}. Day, month and year.`,
  working: "Setting date, please wait.",
  success: (value: string) => `Date set: ${value}.`,
  successMonthYear: (value: string) =>
    `Date set: ${value}. This calendar only lets you choose month and year.`,
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
  clampAnnouncement: (monthName: string, year: number, days: number, day: number) =>
    `${monthName} ${year}, ${days} days, day changed to ${day}.`,
  notAllowedTooltip:
    "This page does not allow extensions to run. Open a normal web page, the Chrome Web Store, or the PDF viewer cannot be changed.",
  restrictedBadge: "ERR",
  options: {
    pageTitle: "Accessible Date Picker options",
    heading: "Accessible Date Picker options",
    intro:
      "Use these settings to change the year range in the date dialog and to clear formats learned on websites.",
    shortcutsHeading: "Keyboard shortcut",
    shortcutsHelp:
      "Chrome manages extension shortcuts. Open the shortcut page, find Accessible Date Picker, and choose a key combination. Alt+Shift+D is the default.",
    openShortcuts: "Open Chrome keyboard shortcuts",
    shortcutPageError:
      "Chrome did not open the shortcut page. Open chrome://extensions/shortcuts in a new tab.",
    yearHeading: "Date range",
    earliestYear: "Earliest year",
    futureYears: "Number of future years",
    saveYearRange: "Save year range",
    yearRangeSaved: "Year range saved.",
    yearRangeSaveFailed: "The year range could not be saved.",
    yearRangeInvalid: "Enter a year between 1900 and 2100, and a future range between 0 and 200.",
    formatsHeading: "Learned date formats",
    formatsHelp:
      "Accessible Date Picker learns date formats from websites. It never stores a date. Clearing learned formats makes the extension ask less often on repeat visits.",
    forgetFormats: "Forget learned formats",
    formatsForgotten: "Learned formats forgotten.",
    formatsForgetFailed: "Learned formats could not be cleared.",
    privacyHeading: "Privacy",
    privacyText:
      "No network requests. No analytics. No remote code. Entered dates are never stored. Only date format patterns are stored locally.",
    helpHeading: "How to use",
    helpText:
      "Focus a date field on any website and press Alt+Shift+D, or click the Accessible Date Picker toolbar button. Choose Day, Month and Year, then press Enter or Apply.",
    closeHelp: "You can close these options and return to the page.",
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
    notRun: "Not run yet.",
  },
} as const;
