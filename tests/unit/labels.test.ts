import { afterEach, describe, expect, it } from "vitest";
import { cleanLabelText, getAriaDescription, getFieldLabel } from "../../src/content/labels.js";
import { STRINGS } from "../../src/strings.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("label text cleaning", () => {
  it("collapses whitespace and trims decorations", () => {
    expect(cleanLabelText("  Start   date * ")).toBe("Start date");
    expect(cleanLabelText("• Date:")).toBe("Date");
    expect(cleanLabelText("– Date –")).toBe("Date");
    expect(cleanLabelText("")).toBe("");
  });
});

describe("field labels", () => {
  it("uses aria-labelledby first", () => {
    document.body.innerHTML = `
      <span id="one">Travel</span><span id="two">start date</span>
      <input id="field" aria-labelledby="one two" aria-label="Ignored" />
    `;
    expect(getFieldLabel(document.getElementById("field")!)).toBe("Travel start date");
  });

  it("uses aria-label before a visible label", () => {
    document.body.innerHTML = `
      <label for="field">Visible label</label>
      <input id="field" aria-label="Accessible label" />
    `;
    expect(getFieldLabel(document.getElementById("field")!)).toBe("Accessible label");
  });

  it("uses an explicit label element", () => {
    document.body.innerHTML = `
      <label for="field">Departure date</label>
      <input id="field" />
    `;
    expect(getFieldLabel(document.getElementById("field")!)).toBe("Departure date");
  });

  it("uses a wrapping label without including the input", () => {
    document.body.innerHTML = `
      <label>Return date <input id="field" value="04/03/2026" /></label>
    `;
    expect(getFieldLabel(document.getElementById("field")!)).toBe("Return date");
  });

  it("falls back to title, then placeholder, then nearby group text", () => {
    document.body.innerHTML = `<input id="one" title="Title date" placeholder="Placeholder date" />`;
    expect(getFieldLabel(document.getElementById("one")!)).toBe("Title date");

    document.body.innerHTML = `<input id="two" placeholder="Placeholder date" />`;
    expect(getFieldLabel(document.getElementById("two")!)).toBe("Placeholder date");

    document.body.innerHTML = `<h3>Booking details</h3><div><input id="three" /></div>`;
    expect(getFieldLabel(document.getElementById("three")!)).toBe("Booking details");
  });

  it("uses a fieldset legend", () => {
    document.body.innerHTML = `
      <fieldset><legend>Payment date</legend><input id="field" /></fieldset>
    `;
    expect(getFieldLabel(document.getElementById("field")!)).toBe("Payment date");
  });

  it("returns the fallback label when nothing is available", () => {
    document.body.innerHTML = `<input id="field" />`;
    expect(getFieldLabel(document.getElementById("field")!)).toBe(STRINGS.fieldFallbackLabel);
  });

  it("reads aria-describedby text", () => {
    document.body.innerHTML = `
      <p id="hint">Use day slash month slash year.</p>
      <input id="field" aria-describedby="hint" />
    `;
    expect(getAriaDescription(document.getElementById("field")!)).toBe(
      "Use day slash month slash year.",
    );
  });

  it("returns an empty description when none is present", () => {
    document.body.innerHTML = `<input id="field" />`;
    expect(getAriaDescription(document.getElementById("field")!)).toBe("");
  });

  it("finds labels inside an open shadow root", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <span id="label">Shadow date</span>
      <input id="field" aria-labelledby="label" />
    `;
    expect(getFieldLabel(shadow.getElementById("field")!)).toBe("Shadow date");
  });
});
