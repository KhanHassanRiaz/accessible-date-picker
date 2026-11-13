import { compareDates, type CivilDate } from "../shared/date.js";
import { verifyFieldValue } from "../shared/verify.js";
import {
  analyzeCalendar,
  findCalendarCandidate,
  findMonthOption,
  findMonthSelect,
  findYearInput,
  findYearOption,
  findYearSelect,
  snapshotVisibleElements,
  type CalendarCell,
  type CalendarView,
} from "./calendar.js";
import {
  allRoots,
  dispatchClickSequence,
  dispatchKey,
  focusWithoutScroll,
  hasDisabledAncestor,
  isControlDisabled,
  isVisible,
  nativeInputValueSetter,
  nativeSelectValueSetter,
  dispatchInputEvents,
  shortText,
  waitForMutationOrTimeout,
} from "./dom.js";

export type DriverStatus = "success" | "not-found" | "not-allowed" | "stuck" | "failed";
export type DriverMode = "day" | "month-year";

export interface DriverLogEntry {
  step: number;
  elapsedMs: number;
  action: string;
  detail: string;
}

export interface CalendarDriverResult {
  status: DriverStatus;
  mode: DriverMode;
  value: string;
  detail: string;
  log: DriverLogEntry[];
  calendarElement: Element | null;
}

class DriverStop extends Error {
  readonly status: DriverStatus;

  constructor(status: DriverStatus, message: string) {
    super(message);
    this.name = "DriverStop";
    this.status = status;
  }
}

// Calendar widgets commonly animate view changes for 200 to 300 ms and ignore
// input while they animate. The budget is larger than the old ten seconds so
// the driver can wait for those animations without running out of time.
const TIME_BUDGET_MS = 20_000;
const STEP_LIMIT = 40;
const SETTLE_FIRST_MUTATION_MS = 500;
const SETTLE_QUIET_MS = 150;
const SETTLE_MAX_MS = 1_000;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function currentMonthIndex(view: CalendarView): number | null {
  if (view.year === null || view.month === null) return null;
  return view.year * 12 + (view.month - 1);
}

export class CalendarDriver {
  private readonly field: HTMLInputElement;
  private readonly target: CivilDate;
  private readonly startedAt = performance.now();
  private readonly log: DriverLogEntry[] = [];
  private steps = 0;
  private mode: DriverMode = "day";
  private lastView: CalendarView | null = null;
  private lastCalendar: Element | null = null;
  private noChangeStreak = 0;

  constructor(field: HTMLInputElement, target: CivilDate) {
    this.field = field;
    this.target = target;
  }

  async run(): Promise<CalendarDriverResult> {
    if (this.field.disabled) {
      return this.result("not-allowed", "the field is disabled", null);
    }
    this.logStep("start", `target ${this.target.year}-${this.target.month}-${this.target.day}`);
    let root: Element | null = null;
    try {
      root = await this.openCalendar();
      if (!root) {
        return this.result("not-found", "no calendar popup appeared", null);
      }
      this.lastCalendar = root;
      let view = await this.readStableView();
      if (!view) {
        root = this.refreshCalendar() ?? root;
        view = await this.readStableView();
      }
      if (!view) {
        return this.result("failed", "the calendar view could not be recognized", root);
      }
      this.lastView = view;
      await this.execute(view);
      await sleep(120);
      await this.closeCalendarIfOpen();
      await sleep(120);
      const finalValue = this.field.value;
      return {
        status: "success",
        mode: this.mode,
        value: finalValue,
        detail: "calendar operation completed",
        log: this.log,
        calendarElement: this.lastCalendar,
      };
    } catch (error) {
      const stop =
        error instanceof DriverStop
          ? error
          : new DriverStop("failed", error instanceof Error ? error.message : String(error));
      try {
        await this.closeCalendarIfOpen();
      } catch {
        // Closing is best effort.
      }
      await sleep(60);
      const calendar = this.lastCalendar;
      return {
        status: stop.status,
        mode: this.mode,
        value: this.field.value,
        detail: stop.message,
        log: this.log,
        calendarElement: calendar,
      };
    }
  }

