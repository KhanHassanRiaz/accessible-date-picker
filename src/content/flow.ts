import {
  clampDate,
  compareDates,
  daysInMonth,
  parseIsoDate,
  parseIsoMonth,
  type CivilDate,
} from "../shared/date.js";
import {
  deriveLearnedPattern,
  derivePatternFromResult,
  detectDateFormat,
  formatHintFromAttributes,
  looseParseDate,
  normalizeLibraryFormat,
  parseWithFormat,
  type ParsedDateParts,
} from "../shared/formats.js";
import type { ExtensionConfig, LibraryInfo } from "../shared/messages.js";
import { DEFAULT_CONFIG } from "../shared/messages.js";
import { verifyFieldValue, type VerificationMode } from "../shared/verify.js";
import { STRINGS } from "../strings.js";
import { announce, cancelAnnouncementCleanup, scheduleAnnouncementCleanup } from "./announcer.js";
import { findCalendarCandidate } from "./calendar.js";
import { DateDialog, type YearBounds } from "./dialog.js";
import { focusWithoutScroll } from "./dom.js";
import { CalendarDriver, type CalendarDriverResult } from "./driver.js";
import { getAriaDescription, getFieldLabel } from "./labels.js";
import {
  applyDirectWrite,
  applyNativeLayer,
  detectWriteFormat,
  inspectLibraries,
  loadExtensionConfig,
  loadLearnedFormat,
  storeLearnedFormat,
  tryLibraryAdapter,
  type LayerDependencies,
} from "./layers.js";

interface FlowLog {
  elapsedMs: number;
  action: string;
  detail: string;
}

type AttemptResult = "success" | "final-failure" | "mismatch";

let activeFlow: ContentFlow | null = null;

export function isFlowActive(): boolean {
  return activeFlow !== null;
}

export class ContentFlow {
  private readonly field: HTMLInputElement;
  private readonly label: string;
  private readonly fieldKey: string;
  private readonly origin: string;
  private dialog: DateDialog | null = null;
  private config: ExtensionConfig = DEFAULT_CONFIG;
  private learnedFormat: string | null = null;
  private fieldFormat: string | null = null;
  private libraryInfo: LibraryInfo | null = null;
  private driverResult: CalendarDriverResult | null = null;
  private readonly flowLog: FlowLog[] = [];
  private readonly startedAt = performance.now();
  private lastResult: string = STRINGS.diagnostics.notRun;
  private dialogClosed = false;
  private completed = false;

  private constructor(field: HTMLInputElement, label: string) {
    this.field = field;
    this.label = label;
    this.origin = location.origin || `${location.protocol}//${location.host}`;
    this.fieldKey = fieldKeyFor(field, label);
  }

  static async start(field: HTMLInputElement): Promise<void> {
    if (activeFlow) return;
    const label = getFieldLabel(field);
    const flow = new ContentFlow(field, label);
    activeFlow = flow;
    try {
      await flow.open();
    } catch {
      activeFlow = null;
      announce(STRINGS.siteRejected, "assertive");
      scheduleAnnouncementCleanup();
    }
  }

  private async open(): Promise<void> {
    const [config, learned] = await Promise.all([
      loadExtensionConfig(),
      loadLearnedFormat(this.origin, this.fieldKey),
    ]);
    this.config = normalizeConfig(config ?? DEFAULT_CONFIG);
    this.learnedFormat = learned;
    this.fieldFormat = detectWriteFormat(this.field, this.label, {
      learnedFormat: learned,
      libraryInfo: null,
    }).pattern;
    this.log("start", `field label: ${this.label}`);

    const bounds = yearBoundsFor(this.field, this.config);
    const fallbackDate = clampDate({
      year: Math.min(Math.max(new Date().getFullYear(), bounds.minYear), bounds.maxYear),
      month: 1,
      day: 1,
    });
    const initialDate =
      parseInitialDate(this.field, this.learnedFormat ?? this.fieldFormat) ?? fallbackDate;

    const dialog = new DateDialog({
      field: this.field,
      label: this.label,
      initialDate,
      bounds,
      callbacks: {
        onApply: async (date) => {
          await this.runApply(date);
        },
        onCancel: () => {
          this.cancel();
        },
        onDiagnostics: async () => {
          await this.copyDiagnostics();
        },
      },
    });
    this.dialog = dialog;
    dialog.open();
    cancelAnnouncementCleanup();
    announce(STRINGS.opened(this.label), "polite");
  }

