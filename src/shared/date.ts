import { MONTH_ABBREVIATIONS, MONTH_NAMES } from "../strings.js";

export interface CivilDate {
  year: number;
  /** 1 through 12. */
  month: number;
  /** 1 through 31. */
  day: number;
}

export interface YearMonth {
  year: number;
  month: number;
}

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 0;
  }
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function isValidCivilDate(value: CivilDate): boolean {
  return (
    Number.isInteger(value.year) &&
    value.year >= 1 &&
    value.year <= 9999 &&
    Number.isInteger(value.month) &&
    value.month >= 1 &&
    value.month <= 12 &&
    Number.isInteger(value.day) &&
    value.day >= 1 &&
    value.day <= daysInMonth(value.year, value.month)
  );
}

export function clampDay(year: number, month: number, day: number): number {
  const maximum = daysInMonth(year, month);
  if (maximum === 0) return 1;
  return Math.min(Math.max(1, Math.trunc(day)), maximum);
}

export function clampDate(value: CivilDate): CivilDate {
  const year = Math.min(Math.max(1, Math.trunc(value.year)), 9999);
  const month = Math.min(Math.max(1, Math.trunc(value.month)), 12);
  const day = clampDay(year, month, value.day);
  return { year, month, day };
}

export function compareDates(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function sameYearMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

export function sameDate(a: CivilDate, b: CivilDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function toIsoDate(value: CivilDate): string {
  return `${pad(value.year, 4)}-${pad(value.month, 2)}-${pad(value.day, 2)}`;
}

export function toIsoMonth(value: YearMonth): string {
  return `${pad(value.year, 4)}-${pad(value.month, 2)}`;
}

export function parseIsoDate(value: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  return isValidCivilDate(date) ? date : null;
}

export function parseIsoMonth(value: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 1 || year > 9999) return null;
  return { year, month };
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

export function monthAbbreviation(month: number): string {
  return MONTH_ABBREVIATIONS[month - 1] ?? "";
}

export function monthFromName(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const full = MONTH_NAMES.findIndex((name) => name.toLowerCase() === normalized);
  if (full >= 0) return full + 1;
  const abbreviated = MONTH_ABBREVIATIONS.findIndex((name) => name.toLowerCase() === normalized);
  if (abbreviated >= 0) return abbreviated + 1;
  // Accept September as Sep, Sept, and similar common forms.
  if (normalized === "sept") return 9;
  return null;
}

export function isMonthName(value: string): boolean {
  return monthFromName(value) !== null;
}

export function resolveTwoDigitYear(value: number): number {
  if (value >= 0 && value <= 68) return 2000 + value;
  return 1900 + value;
}

export function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

export function formatUsDate(date: CivilDate): string {
  return `${monthName(date.month)} ${date.day}, ${date.year}`;
}

export function middleOfElementRect(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}
