import { describe, expect, it } from "vitest";
import {
  clampDate,
  clampDay,
  compareDates,
  daysInMonth,
  formatUsDate,
  isLeapYear,
  isValidCivilDate,
  monthAbbreviation,
  monthFromName,
  monthName,
  parseIsoDate,
  parseIsoMonth,
  resolveTwoDigitYear,
  sameDate,
  sameYearMonth,
  toIsoDate,
  toIsoMonth,
} from "../../src/shared/date.js";

describe("date math", () => {
  it("knows leap years and month lengths", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 13)).toBe(0);
  });

  it("clamps days and whole dates", () => {
    expect(clampDay(2026, 2, 31)).toBe(28);
    expect(clampDay(2024, 2, 31)).toBe(29);
    expect(clampDate({ year: 2026, month: 2, day: 31 })).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(clampDate({ year: 0, month: 14, day: 0 })).toEqual({
      year: 1,
      month: 12,
      day: 1,
    });
  });

  it("validates civil dates", () => {
    expect(isValidCivilDate({ year: 2026, month: 2, day: 28 })).toBe(true);
    expect(isValidCivilDate({ year: 2026, month: 2, day: 29 })).toBe(false);
    expect(isValidCivilDate({ year: 2026, month: 13, day: 1 })).toBe(false);
  });

  it("compares dates", () => {
    expect(compareDates({ year: 2026, month: 1, day: 2 }, { year: 2026, month: 1, day: 3 })).toBe(
      -1,
    );
    expect(compareDates({ year: 2026, month: 2, day: 1 }, { year: 2026, month: 1, day: 30 })).toBe(
      1,
    );
    expect(sameDate({ year: 2026, month: 3, day: 4 }, { year: 2026, month: 3, day: 4 })).toBe(true);
    expect(sameYearMonth({ year: 2026, month: 3 }, { year: 2026, month: 3 })).toBe(true);
  });

  it("round trips ISO dates and months", () => {
    expect(toIsoDate({ year: 2026, month: 3, day: 4 })).toBe("2026-03-04");
    expect(toIsoMonth({ year: 2026, month: 3 })).toBe("2026-03");
    expect(parseIsoDate("2026-03-04")).toEqual({ year: 2026, month: 3, day: 4 });
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("04/03/2026")).toBeNull();
    expect(parseIsoMonth("2026-03")).toEqual({ year: 2026, month: 3 });
    expect(parseIsoMonth("2026-13")).toBeNull();
  });

  it("handles month names", () => {
    expect(monthName(3)).toBe("March");
    expect(monthAbbreviation(9)).toBe("Sep");
    expect(monthFromName("march")).toBe(3);
    expect(monthFromName("Sept")).toBe(9);
    expect(monthFromName("notamonth")).toBeNull();
    expect(formatUsDate({ year: 2026, month: 3, day: 4 })).toBe("March 4, 2026");
  });

  it("resolves two digit years in the usual way", () => {
    expect(resolveTwoDigitYear(26)).toBe(2026);
    expect(resolveTwoDigitYear(68)).toBe(2068);
    expect(resolveTwoDigitYear(69)).toBe(1969);
    expect(resolveTwoDigitYear(99)).toBe(1999);
  });
});
