import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeCalendar,
  findCalendarCandidate,
  findMonthOption,
  findMonthSelect,
  findYearInput,
  findYearOption,
  findYearSelect,
} from "../../src/content/calendar.js";

function dayCalendar(options: { outsideDay?: number; disabledDay?: number } = {}): void {
  const days = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const classes = [
      options.outsideDay === day ? "outside" : "",
      options.disabledDay === day ? "disabled" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const padded = String(day).padStart(2, "0");
    return `<td data-date="2026-03-${padded}" class="${classes}">${day}</td>`;
  });
  const rows: string[] = [];
  for (let index = 0; index < days.length; index += 7) {
    rows.push(`<tr>${days.slice(index, index + 7).join("")}</tr>`);
  }
  document.body.innerHTML = `
    <input id="field" />
    <div class="datepicker">
      <div class="datepicker-header">
        <button class="prev" aria-label="Previous month">‹</button>
        <span class="datepicker-switch">March 2026</span>
        <button class="next" aria-label="Next month">›</button>
      </div>
      <table><tbody>${rows.join("")}</tbody></table>
    </div>
  `;
}

beforeEach(() => {
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return [this.getBoundingClientRect()] as unknown as DOMRectList;
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
    return {
      x: 10,
      y: 10,
      width: 200,
      height: 200,
      top: 10,
      left: 10,
      right: 210,
      bottom: 210,
      toJSON: () => ({}),
    };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("calendar view analysis", () => {
  it("recognizes a day grid and reads its header", () => {
    dayCalendar();
    const root = document.querySelector(".datepicker")!;
    const view = analyzeCalendar(root);
    expect(view).not.toBeNull();
    expect(view?.kind).toBe("day");
    expect(view?.year).toBe(2026);
    expect(view?.month).toBe(3);
    expect(view?.headerText).toContain("March 2026");
    expect(view?.dayCells).toHaveLength(31);
    expect(view?.prev).not.toBeNull();
    expect(view?.next).not.toBeNull();
  });

  it("marks disabled cells and drops outside-month cells", () => {
    dayCalendar({ outsideDay: 1, disabledDay: 2 });
    const view = analyzeCalendar(document.querySelector(".datepicker")!);
    expect(view?.dayCells.some((cell) => cell.value === 1)).toBe(false);
    expect(view?.dayCells.find((cell) => cell.value === 2)?.disabled).toBe(true);
    expect(view?.dayCells.find((cell) => cell.value === 3)?.disabled).toBe(false);
  });

  it("recognizes a month grid and derives the year from the header", () => {
    document.body.innerHTML = `
      <div class="picker">
        <div class="picker-title">2026</div>
        <table><tbody><tr>
          <td>January</td><td>February</td><td>March</td><td>April</td>
          <td>May</td><td>June</td><td>July</td><td>August</td>
          <td>September</td><td>October</td><td>November</td><td>December</td>
        </tr></tbody></table>
      </div>
    `;
    const view = analyzeCalendar(document.querySelector(".picker")!);
    expect(view?.kind).toBe("month");
    expect(view?.monthCells).toHaveLength(12);
    expect(view?.year).toBe(2026);
  });

  it("recognizes a year grid", () => {
    document.body.innerHTML = `
      <div class="picker">
        <div class="picker-title">2020-2031</div>
        <table><tbody><tr>
          ${Array.from({ length: 12 }, (_, index) => `<td>${2020 + index}</td>`).join("")}
        </tr></tbody></table>
      </div>
    `;
    const view = analyzeCalendar(document.querySelector(".picker")!);
    expect(view?.kind).toBe("year");
    expect(view?.yearCells).toHaveLength(12);
    expect(view?.year).toBe(2020);
  });

  it("recognizes a decade grid", () => {
    document.body.innerHTML = `
      <div class="picker">
        <table><tbody><tr>
          <td>2010-2019</td><td>2020-2029</td><td>2030-2039</td><td>2040-2049</td>
        </tr></tbody></table>
      </div>
    `;
    const view = analyzeCalendar(document.querySelector(".picker")!);
    expect(view?.kind).toBe("decade");
    expect(view?.decadeCells).toHaveLength(4);
    expect(view?.decadeCells[1]).toMatchObject({ start: 2020, end: 2029 });
  });

  it("returns null for a disconnected root", () => {
    const root = document.createElement("div");
    expect(analyzeCalendar(root)).toBeNull();
  });
});

describe("calendar controls", () => {
  it("finds month and year selects", () => {
    document.body.innerHTML = `
      <div class="picker">
        <select id="months">
          <option>January</option><option>February</option><option>March</option>
          <option>April</option><option>May</option><option>June</option>
          <option>July</option><option>August</option><option>September</option>
          <option>October</option><option>November</option><option>December</option>
        </select>
        <select id="years"><option>2025</option><option>2026</option></select>
      </div>
    `;
    expect(findMonthSelect(document.querySelector(".picker")!)?.id).toBe("months");
    expect(findYearSelect(document.querySelector(".picker")!)?.id).toBe("years");
  });

  it("finds a year input by its name or by its value", () => {
    document.body.innerHTML = `
      <div class="picker">
        <input class="cur-year" value="2026" />
        <input id="other" value="2025" />
      </div>
    `;
    expect(findYearInput(document.querySelector(".picker")!)?.className).toBe("cur-year");

    document.body.innerHTML = `<div class="picker"><input value="2025" /></div>`;
    expect(findYearInput(document.querySelector(".picker")!)?.value).toBe("2025");
  });

  it("finds matching month and year options", () => {
    const select = document.createElement("select");
    select.innerHTML = "<option>Jan</option><option>Feb</option><option>Mar</option>";
    const yearSelect = document.createElement("select");
    yearSelect.innerHTML = "<option>2025</option><option>2026</option>";
    expect(findMonthOption(select, 3)?.textContent).toBe("Mar");
    expect(findYearOption(yearSelect, 2026)?.textContent).toBe("2026");
    expect(findMonthOption(select, 12)).toBeNull();
    expect(findYearOption(yearSelect, 2030)).toBeNull();
  });
});

describe("calendar candidate discovery", () => {
  it("finds a visible calendar-like container", () => {
    dayCalendar();
    const field = document.getElementById("field")!;
    const candidate = findCalendarCandidate(field);
    expect(candidate).not.toBeNull();
    expect(candidate?.classList.contains("datepicker")).toBe(true);
  });

  it("returns null when no calendar is present", () => {
    document.body.innerHTML = `<input id="field" /><p>Nothing here</p>`;
    expect(findCalendarCandidate(document.getElementById("field")!)).toBeNull();
  });
});