  private async runApply(target: CivilDate): Promise<void> {
    this.log("apply", `target ${target.year}-${target.month}-${target.day}`);
    announce(STRINGS.working, "polite");
    try {
      await this.applyTarget(target);
    } catch (error) {
      this.log("error", error instanceof Error ? error.message : String(error));
      this.lastResult = STRINGS.siteRejected;
      if (this.dialog?.isOpen()) {
        this.dialog.setBusy(false);
        this.dialog.focusFirst();
        announce(STRINGS.siteRejected, "assertive");
      } else {
        this.restoreFocusAndFinish(STRINGS.siteRejected);
      }
    }
  }

  private async applyTarget(target: CivilDate): Promise<void> {
    if (this.field.disabled) {
      this.failInDialog(STRINGS.notAllowed);
      return;
    }
    const bounds = yearBoundsFor(this.field, this.config);
    if (bounds.minDate && compareDates(target, bounds.minDate) < 0) {
      this.failInDialog(STRINGS.notAllowed);
      return;
    }
    if (bounds.maxDate && compareDates(target, bounds.maxDate) > 0) {
      this.failInDialog(STRINGS.notAllowed);
      return;
    }

    const type = this.field.type.toLowerCase();
    const native = await applyNativeLayer(this.field, target);
    this.log("layer 0", `${native.status}: ${native.detail}`);
    if (native.status === "not-allowed") {
      this.failInDialog(STRINGS.notAllowed);
      return;
    }
    if (native.status === "applied") {
      const outcome = await this.trySuccess(
        this.field.value,
        target,
        native.mode,
        native.format,
        "native input",
      );
      if (outcome !== "mismatch") return;
    }

    if (type === "date" || type === "month") {
      this.failInDialog(STRINGS.siteRejected);
      return;
    }

    const driver = new CalendarDriver(this.field, target);
    const result = await driver.run();
    this.driverResult = result;
    for (const entry of result.log) {
      this.log(`driver ${entry.action}`, `${entry.elapsedMs} ms: ${entry.detail}`);
    }
    if (result.status === "not-allowed") {
      this.failInDialog(STRINGS.notAllowed);
      return;
    }
    if (result.status === "stuck") {
      this.failInDialog(STRINGS.calendarStuck);
      return;
    }
    if (result.status === "success") {
      const outcome = await this.trySuccess(
        result.value,
        target,
        result.mode,
        this.learnedFormat ?? this.fieldFormat,
        "calendar driver",
      );
      if (outcome !== "mismatch") return;
    }

    const library = await tryLibraryAdapter(this.field, target);
    if (library.info) this.libraryInfo = library.info;
    this.log(
      "layer B",
      `${library.outcome.status}: ${library.outcome.detail}${
        library.info?.name ? ` (${library.info.name})` : ""
      }`,
    );
    if (library.outcome.status === "not-allowed") {
      this.failInDialog(STRINGS.notAllowed);
      return;
    }
    if (library.outcome.status === "applied") {
      const libraryFormat =
        this.learnedFormat ??
        normalizeLibraryFormat(library.info?.format ?? null, library.info?.name ?? "unknown") ??
        this.fieldFormat;
      const outcome = await this.trySuccess(
        this.field.value,
        target,
        "day",
        libraryFormat,
        "library adapter",
      );
      if (outcome !== "mismatch") return;
    }

    const dependencies: LayerDependencies = {
      learnedFormat: this.learnedFormat,
      libraryInfo: this.libraryInfo,
    };
    const direct = await applyDirectWrite(this.field, target, this.label, dependencies);
    this.log("layer C", `${direct.status}: ${direct.detail}; source ${direct.detection.source}`);
    if (direct.status === "format-unknown") {
      this.failInDialog(STRINGS.formatUnknown);
      return;
    }
    if (direct.status === "not-allowed") {
      this.failInDialog(STRINGS.notAllowed);
      return;
    }
    if (direct.status === "not-applicable") {
      this.failInDialog(STRINGS.calendarNotFound);
      return;
    }
    const outcome = await this.trySuccess(
      this.field.value,
      target,
      direct.mode,
      direct.format,
      `direct write (${direct.detection.source})`,
    );
    if (outcome === "mismatch") {
      this.failInDialog(STRINGS.siteRejected);
    }
  }

