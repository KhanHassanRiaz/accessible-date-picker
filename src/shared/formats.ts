import {
  clampDay,
  isValidCivilDate,
  monthAbbreviation,
  monthFromName,
  monthName,
  pad,
  resolveTwoDigitYear,
} from "./date.js";
import { MONTH_ABBREVIATIONS, MONTH_NAMES } from "../strings.js";

export type DateLibrary =
  "jquery-ui" | "bootstrap-datepicker" | "flatpickr" | "pikaday" | "unknown";

export interface FormatDetectionClues {
  learned?: string | null;
  value?: string | null;
  placeholder?: string | null;
  attributes?: readonly string[];
  labelTexts?: readonly string[];
  library?: { name: DateLibrary; format?: string | null } | null;
  otherFieldValues?: readonly string[];
}

export interface FormatDetection {
  pattern: string | null;
  source: string;
  ambiguous: boolean;
  sawHint: boolean;
}

export interface ParsedDateParts {
  year: number;
  month: number;
  day: number | null;
  valid: boolean;
}

export interface LooseParse extends ParsedDateParts {
  ambiguous: boolean;
}

interface PatternToken {
  kind:
    | "day"
    | "dayPadded"
    | "month"
    | "monthPadded"
    | "monthShort"
    | "monthLong"
    | "yearTwo"
    | "yearFour";
  text: string;
}

const GENERIC_PATTERN = /(?<![A-Za-z])([dDmMyY]{1,4}(?:[/.\- ,]+[dDmMyY]{1,4})+)(?![A-Za-z])/;

