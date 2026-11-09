import { afterEach, describe, expect, it } from "vitest";
import {
  deepActiveElement,
  isDocumentFocused,
  isTextEntryInput,
  resolveFocusedField,
} from "../../src/content/fieldDetect.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("text entry input detection", () => {
  it("accepts text, search, date and month inputs", () => {
    for (const type of ["text", "search", "date", "month"]) {
      const input = document.createElement("input");
      input.type = type;
      expect(isTextEntryInput(input), type).toBe(true);
    }
  });

  it("rejects other input types and other elements", () => {
    for (const type of ["hidden", "checkbox", "radio", "number", "email", "password"]) {
      const input = document.createElement("input");
      input.type = type;
      expect(isTextEntryInput(input), type).toBe(false);
    }
    const button = document.createElement("button");
    expect(isTextEntryInput(button)).toBe(false);
    expect(isTextEntryInput(null)).toBe(false);
  });
});

describe("focused field resolution", () => {
  it("returns the focused text input directly", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const result = resolveFocusedField(document);
    expect(result.field).toBe(input);
    expect(result.focusedElement).toBe(input);
    expect(result.reason).toBe("input");
  });

  it("resolves a button that controls an input through aria-controls", () => {
    const input = document.createElement("input");
    input.id = "date-field";
    const button = document.createElement("button");
    button.setAttribute("aria-controls", "date-field");
    button.textContent = "Choose date";
    document.body.append(input, button);
    button.focus();
    const result = resolveFocusedField(document);
    expect(result.field).toBe(input);
    expect(result.focusedElement).toBe(button);
    expect(result.reason).toBe("related-input");
  });

  it("resolves a sibling input next to the focused button", () => {
    const wrapper = document.createElement("div");
    const button = document.createElement("button");
    button.textContent = "Calendar";
    const input = document.createElement("input");
    wrapper.append(button, input);
    document.body.append(wrapper);
    button.focus();
    expect(resolveFocusedField(document).field).toBe(input);
  });

  it("does not touch an unrelated input elsewhere on the page", () => {
    document.body.innerHTML = `
      <div><input id="unrelated" /></div>
      <div><button id="action">Unrelated</button></div>
    `;
    document.getElementById("action")!.focus();
    expect(resolveFocusedField(document).field).toBeNull();
    expect(resolveFocusedField(document).reason).toBe("not-input");
  });

  it("refuses a focused non-button element", () => {
    const link = document.createElement("span");
    link.tabIndex = 0;
    document.body.append(link);
    link.focus();
    expect(resolveFocusedField(document).field).toBeNull();
  });

  it("returns a null result when nothing meaningful is focused", () => {
    const result = resolveFocusedField(document);
    expect(result.field).toBeNull();
    expect(result.reason).toBe("not-input");
  });

  it("looks through open shadow roots for the focused element", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    shadow.append(input);
    input.focus();
    expect(deepActiveElement(document)).toBe(input);
    expect(resolveFocusedField(document).field).toBe(input);
  });

  it("reports document focus without relying on layout", () => {
    expect(typeof isDocumentFocused()).toBe("boolean");
  });
});
