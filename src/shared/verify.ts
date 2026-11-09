import type { CivilDate } from "./date.js";
import { looseParseDate, parseWithFormat, type ParsedDateParts } from "./formats.js";

export type VerificationMode = "day" | "month-year";

export interface VerificationResult {
  ok: boolean;
  value: string;
  parsed: ParsedDateParts | null;
  ambiguous: boolean;
  usedFormat: string | null;
  reason: string;
}

export function verifyFieldValue(
  value: string,
  target: CivilDate,
  mode: VerificationMode,
  format: string | null = null,
): VerificationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: false,
      value,
      parsed: null,
      ambiguous: false,
      usedFormat: null,
      reason: "the field is empty",
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
        reason: "matched the known format",
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
      reason: "the value could not be parsed",
    };
  }
  if (loose.ambiguous) {
    return {
      ok: false,
      value,
      parsed: loose,
      ambiguous: true,
      usedFormat: format,
      reason: "day and month are ambiguous",
    };
  }
  if (!matches(loose, target, mode)) {
    return {
      ok: false,
      value,
      parsed: loose,
      ambiguous: false,
      usedFormat: format,
      reason: "the value does not match the requested date",
    };
  }
  return {
    ok: true,
    value,
    parsed: loose,
    ambiguous: false,
    usedFormat: format,
    reason: "matched by loose parsing",
  };
}

function matches(parsed: ParsedDateParts, target: CivilDate, mode: VerificationMode): boolean {
  if (parsed.year !== target.year || parsed.month !== target.month) return false;
  if (mode === "month-year") return true;
  return parsed.day === target.day;
}