  private async trySuccess(
    value: string,
    target: CivilDate,
    mode: VerificationMode,
    format: string | null,
    source: string,
  ): Promise<AttemptResult> {
    const verification = verifyFieldValue(value, target, mode, format);
    this.log(
      "verify",
      `${source}: ${verification.ok ? "ok" : "failed"} (${verification.reason}); format ${
        format ?? "unknown"
      }`,
    );
    if (!verification.ok) return "mismatch";
    const success = await this.completeSuccess(target, mode, format);
    return success ? "success" : "final-failure";
  }

  private async completeSuccess(
    target: CivilDate,
    mode: VerificationMode,
    format: string | null,
  ): Promise<boolean> {
    this.dialog?.close();
    this.dialogClosed = true;
    focusWithoutScroll(this.field);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
    const finalValue = this.field.value;
    const finalVerification = verifyFieldValue(finalValue, target, mode, format);
    this.log(
      "final verify",
      `${finalVerification.ok ? "ok" : "failed"} (${finalVerification.reason}); value read after focus return`,
    );

    if (!finalVerification.ok) {
      this.lastResult = STRINGS.siteRejected;
      this.completed = true;
      activeFlow = null;
      announce(STRINGS.siteRejected, "assertive");
      scheduleAnnouncementCleanup();
      return false;
    }

    this.learnFormat(finalValue, finalVerification.parsed, target, format);
    const message =
      mode === "month-year" ? STRINGS.successMonthYear(finalValue) : STRINGS.success(finalValue);
    this.lastResult = message;
    this.completed = true;
    activeFlow = null;
    announce(message, "assertive");
    scheduleAnnouncementCleanup();
    return true;
  }

  private learnFormat(
    value: string,
    parsed: ParsedDateParts | null,
    target: CivilDate,
    format: string | null,
  ): void {
    const actual = parsed
      ? { year: parsed.year, month: parsed.month, day: parsed.day ?? target.day }
      : target;
    const pattern =
      (format && parseWithFormat(value, format)?.valid ? format : null) ??
      deriveLearnedPattern(value) ??
      derivePatternFromResult(value, actual);
    if (!pattern) return;
    this.learnedFormat = pattern;
    void storeLearnedFormat(this.origin, this.fieldKey, pattern).then((ok) => {
      this.log("learn format", `${pattern}: ${ok ? "stored" : "not stored"}`);
    });
  }

  private failInDialog(message: string): void {
    this.lastResult = message;
    if (this.dialog?.isOpen()) {
      this.dialog.setBusy(false);
      this.dialog.focusFirst();
      announce(message, "assertive");
      return;
    }
    this.restoreFocusAndFinish(message);
  }

  private restoreFocusAndFinish(message: string): void {
    this.dialog?.close();
    this.dialogClosed = true;
    focusWithoutScroll(this.field);
    this.lastResult = message;
    announce(message, "assertive");
    scheduleAnnouncementCleanup();
    activeFlow = null;
  }

  private cancel(): void {
    this.lastResult = STRINGS.cancelled;
    this.dialog?.close();
    this.dialogClosed = true;
    focusWithoutScroll(this.field);
    announce(STRINGS.cancelled, "assertive");
    scheduleAnnouncementCleanup();
    activeFlow = null;
    this.completed = true;
  }

