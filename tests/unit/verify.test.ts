import { describe, expect, it } from "vitest";
import { verifyFieldValue } from "../../src/shared/verify.js";

const target = { year: 2026, month: 3, day: 4 };

describe("field verification", () => {
  it("accepts a value that matches a known format", () => {
    const result = verifyFieldValue("04/03/2026", target, "day", "dd/mm/yyyy");
    expect(result).toMatchObject({
      ok: true,
      ambiguous: false,
      usedFormat: "dd/mm/yyyy",
      reason: "matched the known format",
    });
  });

  it("accepts an unambiguous loose value without a format", () => {
    const result = verifyFieldValue("2026-03-04", target, "day");
    expect(result.ok).toBe(true);
    expect(result.usedFormat).toBeNull();
    expect(result.parsed).toMatchObject({ year: 2026, month: 3, day: 4 });
  });

  it("refuses an ambiguous numeric value when no format is known", () => {
    const result = verifyFieldValue("03/04/2026", target, "day");
    expect(result).toMatchObject({
      ok: false,
      ambiguous: true,
      reason: "day and month are ambiguous",
    });
  });

  it("uses the known format to resolve an otherwise ambiguous value", () => {
    const result = verifyFieldValue("03/04/2026", target, "day", "mm/dd/yyyy");
    expect(result.ok).toBe(true);
    expect(result.parsed).toMatchObject({ year: 2026, month: 3, day: 4 });
  });

  it("rejects a different date", () => {
    const result = verifyFieldValue("2026-03-05", target, "day", "yyyy-mm-dd");
    expect(result).toMatchObject({
      ok: false,
      ambiguous: false,
      reason: "the value does not match the requested date",
    });
  });

  it("accepts a month and year only field in month-year mode", () => {
    const result = verifyFieldValue("03/2026", target, "month-year", "mm/yyyy");
    expect(result.ok).toBe(true);
    expect(result.parsed?.day).toBeNull();
  });

  it("rejects a day value in month-year mode when month or year differ", () => {
    expect(verifyFieldValue("04/2026", target, "month-year").ok).toBe(false);
    expect(verifyFieldValue("03/2025", target, "month-year").ok).toBe(false);
  });

  it("rejects an empty field without pretending it worked", () => {
    const result = verifyFieldValue("   ", target, "day");
    expect(result).toMatchObject({
      ok: false,
      parsed: null,
      ambiguous: false,
      reason: "the field is empty",
    });
  });

  it("rejects unparseable text", () => {
    const result = verifyFieldValue("tomorrow", target, "day");
    expect(result).toMatchObject({
      ok: false,
      reason: "the value could not be parsed",
    });
  });

  it("does not fall back to a loose match when the known format produced a different date", () => {
    const result = verifyFieldValue("2026-03-04", target, "day", "dd/mm/yyyy");
    expect(result.ok).toBe(true);
    expect(result.usedFormat).toBe("dd/mm/yyyy");
  });
});