  private result(
    status: DriverStatus,
    detail: string,
    calendarElement: Element | null,
  ): CalendarDriverResult {
    return {
      status,
      mode: this.mode,
      value: this.field.value,
      detail,
      log: this.log,
      calendarElement,
    };
  }

  private logStep(action: string, detail: string): void {
    this.log.push({
      step: this.steps,
      elapsedMs: Math.round(performance.now() - this.startedAt),
      action,
      detail,
    });
  }

  private checkBudget(): void {
    if (performance.now() - this.startedAt > TIME_BUDGET_MS) {
      throw new DriverStop(
        "stuck",
        `the ${TIME_BUDGET_MS / 1_000} second calendar time budget was exceeded`,
      );
    }
    if (this.steps >= STEP_LIMIT) {
      throw new DriverStop("stuck", `the ${STEP_LIMIT} step calendar limit was reached`);
    }
  }

  private async openCalendar(): Promise<Element | null> {
    const visibleBefore = snapshotVisibleElements();
    const existing = findCalendarCandidate(this.field);
    if (existing && this.recognizeCalendar(existing)) {
      await this.waitForActionSettled();
      this.logStep("calendar", "found an already open calendar");
      return this.refreshCalendar() ?? existing;
    }

    focusWithoutScroll(this.field);
    await this.waitForActionSettled();
    const afterFocus = findCalendarCandidate(this.field);
    if (afterFocus && this.recognizeCalendar(afterFocus)) {
      await this.waitForActionSettled();
      this.logStep("calendar", "calendar opened when the field received focus");
      return this.refreshCalendar() ?? afterFocus;
    }

    if (this.field.disabled) throw new DriverStop("not-allowed", "the field is disabled");
    this.steps += 1;
    this.logStep("click field", "requested the field calendar");
    dispatchClickSequence(this.field);
    let found = await this.waitForCalendar(visibleBefore, 600);
    if (found) return found;

    const buttons = this.findCalendarButtons();
    for (const button of buttons.slice(0, 4)) {
      if (!button.isConnected || !isVisible(button) || isControlDisabled(button)) continue;
      if (this.steps >= STEP_LIMIT || performance.now() - this.startedAt > TIME_BUDGET_MS) break;
      const snapshot = snapshotVisibleElements();
      this.steps += 1;
      this.logStep("click calendar button", shortText(button, 80) || "icon button");
      dispatchClickSequence(button);
      found = await this.waitForCalendar(snapshot, 600);
      if (found) return found;
    }
    return null;
  }

  private recognizeCalendar(element: Element): CalendarView | null {
    const view = analyzeCalendar(element);
    return view && view.kind !== "unknown" ? view : null;
  }

