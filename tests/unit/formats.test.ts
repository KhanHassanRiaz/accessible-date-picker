import { describe, expect, it } from "vitest";
import {
  canonicalPattern,
  detectDateFormat,
  deriveLearnedPattern,
  derivePatternFromResult,
  formatHintFromAttributes,
  formatWithPattern,
  inferFormatFromValue,
  looseParseDate,
  normalizeGenericFormat,
  normalizeLibraryFormat,
  parseWithFormat,
  patternHasDay,
} from "../../src/shared/formats.js";

describe("generic format normalization", () => {
  it("accepts day, month and year patterns with separators", () => {
    expect(normalizeGenericFormat("dd/mm/yyyy")).toBe("dd/mm/yyyy");
    expect(normalizeGenericFormat("MM/DD/YYYY")).toBe("mm/dd/yyyy");
    expect(normalizeGenericFormat("yyyy-mm-dd")).toBe("yyyy-mm-dd");
    expect(normalizeGenericFormat("d.m.yyyy")).toBe("d.m.yyyy");
    expect(normalizeGenericFormat("dd MMM yyyy")).toBe("dd mmm yyyy");
    expect(normalizeGenericFormat("MMMM d, yyyy")).toBe("mmmm d, yyyy");
    expect(normalizeGenericFormat("mm/yyyy")).toBe("mm/yyyy");
  });

  it("rejects patterns without a year or a month", () => {
    expect(normalizeGenericFormat("dd/mm")).toBeNull();
    expect(normalizeGenericFormat("yyyy")).toBeNull();
    expect(normalizeGenericFormat("not a date")).toBeNull();
    expect(normalizeGenericFormat("")).toBeNull();
    expect(normalizeGenericFormat(null)).toBeNull();
  });

  it("tokenizes canonical patterns", () => {
    expect(canonicalPattern("dd/mm/yyyy")?.map((token) => token.kind)).toEqual([
      "dayPadded",
      "separator",
      "monthPadded",
      "separator",
      "yearFour",
    ]);
    expect(canonicalPattern("nonsense")).toBeNull();
  });
});

describe("library format normalization", () => {
  it("maps jQuery UI tokens", () => {
    expect(normalizeLibraryFormat("mm/dd/yy", "jquery-ui")).toBe("mm/dd/yyyy");
    expect(normalizeLibraryFormat("d M yy", "jquery-ui")).toBe("d mmm yyyy");
    expect(normalizeLibraryFormat("DD, MM d, y", "jquery-ui")).toBeNull();
  });

  it("maps bootstrap-datepicker tokens", () => {
    expect(normalizeLibraryFormat("dd/mm/yyyy", "bootstrap-datepicker")).toBe("dd/mm/yyyy");
    expect(normalizeLibraryFormat("M d, yyyy", "bootstrap-datepicker")).toBe("mmm d, yyyy");
    expect(normalizeLibraryFormat("yyyy-mm", "bootstrap-datepicker")).toBe("yyyy-mm");
  });

  it("maps flatpickr tokens, including j, n, Y and F", () => {
    expect(normalizeLibraryFormat("Y-m-d", "flatpickr")).toBe("yyyy-mm-dd");
    expect(normalizeLibraryFormat("d/m/Y", "flatpickr")).toBe("dd/mm/yyyy");
    expect(normalizeLibraryFormat("F j, Y", "flatpickr")).toBe("mmmm d, yyyy");
    expect(normalizeLibraryFormat("l, F d, Y", "flatpickr")).toBeNull();
  });

  it("maps Pikaday tokens", () => {
    expect(normalizeLibraryFormat("DD/MM/YYYY", "pikaday")).toBe("dd/mm/yyyy");
    expect(normalizeLibraryFormat("D MMM YYYY", "pikaday")).toBe("d mmm yyyy");
    expect(normalizeLibraryFormat("YYYY-MM", "pikaday")).toBe("yyyy-mm");
  });
});

