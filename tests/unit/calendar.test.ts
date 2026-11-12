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

function clipAwareRects(): void {
  const bodyTop = 100;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const view = this.closest(".ajax__calendar_body > div");
    const isBody = this.classList.contains("ajax__calendar_body");
    const height = isBody ? 139 : 20;
    const top = isBody
      ? bodyTop
      : view
        ? bodyTop + (Number.parseFloat((view as HTMLElement).style.top) || 0)
        : 80;
    return {
      x: 10,
      y: top,
      width: 186,
      height,
      top,
      left: 10,
      right: 196,
      bottom: top + height,
      toJSON: () => ({}),
    };
  });
}

function extenderMarkup(active: "days" | "months" | "years" = "days"): string {
  const top = (name: string): string => (name === active ? "0px" : "139px");
  const titles: Record<string, string> = {
    days: "March 2026",
    months: "2026",
    years: "2020-2029",
  };
  const days = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const classes = day === 5 ? ' class="ajax__calendar_invalid"' : "";
    return `<td${classes}><div class="ajax__calendar_day" title="March ${day}, 2026 (weekday)">${day}</div></td>`;
  }).join("");
  const months = Array.from(
    { length: 12 },
    (_, index) => `<td><div class="ajax__calendar_month">${MONTH_LABELS[index]}</div></td>`,
  ).join("");
  const years = Array.from(
    { length: 10 },
    (_, index) => `<td><div class="ajax__calendar_year">${2020 + index}</div></td>`,
  ).join("");
  return `
    <div class="ajax__calendar">
      <div class="ajax__calendar_header">
        <div class="ajax__calendar_prev">‹</div>
        <div class="ajax__calendar_title">${titles[active]}</div>
        <div class="ajax__calendar_next">›</div>
      </div>
      <div class="ajax__calendar_body" style="position: relative; height: 139px; overflow: hidden">
        <div class="ajax__calendar_days" style="position: absolute; top: ${top("days")}">
          <table><tbody>
            <tr><td class="ajax__calendar_other"><div class="ajax__calendar_day" title="February 28, 2026">28</div></td></tr>
            <tr>${days}</tr>
          </tbody></table>
        </div>
        <div class="ajax__calendar_months" style="position: absolute; top: ${top("months")}">
          <table><tbody><tr>${months}</tr></tbody></table>
        </div>
        <div class="ajax__calendar_years" style="position: absolute; top: ${top("years")}">
          <table><tbody><tr>${years}</tr></tbody></table>
        </div>
      </div>
    </div>
  `;
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

describe("ASP.NET AJAX CalendarExtender popup", () => {
  it("reads only the active day view and drops clipped inactive views", () => {
    clipAwareRects();
    document.body.innerHTML = `<input id="field" />${extenderMarkup("days")}`;
    const view = analyzeCalendar(document.querySelector(".ajax__calendar")!);
    expect(view?.kind).toBe("day");
    expect(view?.year).toBe(2026);
    expect(view?.month).toBe(3);
    expect(view?.dayCells).toHaveLength(31);
    expect(view?.monthCells).toHaveLength(0);
    expect(view?.yearCells).toHaveLength(0);
    expect(view?.header?.classList.contains("ajax__calendar_title")).toBe(true);
    expect(view?.dayCells.filter((cell) => cell.outside)).toHaveLength(0);
    expect(view?.dayCells.some((cell) => cell.date?.month === 2)).toBe(false);
  });

  it("reads the active month view even though the day view stays in the DOM", () => {
    clipAwareRects();
    document.body.innerHTML = `<input id="field" />${extenderMarkup("months")}`;
    const view = analyzeCalendar(document.querySelector(".ajax__calendar")!);
    expect(view?.kind).toBe("month");
    expect(view?.year).toBe(2026);
    expect(view?.monthCells).toHaveLength(12);
    expect(view?.dayCells).toHaveLength(0);
  });

  it("reads the active year view and its range title", () => {
    clipAwareRects();
    document.body.innerHTML = `<input id="field" />${extenderMarkup("years")}`;
    const view = analyzeCalendar(document.querySelector(".ajax__calendar")!);
    expect(view?.kind).toBe("year");
    expect(view?.yearCells).toHaveLength(10);
    expect(view?.yearCells[0]?.value).toBe(2020);
    expect(view?.yearCells[9]?.value).toBe(2029);
    expect(view?.dayCells).toHaveLength(0);
    expect(view?.monthCells).toHaveLength(0);
  });

  it("marks ajax__calendar_invalid days as disabled", () => {
    clipAwareRects();
    document.body.innerHTML = `<input id="field" />${extenderMarkup("days")}`;
    const view = analyzeCalendar(document.querySelector(".ajax__calendar")!);
    expect(view?.dayCells.find((cell) => cell.value === 5)?.disabled).toBe(true);
    expect(view?.dayCells.find((cell) => cell.value === 6)?.disabled).toBe(false);
  });
});