  private async copyDiagnostics(): Promise<void> {
    this.log("diagnostics", "copy requested");
    const inspect = await inspectLibraries(this.field);
    if (inspect) this.libraryInfo = inspect;
    const report = this.buildDiagnosticReport();
    const copied = await copyTextToClipboard(report);
    if (copied) {
      announce(STRINGS.reportCopied, "assertive");
    } else {
      announce(STRINGS.reportCopyFailed, "assertive");
      this.dialog?.focusFirst();
    }
  }

  private buildDiagnosticReport(): string {
    const fieldHtml = sanitizedOuterHtml(this.field, true, 2_048);
    const ancestorParts: string[] = [];
    let ancestorBudget = 4_096;
    let ancestor: Element | null = this.field.parentElement;
    for (let depth = 0; depth < 3 && ancestor && ancestorBudget > 0; depth += 1) {
      const html = sanitizedOuterHtml(ancestor, false, ancestorBudget);
      ancestorParts.push(html);
      ancestorBudget -= Math.min(html.length, ancestorBudget);
      ancestor = ancestor.parentElement;
    }

    const driverCalendar = this.driverResult?.calendarElement;
    const openCalendar = driverCalendar?.isConnected
      ? driverCalendar
      : findCalendarCandidate(this.field);
    const calendarHtml = openCalendar
      ? sanitizedOuterHtml(openCalendar, true, 20_480)
      : STRINGS.diagnostics.none;
    const libraries = describeLibrary(this.libraryInfo);
    const stepLines = [
      ...this.flowLog.map((entry) => `${entry.elapsedMs} ms ${entry.action}: ${entry.detail}`),
      ...(this.driverResult?.log ?? []).map(
        (entry) => `${entry.elapsedMs} ms driver #${entry.step} ${entry.action}: ${entry.detail}`,
      ),
    ];
    return [
      STRINGS.diagnostics.title,
      "",
      `${STRINGS.diagnostics.origin}: ${this.origin}`,
      `${STRINGS.diagnostics.path}: ${location.pathname}`,
      "",
      `${STRINGS.diagnostics.field}:`,
      fieldHtml,
      "",
      `${STRINGS.diagnostics.ancestors}:`,
      ancestorParts.join("\n\n") || STRINGS.diagnostics.none,
      "",
      `${STRINGS.diagnostics.calendar}:`,
      calendarHtml,
      "",
      `${STRINGS.diagnostics.libraries}:`,
      libraries,
      "",
      `${STRINGS.diagnostics.steps}:`,
      stepLines.join("\n") || STRINGS.diagnostics.none,
      "",
      `${STRINGS.diagnostics.result}:`,
      this.lastResult,
    ].join("\n");
  }

  private log(action: string, detail: string): void {
    this.flowLog.push({
      elapsedMs: Math.round(performance.now() - this.startedAt),
      action,
      detail,
    });
  }

  get isCompleted(): boolean {
    return this.completed;
  }

  get wasDialogClosed(): boolean {
    return this.dialogClosed;
  }
}

function normalizeConfig(config: ExtensionConfig): ExtensionConfig {
  const earliestYear = Number.isInteger(config.earliestYear)
    ? Math.min(Math.max(config.earliestYear, 1), 9_999)
    : DEFAULT_CONFIG.earliestYear;
  const futureYears = Number.isInteger(config.futureYears)
    ? Math.min(Math.max(config.futureYears, 0), 200)
    : DEFAULT_CONFIG.futureYears;
  return { earliestYear, futureYears };
}

function fieldKeyFor(field: HTMLInputElement, label: string): string {
  const value =
    [
      field.name,
      field.id,
      label,
      field.placeholder,
      field.getAttribute("aria-label") ?? "",
      "date-field",
    ]
      .map((part) => part.trim())
      .find((part) => part.length > 0) ?? "date-field";
  return value.replace(/\s+/g, " ").slice(0, 160);
}

