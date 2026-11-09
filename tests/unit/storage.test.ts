import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampEarliestYear,
  clampFutureYears,
  CONFIG_KEY,
  ensureDefaultConfig,
  FORMATS_KEY,
  forgetFormats,
  formatStorageKey,
  readConfig,
  readFormat,
  sanitizeConfig,
  sanitizeFieldKey,
  sanitizeOrigin,
  sanitizePattern,
  writeConfig,
  writeFormat,
} from "../../src/shared/storage.js";

interface StorageMock {
  data: Record<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

function installChrome(initial: Record<string, unknown> = {}): StorageMock {
  const data: Record<string, unknown> = { ...initial };
  const storage = {
    get: vi.fn((key: string) => Promise.resolve({ [key]: data[key] })),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(data, items);
      return Promise.resolve();
    }),
    remove: vi.fn((key: string) => {
      Reflect.deleteProperty(data, key);
      return Promise.resolve();
    }),
  };
  vi.stubGlobal("chrome", { storage: { local: storage } });
  return { data, ...storage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configuration sanitizing", () => {
  it("clamps years to supported bounds", () => {
    expect(clampEarliestYear(1800)).toBe(1900);
    expect(clampEarliestYear(2500)).toBe(2100);
    expect(clampEarliestYear(2020.9)).toBe(2020);
    expect(clampEarliestYear("2020")).toBe(1900);
    expect(clampFutureYears(-5)).toBe(0);
    expect(clampFutureYears(999)).toBe(200);
    expect(clampFutureYears(Number.NaN)).toBe(30);
  });

  it("returns defaults for malformed configuration", () => {
    expect(sanitizeConfig(null)).toEqual({ earliestYear: 1900, futureYears: 30 });
    expect(sanitizeConfig({ earliestYear: 2000, futureYears: 5 })).toEqual({
      earliestYear: 2000,
      futureYears: 5,
    });
  });

  it("sanitizes origins, field keys and patterns", () => {
    expect(sanitizeOrigin(" https://example.com ")).toBe("https://example.com");
    expect(sanitizeOrigin("https://exa\u0000mple.com")).toBeNull();
    expect(sanitizeOrigin("")).toBeNull();
    expect(sanitizeOrigin("x".repeat(301))).toBeNull();
    expect(sanitizeFieldKey("  billing   date  ")).toBe("billing date");
    expect(sanitizeFieldKey("\u0000\u0001")).toBeNull();
    expect(sanitizeFieldKey("x".repeat(200))).toHaveLength(160);
    expect(sanitizePattern("dd/mm/yyyy")).toBe("dd/mm/yyyy");
    expect(sanitizePattern(" 2026-13-40 ")).toBeNull();
    expect(sanitizePattern("tomorrow")).toBeNull();
    expect(sanitizePattern("")).toBeNull();
  });

  it("builds a stable JSON storage key", () => {
    expect(formatStorageKey("https://a.test", "start date")).toBe(
      JSON.stringify(["https://a.test", "start date"]),
    );
  });
});

describe("configuration storage", () => {
  it("reads defaults when nothing is stored", async () => {
    installChrome();
    await expect(readConfig()).resolves.toEqual({ earliestYear: 1900, futureYears: 30 });
  });

  it("writes sanitized configuration", async () => {
    const chrome = installChrome();
    await expect(writeConfig({ earliestYear: 2001, futureYears: 7 })).resolves.toEqual({
      earliestYear: 2001,
      futureYears: 7,
    });
    expect(chrome.data[CONFIG_KEY]).toEqual({ earliestYear: 2001, futureYears: 7 });
  });

  it("reads sanitized stored configuration", async () => {
    installChrome({ [CONFIG_KEY]: { earliestYear: 1800, futureYears: -1 } });
    await expect(readConfig()).resolves.toEqual({ earliestYear: 1900, futureYears: 0 });
  });

  it("writes defaults only when missing", async () => {
    const chrome = installChrome();
    await ensureDefaultConfig();
    expect(chrome.set).toHaveBeenCalledTimes(1);
    await ensureDefaultConfig();
    expect(chrome.set).toHaveBeenCalledTimes(1);
  });
});