function plainDayTable(caption = ""): string {
  return `<table>${caption ? `<caption>${caption}</caption>` : ""}<tbody><tr>${Array.from(
    { length: 31 },
    (_, index) => `<td>${index + 1}</td>\n`,
  ).join("")}</tr></tbody></table>`;
}

describe("calendar candidate rejection", () => {
  it("prefers the CalendarExtender popup inside a large form over the form", () => {
    clipAwareRects();
    const fields = Array.from(
      { length: 13 },
      (_, index) => `<input name="extra${index}" value="${index}" />`,
    ).join("");
    document.body.innerHTML = `
      <form id="aspnetForm">
        ${fields}
        <input id="field" />
        ${extenderMarkup("days")}
      </form>
    `;
    const candidate = findCalendarCandidate(document.getElementById("field")!);
    expect(candidate).not.toBeNull();
    expect(candidate?.classList.contains("ajax__calendar")).toBe(true);
    expect(candidate?.tagName).not.toBe("FORM");
    const view = analyzeCalendar(candidate!);
    expect(view?.kind).toBe("day");
  });

  it("never returns a form that contains the field", () => {
    clipAwareRects();
    document.body.innerHTML = `
      <form id="aspnetForm">
        <input id="field" />
        ${plainDayTable()}
      </form>
    `;
    const candidate = findCalendarCandidate(document.getElementById("field")!);
    expect(candidate?.tagName).not.toBe("FORM");
    expect(candidate?.contains(document.getElementById("field"))).not.toBe(true);
  });

  it("rejects an unhinted container with more than twelve form controls", () => {
    clipAwareRects();
    const controls = Array.from(
      { length: 14 },
      (_, index) => `<input name="control${index}" value="${index}" />`,
    ).join("");
    const days = Array.from({ length: 31 }, (_, index) => `<button>${index + 1}</button>`).join("");
    document.body.innerHTML = `
      <input id="field" />
      <div id="toolbar">${controls}<div>${days}</div></div>
    `;
    expect(findCalendarCandidate(document.getElementById("field")!)).toBeNull();
  });

  it("rejects an unhinted container with more than twelve thousand characters", () => {
    clipAwareRects();
    document.body.innerHTML = `
      <input id="field" />
      <div id="huge">
        <p>${"padding text ".repeat(1200)}</p>
        <div>${Array.from({ length: 31 }, (_, index) => index + 1).join(" ")}</div>
      </div>
    `;
    expect(findCalendarCandidate(document.getElementById("field")!)).toBeNull();
  });

  it("rejects an unhinted container that holds the field", () => {
    clipAwareRects();
    document.body.innerHTML = `
      <div id="shell">
        <input id="field" />
        ${plainDayTable("March 2026")}
      </div>
    `;
    const candidate = findCalendarCandidate(document.getElementById("field")!);
    expect(candidate?.id).not.toBe("shell");
    expect(candidate?.tagName).toBe("TABLE");
  });
});