function parseInitialDate(field: HTMLInputElement, learnedFormat: string | null): CivilDate | null {
  const value = field.value.trim();
  if (!value) return null;
  const type = field.type.toLowerCase();
  if (type === "date") return parseIsoDate(value);
  if (type === "month") {
    const month = parseIsoMonth(value);
    return month ? { ...month, day: 1 } : null;
  }
  if (learnedFormat) {
    const parsed = parseWithFormat(value, learnedFormat);
    if (parsed?.valid) {
      return {
        year: parsed.year,
        month: parsed.month,
        day: parsed.day ?? 1,
      };
    }
  }
  const loose = looseParseDate(value);
  if (loose?.valid && !loose.ambiguous) {
    return { year: loose.year, month: loose.month, day: loose.day ?? 1 };
  }
  return null;
}

function parseBoundary(field: HTMLInputElement, attribute: "min" | "max"): CivilDate | null {
  const raw = field.getAttribute(attribute)?.trim();
  if (!raw) return null;
  const iso = parseIsoDate(raw);
  if (iso) return iso;
  const month = parseIsoMonth(raw);
  if (month) {
    return {
      ...month,
      day: attribute === "max" ? daysInMonth(month.year, month.month) : 1,
    };
  }
  const loose = looseParseDate(raw);
  if (loose?.valid) {
    return {
      year: loose.year,
      month: loose.month,
      day: loose.day ?? (attribute === "max" ? daysInMonth(loose.year, loose.month) : 1),
    };
  }
  const yearMatch = /\b(\d{4})\b/.exec(raw);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      year,
      month: attribute === "max" ? 12 : 1,
      day: attribute === "max" ? 31 : 1,
    };
  }
  return null;
}

function yearBoundsFor(field: HTMLInputElement, config: ExtensionConfig): YearBounds {
  const minDate = parseBoundary(field, "min");
  const maxDate = parseBoundary(field, "max");
  const currentYear = new Date().getFullYear();
  let minYear = minDate?.year ?? config.earliestYear;
  let maxYear = maxDate?.year ?? currentYear + config.futureYears;
  if (maxYear < minYear) {
    minYear = config.earliestYear;
    maxYear = currentYear + config.futureYears;
  }
  return { minYear, maxYear, minDate, maxDate };
}

function describeLibrary(info: LibraryInfo | null): string {
  if (!info || info.name === "unknown") return STRINGS.diagnostics.none;
  const parts: string[] = [info.name];
  if (info.version) parts.push(`version ${info.version}`);
  if (info.format) parts.push(`format ${info.format}`);
  parts.push(info.supported ? "adapter available" : "adapter unavailable");
  if (info.error) parts.push(`error ${info.error}`);
  return parts.join(", ");
}

function sanitizedOuterHtml(element: Element, keepTargetValue: boolean, limit: number): string {
  try {
    const clone = element.cloneNode(true) as Element;
    for (const script of clone.querySelectorAll("script")) script.remove();
    for (const input of clone.querySelectorAll("input")) {
      if (!keepTargetValue) input.removeAttribute("value");
      input.removeAttribute("data-adp-target");
    }
    if (clone instanceof HTMLInputElement) clone.removeAttribute("data-adp-target");
    const html = clone.outerHTML;
    return html.length > limit ? `${html.slice(0, limit)}\n[truncated]` : html;
  } catch {
    return STRINGS.diagnostics.unavailable;
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function fieldLabelForDiagnostics(field: HTMLInputElement): string {
  return `${getFieldLabel(field)} ${getAriaDescription(field)}`.trim();
}

export function detectedFormatForDiagnostics(field: HTMLInputElement): string {
  return detectDateFormat({
    value: field.value,
    placeholder: field.placeholder,
    attributes: formatHintFromAttributes(field),
    labelTexts: [getFieldLabel(field), getAriaDescription(field)],
  }).source;
}

export function fieldHasNativeDateType(field: HTMLInputElement): boolean {
  return field.type === "date" || field.type === "month";
}
