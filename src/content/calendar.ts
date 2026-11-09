import { MONTH_ABBREVIATIONS, MONTH_NAMES } from "../strings.js";
import { looseParseDate } from "../shared/formats.js";
import { monthFromName, type CivilDate } from "../shared/date.js";
import { allRoots, hasDisabledAncestor, isControlDisabled, isVisible, shortText } from "./dom.js";

export type CalendarKind = "day" | "month" | "year" | "decade" | "unknown";

export interface CalendarCell {
  element: Element;
  value: number;
  date: CivilDate | null;
  disabled: boolean;
  outside: boolean;
}

export interface DecadeCell {
  element: Element;
  start: number;
  end: number;
  disabled: boolean;
}

export interface CalendarView {
  root: Element;
  kind: CalendarKind;
  year: number | null;
  month: number | null;
  header: Element | null;
  headerText: string;
  prev: Element | null;
  next: Element | null;
  dayCells: CalendarCell[];
  monthCells: CalendarCell[];
  yearCells: CalendarCell[];
  decadeCells: DecadeCell[];
  signature: string;
}

const OUTSIDE_CLASS =
  /(^|\s)(old|new|outside|other-month|othermonth|prev-month|next-month|prevmonday|nextmonday|adjacent|is-outside-month|is-other-month|prevMonthDay|nextMonthDay|datepicker-other-month|otherMonth)(\s|$)/;

const DISABLED_CLASS =
  /(^|\s)(disabled|is-disabled|ui-state-disabled|flatpickr-disabled|pika-disabled)(\s|$)/i;

const CELL_SELECTOR =
  "td,th,button,a,span,div,[role='gridcell'],[data-date],[data-day],[data-month],[data-year]";

const HEADER_SELECTORS = [
  ".datepicker-switch",
  ".ui-datepicker-title",
  ".flatpickr-current-month",
  ".pika-label",
  "[class*='calendar-title' i]",
  "[class*='picker-title' i]",
  "[class*='datepicker-title' i]",
  "[class*='calendar-header' i]",
  "[class*='picker-header' i]",
];

const KNOWN_CONTAINER_HINTS =
  /(datepicker|date-picker|calendar|flatpickr|pika|ui-datepicker|daterangepicker|react-datepicker|date-field|date-field|month-picker|year-picker)/i;

export function isExtensionUi(element: Element): boolean {
  let node: Node | null = element;
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

export function snapshotVisibleElements(): Set<Element> {
  const result = new Set<Element>();
  for (const root of allRoots()) {
    for (const element of root.querySelectorAll("*")) {
      if (isExtensionUi(element)) continue;
      if (isVisible(element)) result.add(element);
    }
  }
  return result;
}

function hintText(element: Element): string {
  const className = typeof element.className === "string" ? element.className : "";
  return `${className} ${element.id} ${element.getAttribute("role") ?? ""} ${
    element.getAttribute("aria-label") ?? ""
  } ${element.getAttribute("class") ?? ""}`;
}

function textMentionsMonth(text: string): number {
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

function textMentionsWeekday(text: string): boolean {
  return /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
    text,
  );
}

function uniqueDayNumbers(text: string): number {
  const seen = new Set<number>();
  for (const match of text.matchAll(/\b(?:[1-9]|[12]\d|3[01])\b/g)) {
    const value = Number(match[0]);
    if (value >= 1 && value <= 31) seen.add(value);
  }
  return seen.size;
}

function countCellLike(root: Element): number {
  return root.querySelectorAll(CELL_SELECTOR).length;
}

function rectDistance(a: Element, b: Element): number {
  const first = a.getBoundingClientRect();
  const second = b.getBoundingClientRect();
  const ax = first.left + first.width / 2;
  const ay = first.top + first.height / 2;
  const bx = second.left + second.width / 2;
  const by = second.top + second.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

function scoreCandidate(
  element: Element,
  field: Element,
  beforeVisible: Set<Element> | null,
): number {
  if (element === field) return 0;
  if (element.matches("html, body, script, style, link, meta, input, select, textarea, option")) {
    return 0;
  }
  if (element === element.ownerDocument.documentElement) return 0;
  if (!isVisible(element)) return 0;

  const text = shortText(element, 25_000);
  if (!text) return 0;
  const hints = hintText(element);
  let score = 0;
  if (KNOWN_CONTAINER_HINTS.test(hints)) score += 32;
  if (element.getAttribute("role") === "grid") score += 12;
  if (element.getAttribute("role") === "dialog") score += 10;
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
  if (text.length > 25_000) score -= 25;

  const hasDateSignal = months > 0 || textMentionsWeekday(text) || uniqueDayNumbers(text) >= 8;
  if (!hasDateSignal && !KNOWN_CONTAINER_HINTS.test(hints)) score -= 20;
  if (score < 34) return 0;
  if (element.getBoundingClientRect().width < 40) return 0;
  return score;
}

interface Candidate {
  element: Element;
  score: number;
  depth: number;
}

function elementDepth(element: Element): number {
  let depth = 0;
  let current: Element | null = element;
  while (current) {
    depth += 1;
    current = current.parentElement;
  }
  return depth;
}

export function findCalendarCandidate(
  field: Element,
  beforeVisible: Set<Element> | null = null,
): Element | null {
  const candidates: Candidate[] = [];
  let inspected = 0;
  for (const root of allRoots()) {
    for (const element of root.querySelectorAll("*")) {
      inspected += 1;
      if (inspected > 20_000) break;
      if (isExtensionUi(element)) continue;
      const hints = hintText(element);
      const stronglyContainer =
        KNOWN_CONTAINER_HINTS.test(hints) ||
        element.matches("table, [role='grid'], [role='dialog']") ||
        element.querySelector("td, [role='gridcell'], [data-date], [data-day]") !== null;
      if (!stronglyContainer) continue;
      const score = scoreCandidate(element, field, beforeVisible);
      if (score > 0) {
        candidates.push({ element, score, depth: elementDepth(element) });
      }
    }
    if (inspected > 20_000) break;
  }
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.depth - b.depth;
  });
  return candidates[0]?.element ?? null;
}

