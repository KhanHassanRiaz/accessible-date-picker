import { clampDate, daysInMonth, monthName, sameDate, type CivilDate } from "../shared/date.js";
import { STRINGS } from "../strings.js";
import { announce } from "./announcer.js";
import { focusWithoutScroll } from "./dom.js";

export interface YearBounds {
  minYear: number;
  maxYear: number;
  minDate: CivilDate | null;
  maxDate: CivilDate | null;
}

export interface DialogCallbacks {
  onApply: (date: CivilDate) => Promise<void>;
  onCancel: () => void;
  onDiagnostics: () => Promise<void>;
}

export interface DialogOptions {
  field: HTMLInputElement;
  label: string;
  initialDate: CivilDate;
  bounds: YearBounds;
  callbacks: DialogCallbacks;
}

const STYLE = `
:host {
  all: initial;
}
.adp-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.62);
  box-sizing: border-box;
}
.adp-dialog {
  box-sizing: border-box;
  width: min(42rem, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 24px;
  border: 3px solid #111111;
  border-radius: 12px;
  background: #ffffff;
  color: #111111;
  font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  font-size: 18px;
  line-height: 1.45;
  text-align: left;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}
.adp-title {
  margin: 0 0 18px;
  font-size: 24px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.adp-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: 0 0 20px;
}
.adp-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}
.adp-field label {
  font-weight: 700;
}
.adp-field select {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  padding: 8px;
  border: 2px solid #333333;
  border-radius: 6px;
  background: #ffffff;
  color: #111111;
  font: inherit;
}
.adp-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.adp-button {
  min-height: 48px;
  padding: 10px 18px;
  border: 2px solid #111111;
  border-radius: 7px;
  background: #ffffff;
  color: #111111;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.adp-button-primary {
  background: #004f9e;
  color: #ffffff;
}
.adp-button-secondary {
  background: #ffffff;
  color: #111111;
}
.adp-diagnostics {
  margin-top: 16px;
  border-style: dashed;
}
.adp-button:disabled,
.adp-field select:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
.adp-dialog :focus-visible {
  outline: 4px solid #005fcc;
  outline-offset: 3px;
}
@media (max-width: 34rem) {
  .adp-fields {
    grid-template-columns: 1fr;
  }
  .adp-dialog {
    padding: 18px;
  }
}
@media (prefers-color-scheme: dark) {
  .adp-dialog {
    border-color: #ffffff;
    background: #151515;
    color: #ffffff;
  }
  .adp-field select {
    border-color: #e6e6e6;
    background: #1e1e1e;
    color: #ffffff;
  }
  .adp-button {
    border-color: #ffffff;
    background: #1e1e1e;
    color: #ffffff;
  }
  .adp-button-primary {
    background: #8ab4f8;
    color: #0b1020;
  }
  .adp-dialog :focus-visible {
    outline-color: #8ab4f8;
  }
}
@media (forced-colors: active) {
  .adp-backdrop {
    background: Canvas;
  }
  .adp-dialog,
  .adp-field select,
  .adp-button {
    border-color: CanvasText;
    background: Canvas;
    color: CanvasText;
    box-shadow: none;
  }
  .adp-button-primary {
    background: ButtonFace;
    color: ButtonText;
  }
  .adp-dialog :focus-visible {
    outline: 4px solid Highlight;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
    transition: none !important;
    animation: none !important;
  }
}
`;

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10);
}

export class DateDialog {
  private readonly options: DialogOptions;
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private dialog: HTMLElement | null = null;
  private daySelect: HTMLSelectElement | null = null;
  private monthSelect: HTMLSelectElement | null = null;
  private yearSelect: HTMLSelectElement | null = null;
  private applyButton: HTMLButtonElement | null = null;
  private cancelButton: HTMLButtonElement | null = null;
  private diagnosticsButton: HTMLButtonElement | null = null;
  private busy = false;
  private closed = false;
  private readonly idToken = randomToken();
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  constructor(options: DialogOptions) {
    this.options = options;
    this.keydownHandler = (event) => {
      this.handleKeydown(event);
    };
  }

  open(): void {
    if (this.host) return;
    const host = document.createElement("div");
    host.id = `adp-dialog-host-${this.idToken}`;
    host.setAttribute("data-adp-extension-ui", "true");
    host.style.cssText =
      "all: initial; position: fixed; inset: 0; z-index: 2147483647; display: block;";
    const shadow = host.attachShadow({ mode: "open" });
    this.host = host;
    this.shadow = shadow;

    const style = document.createElement("style");
    style.textContent = STYLE;
    shadow.append(style);

    const backdrop = document.createElement("div");
    backdrop.className = "adp-backdrop";

    const dialog = document.createElement("div");
    dialog.className = "adp-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", `adp-title-${this.idToken}`);
    dialog.tabIndex = -1;
    this.dialog = dialog;