function tokenizePattern(pattern: string): PatternToken[] | null {
  const pieces: PatternToken[] = [];
  let index = 0;
  while (index < pattern.length) {
    const character = pattern[index];
    if (character === undefined) return null;
    if (/[/.\- ,]/.test(character)) {
      pieces.push({ kind: "month", text: character });
      index += 1;
      continue;
    }
    const match = /^[dmy]+/.exec(pattern.slice(index));
    if (!match) return null;
    const tokenText = match[0];
    const normalized = tokenText.toLowerCase();
    let kind: PatternToken["kind"];
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

interface CanonicalToken {
  kind: PatternToken["kind"] | "separator";
  text: string;
}

export function canonicalPattern(pattern: string): CanonicalToken[] | null {
  const tokens = tokenizePattern(pattern.trim());
  if (!tokens) return null;
  return tokens.map((token) => {
    if (/^[/.\- ,]$/.test(token.text)) {
      return { kind: "separator" as const, text: token.text === " " ? " " : token.text };
    }
    return { kind: token.kind, text: token.text };
  });
}

function convertGenericTokens(raw: string): string | null {
  const output: string[] = [];
  let index = 0;
  while (index < raw.length) {
    const character = raw[index];
    if (character === undefined) return null;
    if (/[/.\- ,]/.test(character)) {
      output.push(character === " " ? " " : character);
      index += 1;
      continue;
    }
    const match = /^[dDmMyY]+/.exec(raw.slice(index));
    if (!match) return null;
    const token = match[0];
    const lower = token.toLowerCase();
    let canonical: string;
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

function convertLibraryTokens(raw: string, library: DateLibrary): string | null {
  const output: string[] = [];
  let index = 0;
  const source = raw.trim();
  while (index < source.length) {
    const character = source[index];
    if (character === undefined) return null;
    if (/[/.\- ,]/.test(character)) {
      output.push(character === " " ? " " : character);
      index += 1;
      continue;
    }
    const match = /^[A-Za-z]+/.exec(source.slice(index));
    if (!match) return null;
    const token = match[0];
    let canonical: string | null = null;

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

function isValidPattern(pattern: string): boolean {
  if (!pattern.trim()) return false;
  if (!pattern.includes("y") || !/[mM]/.test(pattern)) return false;
  const tokens = canonicalPattern(pattern);
  if (!tokens) return false;
  const kinds = tokens.filter((token) => token.kind !== "separator").map((token) => token.kind);
  const hasYear = kinds.includes("yearTwo") || kinds.includes("yearFour");
  const hasMonth =
    kinds.includes("month") ||
    kinds.includes("monthPadded") ||
    kinds.includes("monthShort") ||
    kinds.includes("monthLong");
  return hasYear && hasMonth;
}

export function normalizeGenericFormat(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = GENERIC_PATTERN.exec(raw);
  if (!match?.[1]) return null;
  return convertGenericTokens(match[1]);
}

export function normalizeLibraryFormat(
  raw: string | null | undefined,
  library: DateLibrary,
): string | null {
  if (!raw) return null;
  return convertLibraryTokens(raw, library);
}

export function patternHasDay(pattern: string): boolean {
  return /d/i.test(pattern);
}

function tokenRegex(kind: PatternToken["kind"]): string {
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

export function parseWithFormat(value: string, pattern: string): ParsedDateParts | null {
  const tokens = canonicalPattern(pattern);
  if (!tokens) return null;
  let source = "^";
  const kinds: PatternToken["kind"][] = [];
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

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  let captureIndex = 1;
  for (const kind of kinds) {
    const raw = match[captureIndex] ?? "";
    captureIndex += 1;
    if (kind === "day" || kind === "dayPadded") {
      day = Number(raw);
    } else if (
      kind === "month" ||
      kind === "monthPadded" ||
      kind === "monthShort" ||
      kind === "monthLong"
    ) {
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
      valid: month >= 1 && month <= 12 && year >= 1 && year <= 9999,
    };
  }
  const candidate = { year, month, day };
  return {
    ...candidate,
    valid: isValidCivilDate(candidate),
  };
}

export function formatWithPattern(
  date: { year: number; month: number; day: number },
  pattern: string,
): string | null {
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

interface NumericPart {
  text: string;
  value: number;
  isYearFour: boolean;
}

function splitValue(value: string): { parts: string[]; separators: string[] } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const matches = trimmed.split(/([/.\- ,]+)/);
  const parts = matches.filter((_, index) => index % 2 === 0);
  const separators = matches.filter((_, index) => index % 2 === 1);
  if (!parts.length || separators.length !== parts.length - 1) return null;
  if (parts.some((part) => part.length === 0)) return null;
  return {
    parts,
    separators: separators.map((separator) => (separator.trim() ? separator : " ")),
  };
}

function classifyPart(text: string): "monthName" | "yearFour" | "numeric" | null {
  if (monthFromName(text)) return "monthName";
  if (/^\d{4}$/.test(text)) return "yearFour";
  if (/^\d{1,2}$/.test(text)) return "numeric";
  return null;
}

export interface ValueFormatInference {
  pattern: string | null;
  ambiguous: boolean;
  sawHint: boolean;
  reason: string;
}

/**
 * Infers a write format from a displayed value. If day and month cannot be
 * distinguished, pattern stays null. That is intentional: guessing is unsafe.
 */
export function inferFormatFromValue(value: string): ValueFormatInference {
  const split = splitValue(value);
  if (!split) return { pattern: null, ambiguous: false, sawHint: false, reason: "empty" };
  const kinds = split.parts.map(classifyPart);
  if (kinds.some((kind) => kind === null)) {
    return { pattern: null, ambiguous: false, sawHint: true, reason: "unrecognized value" };
  }

  const monthNameIndex = kinds.indexOf("monthName");
  if (monthNameIndex >= 0) {
    const numeric: { index: number; part: NumericPart }[] = [];
    let year: number | null = null;
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
      // A month name with a two digit year is also possible.
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
        reason: "month name without a clear year",
      };
    }
    const dayEntry = numeric[0];
    if (!dayEntry) {
      return { pattern: null, ambiguous: false, sawHint: true, reason: "month and year only" };
    }
    const patternParts = split.parts.map((part, index) => {
      if (index === monthNameIndex) {
        return monthAbbreviation(monthFromName(part) ?? 1).toLowerCase() === part.toLowerCase()
          ? "mmm"
          : "mmmm";
      }
      if (index === yearIndex) return "yyyy";
      return part.length === 2 ? "dd" : "d";
    });
    return {
      pattern: combinePattern(patternParts, split.separators),
      ambiguous: false,
      sawHint: true,
      reason: "month name",
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
        reason: "year and month only",
      };
    }
    if (split.parts.length !== 3) {
      return { pattern: null, ambiguous: true, sawHint: true, reason: "unusual part count" };
    }
    if (yearFourIndex === 0) {
      const patternParts = [
        "yyyy",
        split.parts[1]?.length === 2 ? "mm" : "m",
        split.parts[2]?.length === 2 ? "dd" : "d",
      ];
      return {
        pattern: combinePattern(patternParts, split.separators),
        ambiguous: false,
        sawHint: true,
        reason: "year first",
      };
    }
    if (yearFourIndex === 2) {
      const first = Number(split.parts[0]);
      const second = Number(split.parts[1]);
      if (first > 12 && second <= 12) {
        const patternParts = [
          split.parts[0]?.length === 2 ? "dd" : "d",
          split.parts[1]?.length === 2 ? "mm" : "m",
          "yyyy",
        ];
        return {
          pattern: combinePattern(patternParts, split.separators),
          ambiguous: false,
          sawHint: true,
          reason: "day first by value",
        };
      }
      if (second > 12 && first <= 12) {
        const patternParts = [
          split.parts[0]?.length === 2 ? "mm" : "m",
          split.parts[1]?.length === 2 ? "dd" : "d",
          "yyyy",
        ];
        return {
          pattern: combinePattern(patternParts, split.separators),
          ambiguous: false,
          sawHint: true,
          reason: "month first by value",
        };
      }
      return {
        pattern: null,
        ambiguous: true,
        sawHint: true,
        reason: "day and month both 12 or less",
      };
    }
    return {
      pattern: null,
      ambiguous: true,
      sawHint: true,
      reason: "year in an unexpected position",
    };
  }

  // No four-digit year. Three numeric parts with a plausible two-digit year.
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
            "yy",
          ],
          split.separators,
        ),
        ambiguous: false,
        sawHint: true,
        reason: "day first by value",
      };
    }
    if (second > 12 && first <= 12) {
      return {
        pattern: combinePattern(
          [
            split.parts[0]?.length === 2 ? "mm" : "m",
            split.parts[1]?.length === 2 ? "dd" : "d",
            "yy",
          ],
          split.separators,
        ),
        ambiguous: false,
        sawHint: true,
        reason: "month first by value",
      };
    }
    return {
      pattern: null,
      ambiguous: true,
      sawHint: true,
      reason: "two digit year with ambiguous day and month",
    };
  }
  return { pattern: null, ambiguous: true, sawHint: true, reason: "no four digit year" };
}