describe("learned formats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes and reads a format for one origin and field", async () => {
    const chrome = installChrome();
    await expect(writeFormat("https://a.test", "start", "dd/mm/yyyy")).resolves.toBe(true);
    const stored = chrome.data[FORMATS_KEY] as Record<
      string,
      { pattern: string; learnedAt: number }
    >;
    expect(stored[formatStorageKey("https://a.test", "start")]).toEqual({
      pattern: "dd/mm/yyyy",
      learnedAt: Date.now(),
    });
    await expect(readFormat("https://a.test", "start")).resolves.toBe("dd/mm/yyyy");
    await expect(readFormat("https://a.test", "end")).resolves.toBeNull();
    await expect(readFormat("https://b.test", "start")).resolves.toBeNull();
  });

  it("never stores a date value in place of a pattern", async () => {
    installChrome();
    await expect(writeFormat("https://a.test", "start", "2026-03-04")).resolves.toBe(false);
    await expect(readFormat("https://a.test", "start")).resolves.toBeNull();
  });

  it("rejects invalid origin, field key or pattern", async () => {
    installChrome();
    await expect(writeFormat("", "start", "dd/mm/yyyy")).resolves.toBe(false);
    await expect(writeFormat("https://a.test", "  ", "dd/mm/yyyy")).resolves.toBe(false);
    await expect(writeFormat("https://a.test", "start", "nonsense")).resolves.toBe(false);
  });

  it("ignores malformed stored records", async () => {
    installChrome({
      [FORMATS_KEY]: {
        "not json": { pattern: "nonsense", learnedAt: 1 },
        [formatStorageKey("https://a.test", "start")]: "dd/mm/yyyy",
        [formatStorageKey("https://a.test", "end")]: { pattern: "yyyy-mm-dd", learnedAt: 2 },
      },
    });
    await expect(readFormat("https://a.test", "start")).resolves.toBeNull();
    await expect(readFormat("https://a.test", "end")).resolves.toBe("yyyy-mm-dd");
  });

  it("keeps the most recently learned 500 formats", async () => {
    const chrome = installChrome();
    for (let index = 0; index < 505; index += 1) {
      vi.setSystemTime(new Date(2026, 0, 1, 0, 0, index));
      await writeFormat("https://a.test", `field-${index}`, "dd/mm/yyyy");
    }
    const stored = chrome.data[FORMATS_KEY] as Record<string, unknown>;
    expect(Object.keys(stored)).toHaveLength(500);
    expect(stored[formatStorageKey("https://a.test", "field-504")]).toBeDefined();
    expect(stored[formatStorageKey("https://a.test", "field-0")]).toBeUndefined();
  });

  it("forgets all learned formats", async () => {
    const chrome = installChrome({
      [FORMATS_KEY]: { key: { pattern: "dd/mm/yyyy", learnedAt: 1 } },
    });
    await forgetFormats();
    expect(chrome.remove).toHaveBeenCalledWith(FORMATS_KEY);
    expect(chrome.data[FORMATS_KEY]).toBeUndefined();
  });

  it("fails closed when storage throws", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(() => Promise.reject(new Error("no storage"))),
          set: vi.fn(() => Promise.reject(new Error("no storage"))),
          remove: vi.fn(() => Promise.reject(new Error("no storage"))),
        },
      },
    });
    await expect(readConfig()).resolves.toEqual({ earliestYear: 1900, futureYears: 30 });
    await expect(readFormat("https://a.test", "start")).resolves.toBeNull();
    await expect(writeFormat("https://a.test", "start", "dd/mm/yyyy")).resolves.toBe(false);
  });
});