    const title = document.createElement("h1");
    title.className = "adp-title";
    title.id = `adp-title-${this.idToken}`;
    title.textContent = STRINGS.dialogTitle(this.options.label);
    dialog.append(title);

    const fields = document.createElement("div");
    fields.className = "adp-fields";

    const bounds = this.normalizedBounds();
    const initial = this.clampToBounds(this.options.initialDate, bounds);

    this.daySelect = this.createSelect(
      "day",
      STRINGS.dayLabel,
      Array.from({ length: 31 }, (_, index) => ({
        value: String(index + 1),
        text: String(index + 1),
      })),
      fields,
    );
    this.monthSelect = this.createSelect(
      "month",
      STRINGS.monthLabel,
      Array.from({ length: 12 }, (_, index) => ({
        value: String(index + 1),
        text: monthName(index + 1),
      })),
      fields,
    );
    this.yearSelect = this.createSelect(
      "year",
      STRINGS.yearLabel,
      Array.from({ length: bounds.maxYear - bounds.minYear + 1 }, (_, index) => {
        const year = bounds.minYear + index;
        return { value: String(year), text: String(year) };
      }),
      fields,
    );

    this.monthSelect.value = String(initial.month);
    this.yearSelect.value = String(initial.year);
    this.renderDays(initial.month, initial.year, initial.day);
    dialog.append(fields);

    const buttons = document.createElement("div");
    buttons.className = "adp-buttons";

    this.applyButton = this.createButton(
      STRINGS.applyLabel,
      "adp-button adp-button-primary",
      () => {
        void this.apply();
      },
    );
    this.cancelButton = this.createButton(
      STRINGS.cancelLabel,
      "adp-button adp-button-secondary",
      () => {
        this.cancel();
      },
    );
    buttons.append(this.applyButton, this.cancelButton);
    dialog.append(buttons);

    this.diagnosticsButton = this.createButton(
      STRINGS.diagnosticsLabel,
      "adp-button adp-diagnostics",
      () => {
        void this.runDiagnostics();
      },
    );
    dialog.append(this.diagnosticsButton);

    backdrop.append(dialog);
    shadow.append(backdrop);
    document.documentElement.append(host);

    host.addEventListener("keydown", this.keydownHandler, true);

    this.monthSelect.addEventListener("change", () => {
      this.handleMonthYearChange();
    });
    this.yearSelect.addEventListener("change", () => {
      this.handleMonthYearChange();
    });

