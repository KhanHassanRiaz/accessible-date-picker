import { formatWithPattern } from "./formats.js";
import { DEFAULT_CONFIG, type ExtensionConfig, type FormatRecord } from "./messages.js";

export const CONFIG_KEY = "adp:config";
export const FORMATS_KEY = "adp:formats";

const MAX_FORMATS = 500;
const MAX_ORIGIN_LENGTH = 300;
const MAX_FIELD_KEY_LENGTH = 160;
const MAX_PATTERN_LENGTH = 40;

type StoredFormats = Record<string, FormatRecord>;

export function clampEarliestYear(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONFIG.earliestYear;
  return Math.min(Math.max(Math.trunc(value), 1900), 2100);
}

export function clampFutureYears(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONFIG.futureYears;
  return Math.min(Math.max(Math.trunc(value), 0), 200);
}

export function sanitizeConfig(value: unknown): ExtensionConfig {
  if (!isRecord(value)) return { ...DEFAULT_CONFIG };
  return {
    earliestYear: clampEarliestYear(value.earliestYear),
    futureYears: clampFutureYears(value.futureYears),
  };
}

export function sanitizeOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ORIGIN_LENGTH) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

export function sanitizeFieldKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = stripControlCharacters(value.replace(/\s+/g, " ")).trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_FIELD_KEY_LENGTH);
}

export function sanitizePattern(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PATTERN_LENGTH) return null;
  const produced = formatWithPattern({ year: 2000, month: 1, day: 2 }, trimmed);
  return produced === null ? null : trimmed;
}

export function formatStorageKey(origin: string, fieldKey: string): string {
  return JSON.stringify([origin, fieldKey]);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function stripControlCharacters(value: string): string {
  let output = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) continue;
    output += character;
  }
  return output;
}

function parseFormats(value: unknown): StoredFormats {
  if (!isRecord(value)) return {};
  const formats: StoredFormats = {};
  for (const [key, record] of Object.entries(value)) {
    if (!isRecord(record)) continue;
    const pattern = sanitizePattern(record.pattern);
    if (!pattern) continue;
    const learnedAt =
      typeof record.learnedAt === "number" && Number.isFinite(record.learnedAt)
        ? record.learnedAt
        : 0;
    formats[key] = { pattern, learnedAt };
  }
  return formats;
}

export async function readConfig(): Promise<ExtensionConfig> {
  try {
    const stored = await chrome.storage.local.get(CONFIG_KEY);
    return sanitizeConfig(stored[CONFIG_KEY]);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(config: unknown): Promise<ExtensionConfig> {
  const clean = sanitizeConfig(config);
  await chrome.storage.local.set({ [CONFIG_KEY]: clean });
  return clean;
}

export async function ensureDefaultConfig(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(CONFIG_KEY);
    if (stored[CONFIG_KEY] === undefined) {
      await chrome.storage.local.set({ [CONFIG_KEY]: { ...DEFAULT_CONFIG } });
    }
  } catch {
    // Storage may be unavailable during startup; the default is still used.
  }
}

export async function readFormat(origin: string, fieldKey: string): Promise<string | null> {
  try {
    const stored = await chrome.storage.local.get(FORMATS_KEY);
    const formats = parseFormats(stored[FORMATS_KEY]);
    const record = formats[formatStorageKey(origin, fieldKey)];
    return record?.pattern ?? null;
  } catch {
    return null;
  }
}

export async function writeFormat(
  origin: unknown,
  fieldKey: unknown,
  pattern: unknown,
): Promise<boolean> {
  const cleanOrigin = sanitizeOrigin(origin);
  const cleanFieldKey = sanitizeFieldKey(fieldKey);
  const cleanPattern = sanitizePattern(pattern);
  if (!cleanOrigin || !cleanFieldKey || !cleanPattern) return false;

  try {
    const stored = await chrome.storage.local.get(FORMATS_KEY);
    const formats = parseFormats(stored[FORMATS_KEY]);
    formats[formatStorageKey(cleanOrigin, cleanFieldKey)] = {
      pattern: cleanPattern,
      learnedAt: Date.now(),
    };
    const entries = Object.entries(formats).sort(
      ([, first], [, second]) => second.learnedAt - first.learnedAt,
    );
    const limited = Object.fromEntries(entries.slice(0, MAX_FORMATS));
    await chrome.storage.local.set({ [FORMATS_KEY]: limited });
    return true;
  } catch {
    return false;
  }
}

export async function forgetFormats(): Promise<void> {
  await chrome.storage.local.remove(FORMATS_KEY);
}