function visibleWithin(root: Element, selector: string): Element[] {
  return [...root.querySelectorAll(selector)].filter(
    (element) => !isExtensionUi(element) && isVisible(element),
  );
}

function deepestUnique(elements: Element[]): Element[] {
  const set = new Set(elements);
  return elements.filter((element) => {
    for (const other of set) {
      if (other !== element && element.contains(other)) return false;
    }
    return true;
  });
}

function cellClassText(element: Element): string {
  const className = typeof element.className === "string" ? element.className : "";
  return className;
}

function isOutside(element: Element, root: Element): boolean {
  let current: Element | null = element;
  let guard = 0;
  while (current && guard < 4) {
    guard += 1;
    if (OUTSIDE_CLASS.test(cellClassText(current))) return true;
    if (current === root) break;
    current = current.parentElement;
  }
  return false;
}

function isCellDisabled(element: Element, root: Element): boolean {
  return (
    isControlDisabled(element) ||
    DISABLED_CLASS.test(cellClassText(element)) ||
    element.getAttribute("data-disabled") === "true" ||
    hasDisabledAncestor(element, root)
  );
}

function cellDate(element: Element): CivilDate | null {
  const candidates = [
    element.getAttribute("data-date"),
    element.getAttribute("data-day"),
    element.getAttribute("data-value"),
    element.getAttribute("value"),
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("datetime"),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const parsed = looseParseDate(candidate);
    if (parsed?.valid && parsed.day !== null) {
      return { year: parsed.year, month: parsed.month, day: parsed.day };
    }
  }
  return null;
}

function isPartOf(element: Element, container: Element | null): boolean {
  if (!container) return false;
  return element === container || container.contains(element) || element.contains(container);
}

function cellIsExcluded(
  element: Element,
  header: Element | null,
  prev: Element | null,
  next: Element | null,
): boolean {
  return isPartOf(element, header) || isPartOf(element, prev) || isPartOf(element, next);
}

function collectDayCells(
  root: Element,
  header: Element | null,
  prev: Element | null,
  next: Element | null,
): CalendarCell[] {
  const raw: Element[] = [];
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
  const cells: CalendarCell[] = [];
  for (const element of elements) {
    if (isOutside(element, root)) continue;
    cells.push({
      element,
      value: Number(shortText(element, 12)),
      date: cellDate(element),
      disabled: isCellDisabled(element, root),
      outside: false,
    });
  }
  return cells;
}

function collectNamedCells(
  root: Element,
  header: Element | null,
  prev: Element | null,
  next: Element | null,
  type: "month" | "year",
): CalendarCell[] {
  const raw: Element[] = [];
  for (const element of visibleWithin(root, CELL_SELECTOR)) {
    if (cellIsExcluded(element, header, prev, next)) continue;
    const text = shortText(element, 30).replace(/\.$/, "");
    let value: number | null = null;
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
  const seen = new Set<number>();
  const cells: CalendarCell[] = [];
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
      outside: false,
    });
  }
  return cells;
}

function collectDecadeCells(root: Element): DecadeCell[] {
  const cells: DecadeCell[] = [];
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
      disabled: isCellDisabled(element, root),
    });
  }
  return deepestUnique(cells.map((cell) => cell.element)).map((element) => {
    const text = shortText(element, 30);
    const match = /^(\d{4})\s*[-–—]\s*(\d{4})$/.exec(text);
    return {
      element,
      start: Number(match?.[1] ?? 0),
      end: Number(match?.[2] ?? 0),
      disabled: isCellDisabled(element, root),
    };
  });
}