function combinePattern(parts: string[], separators: string[]): string | null {
  if (parts.length === 0 || separators.length !== parts.length - 1) return null;
  let output = "";
  for (let index = 0; index < parts.length; index += 1) {
    output += parts[index] ?? "";
    if (index < separators.length) output += separators[index] ?? " ";
  }
  return isValidPattern(output) ? output : null;
}

export function detectDateFormat(clues: FormatDetectionClues): FormatDetection {
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
        sawHint: true,
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
        sawHint: true,
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
        sawHint: true,
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
        sawHint: true,
      };
    }
    ambiguous ||= inference.ambiguous;
    sawHint ||= inference.sawHint;
  }

  return {
    pattern: null,
    source: "no usable format clue",
    ambiguous,
    sawHint,
  };
}

export function deriveLearnedPattern(value: string): string | null {
  const direct = inferFormatFromValue(value);
  if (direct.pattern) return direct.pattern;
  return null;
}

export function derivePatternFromResult(
  value: string,
  result: { year: number; month: number; day: number },
): string | null {
  const split = splitValue(value);
  if (!split) return null;
  const patternParts: string[] = [];
  let hasYear = false;
  let hasMonth = false;
  let daySeen = false;
  const usedRoles = new Set<"day" | "month" | "year">();

  for (const part of split.parts) {
    if (monthFromName(part)) {
      if (usedRoles.has("month")) return null;
      const month = monthFromName(part) ?? 0;
      const isShort =
        monthAbbreviation(month).toLowerCase() === part.toLowerCase() ||
        (month === 5 && part.toLowerCase() === "may");
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
    if (
      part.length === 2 &&
      Number(part) === result.year % 100 &&
      !usedRoles.has("year") &&
      !usedRoles.has("day") &&
      !usedRoles.has("month") &&
      !hasYear
    ) {
      // A two digit year is only safe to recognize when no day/month value matches it.
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
    // Month and year only field. That is valid.
  }
  const pattern = combinePattern(patternParts, split.separators);
  if (!pattern) return null;
  const parsed = parseWithFormat(value, pattern);
  if (!parsed?.valid) return null;
  if (parsed.year !== result.year || parsed.month !== result.month) return null;
  if (parsed.day !== null && result.day !== parsed.day) {
    // The site may fix the day in a month and year picker. The pattern is still usable.
    return pattern;
  }
  return pattern;
}

export function looseParseDate(value: string): LooseParse | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const monthNameInValue = findMonthName(trimmed);
  if (monthNameInValue) {
    const withoutMonth = `${trimmed.slice(0, monthNameInValue.index)} ${trimmed.slice(
      monthNameInValue.index + monthNameInValue.text.length,
    )}`;
    const numbers = [...withoutMonth.matchAll(/\d{1,4}/g)].map((match) => ({
      text: match[0],
      value: Number(match[0]),
    }));
    const fourDigit = numbers.find((entry) => entry.text.length === 4);
    let year: number | null = fourDigit?.value ?? null;
    let day: number | null = null;
    if (year === null) {
      const twoDigit = numbers.find((entry) => entry.text.length === 2);
      if (twoDigit) {
        year = resolveTwoDigitYear(twoDigit.value);
      }
    }
    for (const number of numbers) {
      if (number === fourDigit) continue;
      if (
        year !== null &&
        number.value === year % 100 &&
        number.text.length === 2 &&
        day === null
      ) {
        continue;
      }
      day ??= number.value;
    }
    if (year === null) return null;
    const month = monthNameInValue.month;
    const valid =
      month >= 1 &&
      month <= 12 &&
      year >= 1 &&
      (day === null || (day >= 1 && day <= clampDay(year, month, 31)));
    return { year, month, day, valid, ambiguous: false };
  }

  const numeric = /^(\d{1,4})([/.\- ,])(\d{1,2})(?:\2(\d{1,4}))?$/.exec(trimmed);
  if (!numeric) {
    // Allow mixed separators and three components, such as 2021-11-01.
    const parts = splitValue(trimmed);
    if (!parts) return null;
    if (parts.parts.some((part) => !/^\d{1,4}$/.test(part))) return null;
    return parseNumericLoose(parts.parts);
  }
  const parts = [numeric[1] ?? "", numeric[3] ?? ""];
  if (numeric[4]) parts.push(numeric[4]);
  const split = splitValue(trimmed);
  return split ? parseNumericLoose(split.parts) : null;
}

function parseNumericLoose(parts: string[]): LooseParse | null {
  if (parts.length === 2) {
    const yearPart = parts.find((part) => part.length === 4);
    if (!yearPart) return null;
    const year = Number(yearPart);
    const monthPart = parts.find((part) => part !== yearPart) ?? "";
    const month = Number(monthPart);
    if (month < 1 || month > 12) return null;
    return { year, month, day: null, valid: year >= 1, ambiguous: false };
  }
  if (parts.length !== 3) return null;
  if (parts.some((part) => !/^\d{1,4}$/.test(part))) return null;
  const numericParts = parts.map((part) => ({ text: part, value: Number(part) }));
  const yearFourIndex = numericParts.findIndex((part) => part.text.length === 4);
  let year: number;
  let dayPart: { text: string; value: number };
  let monthPart: { text: string; value: number };
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
    ambiguous,
  };
}

function findMonthName(value: string): { index: number; text: string; month: number } | null {
  const lower = value.toLowerCase();
  const candidates: { name: string; month: number }[] = [
    ...MONTH_NAMES.map((name, index) => ({ name: name.toLowerCase(), month: index + 1 })),
    ...MONTH_ABBREVIATIONS.map((name, index) => ({ name: name.toLowerCase(), month: index + 1 })),
    { name: "sept", month: 9 },
  ].sort((a, b) => b.name.length - a.name.length);
  for (const candidate of candidates) {
    const index = lower.indexOf(candidate.name);
    if (index >= 0) {
      return {
        index,
        text: value.slice(index, index + candidate.name.length),
        month: candidate.month,
      };
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatHintFromAttributes(element: Element): string[] {
  const names = [
    "data-date-format",
    "data-format",
    "data-datepicker-format",
    "data-input-format",
    "data-fp-format",
    "data-format-date",
    "data-datepattern",
    "data-pattern",
    "format",
  ];
  const values: string[] = [];
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value) values.push(value);
  }
  return values;
}