describe("formatting and parsing with a pattern", () => {
  const date = { year: 2026, month: 3, day: 4 };

  it("round trips common patterns", () => {
    for (const pattern of [
      "dd/mm/yyyy",
      "mm/dd/yyyy",
      "yyyy-mm-dd",
      "d.m.yy",
      "dd mmm yyyy",
      "mmmm d, yyyy",
    ]) {
      const formatted = formatWithPattern(date, pattern);
      expect(formatted, pattern).not.toBeNull();
      const parsed = parseWithFormat(formatted ?? "", pattern);
      expect(parsed?.valid, pattern).toBe(true);
      expect(parsed?.year, pattern).toBe(2026);
      expect(parsed?.month, pattern).toBe(3);
      expect(parsed?.day, pattern).toBe(4);
    }
  });

  it("parses padded and unpadded numbers", () => {
    expect(parseWithFormat("4/3/2026", "dd/mm/yyyy")).toEqual({
      year: 2026,
      month: 3,
      day: 4,
      valid: true,
    });
    expect(parseWithFormat("04/03/26", "dd/mm/yy")).toEqual({
      year: 2026,
      month: 3,
      day: 4,
      valid: true,
    });
  });

  it("parses month and year only", () => {
    expect(parseWithFormat("03/2026", "mm/yyyy")).toEqual({
      year: 2026,
      month: 3,
      day: null,
      valid: true,
    });
  });

  it("rejects impossible dates and mismatched shapes", () => {
    expect(parseWithFormat("31/02/2026", "dd/mm/yyyy")?.valid).toBe(false);
    expect(parseWithFormat("2026-03", "dd/mm/yyyy")).toBeNull();
    expect(parseWithFormat("not a date", "dd/mm/yyyy")).toBeNull();
    expect(parseWithFormat("", "dd/mm/yyyy")).toBeNull();
  });

  it("reports whether a pattern has a day", () => {
    expect(patternHasDay("dd/mm/yyyy")).toBe(true);
    expect(patternHasDay("mm/yyyy")).toBe(false);
  });
});

describe("inferring a format from a displayed value", () => {
  it("recognizes year first because four digits are unambiguous", () => {
    expect(inferFormatFromValue("2026-03-04")).toMatchObject({
      pattern: "yyyy-mm-dd",
      ambiguous: false,
      sawHint: true,
    });
    expect(inferFormatFromValue("2026/3/4")).toMatchObject({
      pattern: "yyyy/m/d",
      ambiguous: false,
    });
  });

  it("uses day or month greater than twelve to resolve order", () => {
    expect(inferFormatFromValue("04/13/2026")).toMatchObject({
      pattern: "mm/dd/yyyy",
      ambiguous: false,
    });
    expect(inferFormatFromValue("13/04/2026")).toMatchObject({
      pattern: "dd/mm/yyyy",
      ambiguous: false,
    });
  });

  it("refuses to guess when day and month are both at most twelve", () => {
    expect(inferFormatFromValue("03/04/2026")).toMatchObject({
      pattern: null,
      ambiguous: true,
      sawHint: true,
    });
    expect(inferFormatFromValue("03.04.26")).toMatchObject({
      pattern: null,
      ambiguous: true,
    });
  });

  it("recognizes month names and month and year values", () => {
    expect(inferFormatFromValue("4 March 2026")).toMatchObject({
      pattern: "d mmmm yyyy",
      ambiguous: false,
    });
    expect(inferFormatFromValue("March 4, 2026")).toMatchObject({
      pattern: "mmmm d, yyyy",
      ambiguous: false,
    });
    expect(inferFormatFromValue("Mar 2026")).toMatchObject({
      pattern: null,
      ambiguous: false,
      reason: "month and year only",
    });
    expect(inferFormatFromValue("03/2026")).toMatchObject({
      pattern: "mm/yyyy",
      ambiguous: false,
    });
  });

  it("reports empty and unrecognized values without guessing", () => {
    expect(inferFormatFromValue("")).toMatchObject({
      pattern: null,
      ambiguous: false,
      reason: "empty",
    });
    expect(inferFormatFromValue("today")).toMatchObject({
      pattern: null,
      ambiguous: false,
      sawHint: true,
    });
  });
});