    window.requestAnimationFrame(() => {
      if (this.daySelect?.isConnected) {
        focusWithoutScroll(this.daySelect);
      }
    });
  }

  private normalizedBounds(): YearBounds {
    const minYear = Math.min(this.options.bounds.minYear, this.options.bounds.maxYear);
    const maxYear = Math.max(this.options.bounds.minYear, this.options.bounds.maxYear);
    return {
      minYear,
      maxYear,
      minDate: this.options.bounds.minDate,
      maxDate: this.options.bounds.maxDate,
    };
  }

  private clampToBounds(date: CivilDate, bounds: YearBounds): CivilDate {
    const year = Math.min(Math.max(date.year, bounds.minYear), bounds.maxYear);
    return clampDate({ year, month: date.month, day: date.day });
  }

  private createSelect(
    name: string,
    labelText: string,
    options: readonly { value: string; text: string }[],
    parent: HTMLElement,
  ): HTMLSelectElement {
    const wrapper = document.createElement("div");
    wrapper.className = "adp-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = `adp-${name}-${this.idToken}`;
    const select = document.createElement("select");
    select.id = `adp-${name}-${this.idToken}`;
    select.name = name;
    select.setAttribute("data-adp-select", name);
    for (const option of options) {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.text;
      select.append(element);
    }
    wrapper.append(label, select);
    parent.append(wrapper);
    return select;
  }

  private createButton(text: string, className: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.addEventListener("click", action);
    return button;
  }

  private renderDays(month: number, year: number, preferredDay: number): void {
    if (!this.daySelect) return;
    const previous = Number(this.daySelect.value) || preferredDay;
    const maximum = Math.max(1, daysInMonth(year, month));
    const day = Math.min(Math.max(1, previous), maximum);
    this.daySelect.replaceChildren();
    for (let index = 1; index <= maximum; index += 1) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = String(index);
      this.daySelect.append(option);
    }
    this.daySelect.value = String(day);
  }

  private handleMonthYearChange(): void {
    if (!this.monthSelect || !this.yearSelect || !this.daySelect) return;
    const month = Number(this.monthSelect.value);
    const year = Number(this.yearSelect.value);
    if (!Number.isInteger(month) || !Number.isInteger(year)) return;
    const previousDay = Number(this.daySelect.value);
    const maximum = daysInMonth(year, month);
    this.renderDays(month, year, previousDay);
    const day = Number(this.daySelect.value);
    if (previousDay > maximum) {
      announce(STRINGS.clampAnnouncement(monthName(month), year, maximum, day), "polite");
    }
  }

  private getSelectedDate(): CivilDate {
    if (!this.daySelect || !this.monthSelect || !this.yearSelect) {
      throw new Error("Dialog controls are unavailable.");
    }
    return clampDate({
      day: Number(this.daySelect.value),
      month: Number(this.monthSelect.value),
      year: Number(this.yearSelect.value),
    });
  }

  private async apply(): Promise<void> {
    if (this.busy || this.closed) return;
    const date = this.getSelectedDate();
    const bounds = this.normalizedBounds();
    if (bounds.minDate && compareCivil(date, bounds.minDate) < 0) {
      announce(STRINGS.notAllowed, "assertive");
      return;
    }
    if (bounds.maxDate && compareCivil(date, bounds.maxDate) > 0) {
      announce(STRINGS.notAllowed, "assertive");
      return;
    }
    this.setBusy(true);
    try {
      await this.options.callbacks.onApply(date);
    } catch {
      this.setBusy(false);
    }
  }

  private cancel(): void {
    if (this.closed) return;
    if (this.busy) {
      announce(STRINGS.dialogBusy, "assertive");
      return;
    }
    this.options.callbacks.onCancel();
  }

  private async runDiagnostics(): Promise<void> {
    if (this.busy) return;
    try {
      await this.options.callbacks.onDiagnostics();
    } catch {
      announce(STRINGS.reportCopyFailed, "assertive");
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    // Page listeners must not consume dialog keys. Default select behaviour still runs.
    event.stopPropagation();
    if (this.closed) return;
    const pathTarget = event.composedPath()[0];
    const target = pathTarget instanceof HTMLElement ? pathTarget : null;

    if (event.key === "Escape") {
      event.preventDefault();
      this.cancel();
      return;
    }

    if (event.key === "Tab") {
      if (!this.shadow) return;
      const focusable = this.focusableElements();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const currentIndex = target ? focusable.indexOf(target) : -1;
      let nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex === -1) nextIndex = event.shiftKey ? focusable.length - 1 : 0;
      if (nextIndex < 0) nextIndex = focusable.length - 1;
      if (nextIndex >= focusable.length) nextIndex = 0;
      const next = focusable[nextIndex];
      if (next) {
        event.preventDefault();
        focusWithoutScroll(next);
      }
      return;
    }

    if (event.key === "Enter") {
      // Enter applies from the selects as well. Alt+Enter and other modified
      // presses are left to the browser so select handling is not disturbed.
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
      event.preventDefault();
      void this.apply();
    }
  }

  private focusableElements(): HTMLElement[] {
    if (!this.shadow) return [];
    const candidates = this.shadow.querySelectorAll<HTMLElement>(
      "select:not(:disabled), button:not(:disabled)",
    );
    return [...candidates].filter((element) => element.isConnected);
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.dialog?.setAttribute("aria-busy", busy ? "true" : "false");
    for (const control of [
      this.daySelect,
      this.monthSelect,
      this.yearSelect,
      this.applyButton,
      this.diagnosticsButton,
      this.cancelButton,
    ]) {
      if (control) control.disabled = busy;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.host) {
      this.host.removeEventListener("keydown", this.keydownHandler, true);
      this.host.remove();
    }
    this.host = null;
    this.shadow = null;
    this.dialog = null;
    this.daySelect = null;
    this.monthSelect = null;
    this.yearSelect = null;
    this.applyButton = null;
    this.cancelButton = null;
    this.diagnosticsButton = null;
  }

  focusFirst(): void {
    if (this.daySelect?.isConnected) {
      focusWithoutScroll(this.daySelect);
    }
  }

  isOpen(): boolean {
    return this.host !== null && !this.closed;
  }

  isBusy(): boolean {
    return this.busy;
  }

  selectedDate(): CivilDate {
    return this.getSelectedDate();
  }

  selectDay(day: number): void {
    if (!this.daySelect) return;
    this.daySelect.value = String(day);
  }

  isDateWithinBounds(date: CivilDate): boolean {
    const bounds = this.normalizedBounds();
    if (bounds.minDate && compareCivil(date, bounds.minDate) < 0) return false;
    if (bounds.maxDate && compareCivil(date, bounds.maxDate) > 0) return false;
    return !sameDate(date, { year: 0, month: 0, day: 0 });
  }
}

function compareCivil(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}