  private async waitForCalendar(
    beforeVisible: Set<Element>,
    timeoutMs: number,
  ): Promise<Element | null> {
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      const candidate =
        findCalendarCandidate(this.field, beforeVisible) ?? findCalendarCandidate(this.field);
      if (candidate && this.recognizeCalendar(candidate)) {
        await this.waitForActionSettled();
        const settled = this.refreshCalendar() ?? candidate;
        if (this.recognizeCalendar(settled)) {
          this.logStep("calendar", "calendar popup detected");
          return settled;
        }
      }
      await waitForMutationOrTimeout(Math.min(80, Math.max(10, deadline - performance.now())));
    }
    return null;
  }

  /**
   * Waits until the page has stopped changing after an action. Calendar
   * widgets often animate for a quarter of a second and ignore clicks during
   * that time, so reading or clicking too early either sees a half-moved view
   * or has the click discarded.
   */
  private async waitForActionSettled(): Promise<void> {
    const firstMutation = await waitForMutationOrTimeout(SETTLE_FIRST_MUTATION_MS);
    if (!firstMutation) {
      await this.waitForRunningAnimations(300);
      return;
    }
    const deadline = performance.now() + SETTLE_MAX_MS;
    while (performance.now() < deadline) {
      const remaining = Math.max(1, deadline - performance.now());
      const mutated = await waitForMutationOrTimeout(Math.min(SETTLE_QUIET_MS, remaining));
      if (!mutated) break;
    }
    await this.waitForRunningAnimations(300);
  }

  private async waitForRunningAnimations(timeoutMs: number): Promise<void> {
    const root = this.lastCalendar;
    if (!root) return;
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      let running = false;
      try {
        running = root
          .getAnimations({ subtree: true })
          .some((animation) => animation.playState === "running");
      } catch {
        return;
      }
      if (!running) return;
      await sleep(50);
    }
  }

  private async readStableView(): Promise<CalendarView | null> {
    let view = this.readView();
    let previousSignature = view?.signature ?? null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await sleep(70);
      view = this.readView();
      const signature = view?.signature ?? null;
      if (signature === previousSignature) return view;
      previousSignature = signature;
    }
    return view;
  }

  private findCalendarButtons(): Element[] {
    const candidates: Element[] = [];
    const roots = allRoots();
    const id = this.field.id;
    if (id) {
      for (const root of roots) {
        for (const controlled of root.querySelectorAll("[aria-controls]")) {
          const controls = (controlled.getAttribute("aria-controls") ?? "").split(/\s+/);
          if (!controls.includes(id)) continue;
          if (isVisible(controlled) && !isControlDisabled(controlled)) candidates.push(controlled);
        }
      }
    }

    let current: Element | null = this.field;
    for (let depth = 0; depth < 4; depth += 1) {
      const near: Element | null = current.parentElement;
      if (!near) break;
      for (const element of near.querySelectorAll(
        "button, input[type='image'], [role='button'], a, span[class*='calendar' i], span[class*='date' i], i[class*='calendar' i]",
      )) {
        if (element === this.field || !isVisible(element) || isControlDisabled(element)) continue;
        const hints = `${element.getAttribute("aria-label") ?? ""} ${
          element.getAttribute("title") ?? ""
        } ${element.getAttribute("alt") ?? ""} ${
          typeof element.className === "string" ? element.className : ""
        } ${shortText(element, 40)}`;
        if (!/(calendar|date|picker|icon)/i.test(hints) && element.querySelector("svg") === null) {
          continue;
        }
        candidates.push(element);
      }
      current = near;
    }
    return [...new Set(candidates)];
  }

  private refreshCalendar(): Element | null {
    if (
      this.lastCalendar?.isConnected &&
      isVisible(this.lastCalendar) &&
      this.recognizeCalendar(this.lastCalendar)
    ) {
      return this.lastCalendar;
    }
    const found = findCalendarCandidate(this.field);
    if (found && this.recognizeCalendar(found)) return found;
    return null;
  }

  private readView(): CalendarView | null {
    const root = this.refreshCalendar();
    if (!root) {
      this.lastView = null;
      return null;
    }
    const view = analyzeCalendar(root);
    this.lastView = view;
    if (view) this.lastCalendar = root;
    return view;
  }

  private async click(element: Element, action: string, allowNoChange = false): Promise<boolean> {
    this.checkBudget();
    if (!element.isConnected || !isVisible(element)) {
      throw new DriverStop("failed", `${action}: the control is no longer visible`);
    }
    if (isControlDisabled(element) || hasDisabledAncestor(element, this.lastView?.root)) {
      throw new DriverStop("not-allowed", `${action}: the control is disabled`);
    }
    const beforeField = this.field.value;
    const beforeSignature = this.lastView?.signature ?? null;
    this.steps += 1;
    const clickStarted = performance.now();
    dispatchClickSequence(element);
    await this.waitForActionSettled();
    const next = await this.readStableView();
    this.logStep(
      action,
      `${Math.round(performance.now() - clickStarted)} ms, ${next?.kind ?? "closed"}`,
    );
    const changed =
      this.field.value !== beforeField ||
      next === null ||
      (beforeSignature !== null && next.signature !== beforeSignature);
    if (changed) {
      this.noChangeStreak = 0;
    } else {
      this.noChangeStreak += 1;
    }
    if (!allowNoChange && this.noChangeStreak >= 2) {
      throw new DriverStop("stuck", `${action}: the calendar did not change`);
    }
    return changed;
  }

  private async setControls(includeMonth: boolean): Promise<boolean> {
    this.checkBudget();
    let interacted = false;
    let root = this.lastView?.root;
    if (!root) return false;

    const yearSelect = findYearSelect(root);
    if (yearSelect) {
      const option = findYearOption(yearSelect, this.target.year);
      if (option) {
        nativeSelectValueSetter(yearSelect, option.value);
        dispatchInputEvents(yearSelect);
        interacted = true;
        this.logStep("set year select", String(this.target.year));
        await this.waitForActionSettled();
        root = (await this.readStableView())?.root ?? root;
      }
    } else {
      const yearInput = findYearInput(root);
      if (yearInput) {
        nativeInputValueSetter(yearInput, String(this.target.year));
        dispatchInputEvents(yearInput);
        interacted = true;
        this.logStep("set year input", String(this.target.year));
        await this.waitForActionSettled();
        root = (await this.readStableView())?.root ?? root;
      }
    }

    if (includeMonth) {
      const monthSelect = findMonthSelect(root);
      if (monthSelect) {
        const option = findMonthOption(monthSelect, this.target.month);
        if (option) {
          nativeSelectValueSetter(monthSelect, option.value);
          dispatchInputEvents(monthSelect);
          interacted = true;
          this.logStep("set month select", String(this.target.month));
          await this.waitForActionSettled();
          await this.readStableView();
        }
      }
    }
    if (interacted) this.noChangeStreak = 0;
    return interacted;
  }

  private async clickDay(view: CalendarView): Promise<void> {
    if (view.year !== this.target.year || view.month !== this.target.month) {
      throw new DriverStop("failed", "attempted to choose a day in the wrong month");
    }
    const candidates = view.dayCells.filter((cell) => cell.value === this.target.day);
    const exact =
      candidates.find(
        (cell) =>
          cell.date?.year === this.target.year &&
          cell.date.month === this.target.month &&
          cell.date.day === this.target.day,
      ) ?? candidates.find((cell) => cell.date === null);
    const cell: CalendarCell | undefined = exact ?? candidates[0];
    if (!cell) {
      throw new DriverStop("failed", `day ${this.target.day} was not present in the calendar`);
    }
    if (cell.disabled) {
      throw new DriverStop("not-allowed", `day ${this.target.day} is disabled`);
    }
    const beforeField = this.field.value;
    const beforeSignature = view.signature;
    this.steps += 1;
    const started = performance.now();
    dispatchClickSequence(cell.element);
    await this.waitForActionSettled();
    let next = await this.readStableView();
    if (next && this.field.value === beforeField && next.signature === beforeSignature) {
      await sleep(300);
      next = await this.readStableView();
    }
    this.logStep("click day", `${Math.round(performance.now() - started)} ms`);
    if (next && this.field.value === beforeField && next.signature === beforeSignature) {
      const alreadyCorrect = verifyFieldValue(this.field.value, this.target, "day").ok;
      if (alreadyCorrect) return;
      throw new DriverStop("stuck", "the day click did not change the date");
    }
    this.mode = "day";
  }

  private async execute(initialView: CalendarView): Promise<void> {
    const initialKind = initialView.kind;
    let view: CalendarView | null = initialView;
    if (initialKind === "month" || initialKind === "year" || initialKind === "decade") {
      this.mode = "month-year";
    }
    let directTried = false;
    let zoomTried = false;
    let zoomAttempts = 0;
    let monthZoomTried = false;
    let safety = 0;

    for (;;) {
      safety += 1;
      if (safety > 80) throw new DriverStop("stuck", "the calendar entered an unexpected loop");
      this.checkBudget();
      switch (view.kind) {
        case "day": {
          this.mode = "day";
          if (view.year === this.target.year && view.month === this.target.month) {
            await this.clickDay(view);
            return;
          }

          if (!directTried) {
            directTried = true;
            const interacted = await this.setControls(true);
            if (interacted) {
              view = await this.readStableView();
              if (!view) {
                this.mode = "month-year";
                return;
              }
              continue;
            }
          }

          if (!zoomTried) {
            if (!view.header) {
              zoomTried = true;
              continue;
            }
            if (zoomAttempts < 3) {
              const beforeSignature = view.signature;
              await this.click(view.header, "open month or year view", true);
              zoomAttempts += 1;
              const next = await this.readStableView();
              if (!next) {
                throw new DriverStop("failed", "the calendar closed while opening the month view");
              }
              if (next.kind !== "day" || next.signature !== beforeSignature) {
                view = next;
                continue;
              }
            }
            zoomTried = true;
            continue;
          }

          view = await this.navigateMonth(view);
          continue;
        }

        case "month": {
          if (view.year === null) {
            throw new DriverStop("failed", "the calendar month view has no readable year");
          }
          if (view.year !== this.target.year) {
            const direct = await this.setControls(false);
            if (direct) {
              view = await this.readStableView();
              if (!view) {
                this.mode = "month-year";
                return;
              }
              continue;
            }

            // Prefer the header's zoom control. It usually opens a year grid,
            // which reaches a distant year in a few pages instead of dozens of
            // one-year steps.
            if (!monthZoomTried && view.header) {
              monthZoomTried = true;
              const beforeSignature = view.signature;
              await this.click(view.header, "open year view", true);
              const zoomed = await this.readStableView();
              if (
                zoomed &&
                zoomed.signature !== beforeSignature &&
                (zoomed.kind === "year" || zoomed.kind === "decade")
              ) {
                view = zoomed;
                continue;
              }
            }

            view = await this.navigateYear(view);
            continue;
          }

          const cell = view.monthCells.find((entry) => entry.value === this.target.month);
          if (!cell) {
            throw new DriverStop("failed", "the requested month is not visible");
          }
          if (cell.disabled) {
            throw new DriverStop("not-allowed", "the requested month is disabled");
          }
          const beforeField = this.field.value;
          await this.click(cell.element, "choose month");
          const next = await this.readStableView();
          if (!next) {
            this.mode = "month-year";
            return;
          }
          if (next.kind === "day") {
            this.mode = "day";
            view = next;
            continue;
          }
          if (next.kind === "month") {
            this.mode = "month-year";
            if (this.field.value !== beforeField) return;
            throw new DriverStop("stuck", "the month click did not open a day view");
          }
          view = next;
          continue;
        }

        case "year": {
          const yearCell = view.yearCells.find((entry) => entry.value === this.target.year);
          if (yearCell) {
            if (yearCell.disabled) {
              throw new DriverStop("not-allowed", "the requested year is disabled");
            }
            await this.click(yearCell.element, "choose year");
            const next = await this.readStableView();
            if (!next) {
              this.mode = "month-year";
              return;
            }
            view = next;
            continue;
          }
          view = await this.navigateYearGrid(view);
          continue;
        }

        case "decade": {
          const decade = view.decadeCells.find(
            (cell) =>
              !cell.disabled && this.target.year >= cell.start && this.target.year <= cell.end,
          );
          if (decade) {
            await this.click(decade.element, "choose decade");
            const next = await this.readStableView();
            if (!next) {
              this.mode = "month-year";
              return;
            }
            view = next;
            continue;
          }
          view = await this.navigateDecade(view);
          continue;
        }

        case "unknown": {
          await this.waitForActionSettled();
          const next = await this.readStableView();
          if (!next || next.kind === "unknown") {
            throw new DriverStop("failed", "the calendar view could not be recognized");
          }
          view = next;
          continue;
        }
      }
    }
    throw new DriverStop("failed", "the calendar disappeared unexpectedly");
  }

  private async navigateMonth(view: CalendarView): Promise<CalendarView> {
    const current = currentMonthIndex(view);
    if (current === null) throw new DriverStop("failed", "the displayed month is unknown");
    const targetIndex = this.target.year * 12 + (this.target.month - 1);
    const direction = targetIndex > current ? "next" : "prev";
    const control = direction === "next" ? view.next : view.prev;
    if (!control) throw new DriverStop("failed", `the ${direction} month control was not found`);
    if (isControlDisabled(control)) {
      throw new DriverStop("not-allowed", `the ${direction} month control is disabled`);
    }
    await this.click(control, `go to ${direction} month`);
    const next = await this.readStableView();
    if (!next) throw new DriverStop("failed", "the calendar closed while changing months");
    if (next.kind !== "day") return next;
    if (next.signature === view.signature) {
      throw new DriverStop("stuck", "the month did not change");
    }
    return next;
  }

  private async navigateYear(view: CalendarView): Promise<CalendarView> {
    if (view.year === null) throw new DriverStop("failed", "the displayed year is unknown");
    const direction = this.target.year > view.year ? "next" : "prev";
    const control = direction === "next" ? view.next : view.prev;
    if (!control) throw new DriverStop("failed", `the ${direction} year control was not found`);
    if (isControlDisabled(control)) {
      throw new DriverStop("not-allowed", `the ${direction} year control is disabled`);
    }
    await this.click(control, `go to ${direction} year`);
    const next = await this.readStableView();
    if (!next) throw new DriverStop("failed", "the calendar closed while changing years");
    return next;
  }

  private async navigateYearGrid(view: CalendarView): Promise<CalendarView> {
    const years = view.yearCells.map((cell) => cell.value);
    if (!years.length) throw new DriverStop("failed", "no year cells were found");
    const min = Math.min(...years);
    const max = Math.max(...years);
    const direction = this.target.year < min ? "prev" : this.target.year > max ? "next" : null;
    if (direction === null) {
      throw new DriverStop("failed", "the requested year is not present in the year grid");
    }
    const control = direction === "next" ? view.next : view.prev;
    if (!control) throw new DriverStop("failed", `the ${direction} year control was not found`);
    if (isControlDisabled(control)) {
      throw new DriverStop("not-allowed", `the ${direction} year control is disabled`);
    }
    await this.click(control, `go to ${direction} year page`);
    const next = await this.readStableView();
    if (!next) throw new DriverStop("failed", "the calendar closed while changing year pages");
    return next;
  }

  private async navigateDecade(view: CalendarView): Promise<CalendarView> {
    const cells = view.decadeCells;
    if (!cells.length) throw new DriverStop("failed", "no decade cells were found");
    const min = Math.min(...cells.map((cell) => cell.start));
    const max = Math.max(...cells.map((cell) => cell.end));
    const direction = this.target.year < min ? "prev" : "next";
    const control = direction === "next" ? view.next : view.prev;
    if (!control) throw new DriverStop("failed", `the ${direction} decade control was not found`);
    if (isControlDisabled(control)) {
      throw new DriverStop("not-allowed", `the ${direction} decade control is disabled`);
    }
    if (this.target.year <= max && this.target.year >= min) {
      throw new DriverStop("not-allowed", "the requested year is disabled");
    }
    await this.click(control, `go to ${direction} decade`);
    const next = await this.readStableView();
    if (!next) throw new DriverStop("failed", "the calendar closed while changing decades");
    return next;
  }

  private async closeCalendarIfOpen(): Promise<void> {
    if (
      !this.lastCalendar?.isConnected ||
      !isVisible(this.lastCalendar) ||
      !this.recognizeCalendar(this.lastCalendar)
    ) {
      return;
    }
    this.logStep("close calendar", "pressing Escape");
    dispatchKey(document, "Escape");
    await sleep(120);
    if (isVisible(this.lastCalendar) && this.recognizeCalendar(this.lastCalendar)) {
      this.logStep("close calendar", "clicking outside the calendar");
      dispatchClickSequence(document.body, { x: 1, y: 1 });
      await sleep(120);
    }
  }
}

export function compareDriverDates(a: CivilDate, b: CivilDate): number {
  return compareDates(a, b);
}
