import type { CivilDate } from "../shared/date.js";
import { parseIsoDate, parseIsoMonth, toIsoDate, toIsoMonth } from "../shared/date.js";
import {
  detectDateFormat,
  formatHintFromAttributes,
  formatWithPattern,
  patternHasDay,
  type DateLibrary,
  type FormatDetection,
} from "../shared/formats.js";
import type {
  BackgroundRequest,
  GetConfigResponse,
  GetFormatResponse,
  LibraryBridgeResponse,
  LibraryInfo,
  SetFormatResponse,
} from "../shared/messages.js";
import type { VerificationMode } from "../shared/verify.js";
import { getAriaDescription, getFieldLabel } from "./labels.js";
import { dispatchInputEvents, focusWithoutScroll, nativeInputValueSetter } from "./dom.js";

export interface LayerOutcome {
  status: "applied" | "not-applicable" | "format-unknown" | "not-allowed";
  value: string;
  mode: VerificationMode;
  format: string | null;
  detail: string;
}

export interface LayerDependencies {
  learnedFormat: string | null;
  libraryInfo: LibraryInfo | null;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function sendBackground<T>(request: BackgroundRequest): Promise<T | null> {
  try {
    return await chrome.runtime.sendMessage(request);
  } catch {
    return null;
  }
}

export async function applyNativeLayer(
  field: HTMLInputElement,
  target: CivilDate,
): Promise<LayerOutcome> {
  const type = field.type.toLowerCase();
  if (type !== "date" && type !== "month") {
    return {
      status: "not-applicable",
      value: field.value,
      mode: "day",
      format: null,
      detail: "not a native date or month input",
    };
  }
  if (field.disabled) {
    return {
      status: "not-allowed",
      value: field.value,
      mode: type === "month" ? "month-year" : "day",
      format: type === "month" ? "yyyy-mm" : "yyyy-mm-dd",
      detail: "native input is disabled",
    };
  }

  const value = type === "month" ? toIsoMonth(target) : toIsoDate(target);
  focusWithoutScroll(field);
  nativeInputValueSetter(field, value);
  dispatchInputEvents(field);
  await sleep(80);
  return {
    status: "applied",
    value: field.value,
    mode: type === "month" ? "month-year" : "day",
    format: type === "month" ? "yyyy-mm" : "yyyy-mm-dd",
    detail: `set native ${type} input`,
  };
}

function isInClosedShadowRoot(element: Element): boolean {
  const root = element.getRootNode();
  if (!(root instanceof ShadowRoot)) return false;
  return root.host.shadowRoot !== root;
}

function temporaryToken(): string {
  return `adp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function withTargetAttribute<T>(
  field: HTMLInputElement,
  action: (token: string) => Promise<T>,
): Promise<T | null> {
  if (isInClosedShadowRoot(field)) return null;
  const token = temporaryToken();
  field.setAttribute("data-adp-target", token);
  try {
    return await action(token);
  } finally {
    if (field.getAttribute("data-adp-target") === token) {
      field.removeAttribute("data-adp-target");
    }
  }
}

export async function tryLibraryAdapter(
  field: HTMLInputElement,
  target: CivilDate,
): Promise<{ outcome: LayerOutcome; info: LibraryInfo | null }> {
  if (!(field instanceof HTMLInputElement)) {
    return {
      outcome: {
        status: "not-applicable",
        value: "",
        mode: "day",
        format: null,
        detail: "field is not an input",
      },
      info: null,
    };
  }
  if (isInClosedShadowRoot(field)) {
    return {
      outcome: {
        status: "not-applicable",
        value: field.value,
        mode: "day",
        format: null,
        detail: "field is inside a closed shadow root; MAIN world cannot reach it",
      },
      info: null,
    };
  }

  const response = await withTargetAttribute(field, async (token) => {
    return sendBackground<LibraryBridgeResponse>({
      type: "adp:library",
      token,
      year: target.year,
      month: target.month,
      day: target.day,
      mode: "set",
    });
  });

  const info = response?.info ?? null;
  if (!response?.ok || !info?.supported) {
    return {
      outcome: {
        status: "not-applicable",
        value: field.value,
        mode: "day",
        format: info?.format ?? null,
        detail: info ? `library ${info.name} was not usable` : "no known date library found",
      },
      info,
    };
  }

  await sleep(100);
  return {
    outcome: {
      status: "applied",
      value: info.value ?? field.value,
      mode: "day",
      format: null,
      detail: `set through ${info.name}${info.version ? ` ${info.version}` : ""}`,
    },
    info,
  };
}

export async function inspectLibraries(field: HTMLInputElement): Promise<LibraryInfo | null> {
  const response = await withTargetAttribute(field, async (token) => {
    return sendBackground<LibraryBridgeResponse>({
      type: "adp:library",
      token,
      year: 2000,
      month: 1,
      day: 1,
      mode: "inspect",
    });
  });
  return response?.info ?? null;
}

function deepRootOf(element: Element): Document | ShadowRoot {
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root : element.ownerDocument;
}

function dateLikeOtherFields(field: HTMLInputElement): HTMLInputElement[] {
  const root = deepRootOf(field);
  const result: HTMLInputElement[] = [];
  const hints = /(date|birth|dob|issue|expiry|expire|month|year)/i;
  for (const candidate of root.querySelectorAll("input")) {
    if (!(candidate instanceof HTMLInputElement) || candidate === field) continue;
    if (!candidate.value.trim()) continue;
    const type = candidate.type.toLowerCase();
    const looksLikeDate =
      type === "date" ||
      type === "month" ||
      hints.test(candidate.name) ||
      hints.test(candidate.id) ||
      hints.test(candidate.getAttribute("aria-label") ?? "") ||
      hints.test(candidate.placeholder) ||
      hints.test(candidate.className);
    if (!looksLikeDate) continue;
    if (type === "date" && !parseIsoDate(candidate.value)) continue;
    if (type === "month" && !parseIsoMonth(candidate.value)) continue;
    result.push(candidate);
    if (result.length >= 5) break;
  }
  return result;
}

function collectOtherFieldValues(field: HTMLInputElement): string[] {
  // Read-only format clue. The values are used locally and are never stored or logged.
  return dateLikeOtherFields(field)
    .map((candidate) => candidate.value.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function detectWriteFormat(
  field: HTMLInputElement,
  label: string,
  dependencies: LayerDependencies,
): FormatDetection {
  const attributes = formatHintFromAttributes(field);
  if (field instanceof HTMLInputElement) {
    const type = field.type.toLowerCase();
    if (type === "date") attributes.push("yyyy-mm-dd");
    if (type === "month") attributes.push("yyyy-mm");
  }
  const labelTexts = [
    label,
    field.getAttribute("aria-label") ?? "",
    field.getAttribute("title") ?? "",
    getAriaDescription(field),
  ].filter(Boolean);
  return detectDateFormat({
    learned: dependencies.learnedFormat,
    value: field.value,
    placeholder: field.placeholder,
    attributes,
    labelTexts,
    library: dependencies.libraryInfo
      ? { name: dependencies.libraryInfo.name, format: dependencies.libraryInfo.format }
      : null,
    otherFieldValues: collectOtherFieldValues(field),
  });
}

export async function applyDirectWrite(
  field: HTMLInputElement,
  target: CivilDate,
  label: string,
  dependencies: LayerDependencies,
): Promise<LayerOutcome & { detection: FormatDetection }> {
  const detection = detectWriteFormat(field, label, dependencies);
  if (!detection.pattern) {
    return {
      status: "format-unknown",
      value: field.value,
      mode: "day",
      format: null,
      detail: detection.source,
      detection,
    };
  }
  if (field.disabled) {
    return {
      status: "not-allowed",
      value: field.value,
      mode: patternHasDay(detection.pattern) ? "day" : "month-year",
      format: detection.pattern,
      detail: "field is disabled",
      detection,
    };
  }
  const value = formatWithPattern(target, detection.pattern);
  if (value === null) {
    return {
      status: "format-unknown",
      value: field.value,
      mode: "day",
      format: null,
      detail: "format could not produce a value",
      detection,
    };
  }

  const hadReadonly = field.hasAttribute("readonly");
  if (hadReadonly) field.removeAttribute("readonly");
  try {
    focusWithoutScroll(field);
    nativeInputValueSetter(field, value);
    dispatchInputEvents(field);
    if (field.ownerDocument.defaultView) {
      const view = field.ownerDocument.defaultView;
      field.dispatchEvent(new view.FocusEvent("focus", { composed: true }));
      field.dispatchEvent(new view.FocusEvent("blur", { composed: true }));
    }
    field.blur();
    await sleep(500);
  } finally {
    if (hadReadonly && field.isConnected) field.setAttribute("readonly", "");
  }

  return {
    status: "applied",
    value: field.value,
    mode: patternHasDay(detection.pattern) ? "day" : "month-year",
    format: detection.pattern,
    detail: `${detection.source}: ${detection.pattern}`,
    detection,
  };
}

export async function loadExtensionConfig(): Promise<GetConfigResponse["config"] | null> {
  const response = await sendBackground<GetConfigResponse>({ type: "adp:get-config" });
  return response?.config ?? null;
}

export async function loadLearnedFormat(origin: string, fieldKey: string): Promise<string | null> {
  const response = await sendBackground<GetFormatResponse>({
    type: "adp:get-format",
    origin,
    fieldKey,
  });
  return response?.format ?? null;
}

export async function storeLearnedFormat(
  origin: string,
  fieldKey: string,
  pattern: string,
): Promise<boolean> {
  const response = await sendBackground<SetFormatResponse>({
    type: "adp:set-format",
    origin,
    fieldKey,
    pattern,
  });
  return Boolean(response?.ok);
}

export function libraryName(value: string): DateLibrary {
  if (
    value === "jquery-ui" ||
    value === "bootstrap-datepicker" ||
    value === "flatpickr" ||
    value === "pikaday" ||
    value === "zebra-datepicker"
  ) {
    return value;
  }
  return "unknown";
}

export function focusField(field: HTMLInputElement): void {
  try {
    focusWithoutScroll(field);
  } catch {
    field.focus();
  }
}

export function labelForField(field: HTMLInputElement): string {
  return getFieldLabel(field);
}