function findHeaderControl(root: Element): Element | null {
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

function parseHeaderText(text: string): {
  year: number | null;
  month: number | null;
  range: [number, number] | null;
} {
  const rangeMatch = /(\d{4})\s*[-–—]\s*(\d{4})/.exec(text);
  const range: [number, number] | null = rangeMatch
    ? [Number(rangeMatch[1]), Number(rangeMatch[2])]
    : null;
  const monthMatch = new RegExp(
    `(${[...MONTH_NAMES, ...MONTH_ABBREVIATIONS, "Sept"].join("|")})\\.?`,
    "i",
  ).exec(text);
  const month = monthMatch?.[1] ? monthFromName(monthMatch[1]) : null;
  const withoutMonth = monthMatch
    ? `${text.slice(0, monthMatch.index)} ${text.slice(monthMatch.index + monthMatch[0].length)}`
    : text;
  const yearMatch = /\b(\d{4})\b/.exec(withoutMonth);
  return {
    year: yearMatch ? Number(yearMatch[1]) : (range?.[0] ?? null),
    month,
    range,
  };
}

function headerTextForView(root: Element, header: Element | null): string {
  const pieces: string[] = [];
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
    pieces.push(shortText(root, 1000));
  }
  return pieces.join(" ");
}

function selectedControlTexts(root: Element): { month: number | null; year: number | null } {
  let month: number | null = null;
  let year: number | null = null;
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

function findNav(root: Element, direction: "prev" | "next"): Element | null {
  const candidates: { element: Element; score: number; depth: number }[] = [];
  for (const element of visibleWithin(root, "button,a,[role='button'],span,div,td,th")) {
    if (element.matches("input, select")) continue;
    const text = shortText(element, 30);
    const hints = `${hintText(element)} ${element.getAttribute("title") ?? ""} ${text}`;
    let score = 0;
    if (direction === "prev") {
      if (/ui-datepicker-prev|flatpickr-prev-month|pika-prev|(^|\s)prev(\s|$)/i.test(hints)) {
        score += 50;
      }
      if (/\b(prev|previous|back|earlier)\b/i.test(hints)) score += 35;
      if (/^[«‹<←◀]$/.test(text)) score += 30;
    } else {
      if (/ui-datepicker-next|flatpickr-next-month|pika-next|(^|\s)next(\s|$)/i.test(hints)) {
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

export function analyzeCalendar(root: Element): CalendarView | null {
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
  let kind: CalendarKind = "unknown";
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
      // The header and cell metadata agree. Keep scanning only for validation.
    }
    const dated = dayCells.find((cell) => cell.date !== null)?.date;
    if (dated) {
      const mismatch = dayCells.some(
        (cell) =>
          cell.date !== null &&
          (cell.date.year !== year || cell.date.month !== month) &&
          cell.element.getAttribute("data-date"),
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
    [...uniqueMonths].sort((a, b) => a - b).join(","),
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
    signature,
  };
}

function optionYears(root: Element): number | null {
  for (const select of visibleWithin(root, "select")) {
    if (!(select instanceof HTMLSelectElement)) continue;
    const years = [...select.options]
      .map((option) => option.textContent.trim())
      .filter((text) => /^\d{4}$/.test(text))
      .map(Number);
    if (years.length) return Math.min(...years);
  }
  return null;
}

export function findMonthSelect(root: Element): HTMLSelectElement | null {
  for (const select of visibleWithin(root, "select")) {
    if (!(select instanceof HTMLSelectElement) || select.disabled) continue;
    const monthOptions = [...select.options].filter(
      (option) => monthFromName(option.textContent.trim()) !== null,
    );
    if (monthOptions.length >= 8) return select;
  }
  return null;
}

export function findYearSelect(root: Element): HTMLSelectElement | null {
  for (const select of visibleWithin(root, "select")) {
    if (!(select instanceof HTMLSelectElement) || select.disabled) continue;
    const yearOptions = [...select.options].filter((option) =>
      /^\d{4}$/.test(option.textContent.trim()),
    );
    if (yearOptions.length >= 2) return select;
  }
  return null;
}

export function findYearInput(root: Element): HTMLInputElement | null {
  const inputs = visibleWithin(root, "input").filter(
    (element): element is HTMLInputElement => element instanceof HTMLInputElement,
  );
  const preferred = inputs.find((input) => {
    const className = typeof input.className === "string" ? input.className : "";
    return /year|cur-year|numInput/i.test(`${className} ${input.name} ${input.id}`);
  });
  if (preferred && !preferred.disabled) return preferred;
  return inputs.find((input) => /^\d{4}$/.test(input.value) && !input.disabled) ?? null;
}

export function findYearOption(select: HTMLSelectElement, year: number): HTMLOptionElement | null {
  return [...select.options].find((option) => option.textContent.trim() === String(year)) ?? null;
}

export function findMonthOption(
  select: HTMLSelectElement,
  month: number,
): HTMLOptionElement | null {
  return (
    [...select.options].find((option) => monthFromName(option.textContent.trim()) === month) ?? null
  );
}