describe("format detection precedence", () => {
  it("prefers a learned format", () => {
    const result = detectDateFormat({
      learned: "dd/mm/yyyy",
      value: "2026-03-04",
      placeholder: "mm/dd/yyyy",
    });
    expect(result.pattern).toBe("dd/mm/yyyy");
    expect(result.source).toBe("learned format");
  });

  it("uses an unambiguous current value before a placeholder", () => {
    const result = detectDateFormat({
      value: "2026-03-04",
      placeholder: "mm/dd/yyyy",
    });
    expect(result.pattern).toBe("yyyy-mm-dd");
    expect(result.source).toContain("current value");
  });

  it("falls back to placeholder, attributes, labels and library configuration", () => {
    expect(detectDateFormat({ placeholder: "dd/mm/yyyy" }).source).toBe("placeholder");
    expect(detectDateFormat({ attributes: ["dd/mm/yyyy"] }).source).toBe("data attribute");
    expect(detectDateFormat({ labelTexts: ["Date (mm/dd/yyyy)"] }).source).toBe(
      "label or accessibility text",
    );
    expect(detectDateFormat({ library: { name: "flatpickr", format: "Y-m-d" } }).source).toContain(
      "library configuration",
    );
  });

  it("uses another date field only when that value is unambiguous", () => {
    const unambiguous = detectDateFormat({ otherFieldValues: ["13/04/2026"] });
    expect(unambiguous.pattern).toBe("dd/mm/yyyy");
    const ambiguous = detectDateFormat({ otherFieldValues: ["03/04/2026"] });
    expect(ambiguous.pattern).toBeNull();
    expect(ambiguous.ambiguous).toBe(true);
  });

  it("reports ambiguity rather than choosing", () => {
    const result = detectDateFormat({ value: "03/04/2026" });
    expect(result.pattern).toBeNull();
    expect(result.ambiguous).toBe(true);
    expect(result.sawHint).toBe(true);
    expect(result.source).toBe("no usable format clue");
  });

  it("collects format hint attributes", () => {
    const element = document.createElement("input");
    element.setAttribute("data-date-format", "dd/mm/yyyy");
    element.setAttribute("data-format", "yyyy-mm-dd");
    element.setAttribute("data-datepattern", "mm/dd/yyyy");
    expect(formatHintFromAttributes(element)).toEqual(["dd/mm/yyyy", "yyyy-mm-dd", "mm/dd/yyyy"]);
  });
});

describe("deriving learned patterns", () => {
  it("learns only from an unambiguous value", () => {
    expect(deriveLearnedPattern("13/04/2026")).toBe("dd/mm/yyyy");
    expect(deriveLearnedPattern("03/04/2026")).toBeNull();
  });

  it("derives a pattern from the value a site produced", () => {
    expect(derivePatternFromResult("2026-03-04", { year: 2026, month: 3, day: 4 })).toBe(
      "yyyy-mm-dd",
    );
    expect(derivePatternFromResult("04/03/2026", { year: 2026, month: 3, day: 4 })).toBe(
      "dd/mm/yyyy",
    );
    expect(derivePatternFromResult("March 4, 2026", { year: 2026, month: 3, day: 4 })).toBe(
      "mmmm d, yyyy",
    );
    expect(derivePatternFromResult("03/2026", { year: 2026, month: 3, day: 1 })).toBe("mm/yyyy");
  });

  it("refuses a result that does not match the requested date", () => {
    expect(derivePatternFromResult("2026-03-05", { year: 2026, month: 3, day: 4 })).toBeNull();
    expect(derivePatternFromResult("2025-03-04", { year: 2026, month: 3, day: 4 })).toBeNull();
    expect(derivePatternFromResult("", { year: 2026, month: 3, day: 4 })).toBeNull();
  });
});

describe("loose parsing", () => {
  it("parses year first and month name values", () => {
    expect(looseParseDate("2026-03-04")).toMatchObject({
      year: 2026,
      month: 3,
      day: 4,
      valid: true,
      ambiguous: false,
    });
    expect(looseParseDate("March 4, 2026")).toMatchObject({
      year: 2026,
      month: 3,
      day: 4,
      valid: true,
    });
  });

  it("flags ambiguous numeric values but still reports parts", () => {
    expect(looseParseDate("03/04/2026")).toMatchObject({
      year: 2026,
      month: 4,
      day: 3,
      valid: true,
      ambiguous: true,
    });
  });

  it("does not call equal day and month parts ambiguous", () => {
    expect(looseParseDate("2/2/2026")).toMatchObject({
      year: 2026,
      month: 2,
      day: 2,
      valid: true,
      ambiguous: false,
    });
    expect(looseParseDate("02/02/2026")).toMatchObject({
      year: 2026,
      month: 2,
      day: 2,
      valid: true,
      ambiguous: false,
    });
  });

  it("parses month and year only", () => {
    expect(looseParseDate("03/2026")).toMatchObject({
      year: 2026,
      month: 3,
      day: null,
      valid: true,
    });
  });

  it("rejects impossible values", () => {
    expect(looseParseDate("31/02/2026")).toBeNull();
    expect(looseParseDate("2026-13-01")).toBeNull();
    expect(looseParseDate("")).toBeNull();
    expect(looseParseDate("no date here")).toBeNull();
  });
});
