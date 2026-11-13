import { afterEach, describe, expect, it, vi } from "vitest";
import { mainWorldLibraryAdapter } from "../../src/bridge/mainWorld.js";

function target(token = "token"): HTMLInputElement {
  const input = document.createElement("input");
  input.setAttribute("data-adp-target", token);
  document.body.append(input);
  return input;
}

function clearPageGlobals(): void {
  const page = window as unknown as Record<string, unknown>;
  delete page.jQuery;
  delete page.$;
  delete page.flatpickr;
  delete page.Pikaday;
  document.body.innerHTML = "";
}

afterEach(() => {
  clearPageGlobals();
});

describe("MAIN world library adapter", () => {
  it("sets a flatpickr date and reports its format", () => {
    const input = target();
    const setDate = vi.fn((date: Date, triggerChange?: boolean) => {
      input.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`;
      if (triggerChange) input.dataset.triggered = "yes";
    });
    (input as unknown as { _flatpickr: unknown })._flatpickr = {
      config: { dateFormat: "Y-m-d" },
      setDate,
    };
    (window as unknown as { flatpickr: unknown }).flatpickr = { version: "4.6.13" };

    const result = mainWorldLibraryAdapter("token", 2026, 3, 4, "set");

    expect(result.ok).toBe(true);
    expect(result.info).toMatchObject({
      name: "flatpickr",
      version: "4.6.13",
      format: "Y-m-d",
      supported: true,
      value: "2026-03-04",
    });
    expect(setDate).toHaveBeenCalledTimes(1);
    expect(setDate.mock.calls[0]?.[0]).toBeInstanceOf(Date);
    expect(setDate.mock.calls[0]?.[1]).toBe(true);
    expect(input.dataset.triggered).toBe("yes");
    expect(input.hasAttribute("data-adp-target")).toBe(false);
  });

  it("sets a jQuery UI date through the plugin API and runs its select handler", () => {
    target();
    const setDate = vi.fn();
    const selectDate = vi.fn();
    const jq = vi.fn(() => ({
      data: (name: string) =>
        name === "datepicker" ? { settings: { dateFormat: "dd/mm/yy" } } : undefined,
      datepicker: (method: string, value?: unknown) => {
        if (method === "setDate") setDate(value);
      },
    })) as unknown as {
      ui: { version: string };
      datepicker: { _selectDate: (element: Element) => void };
    };
    jq.ui = { version: "1.14.1" };
    jq.datepicker = { _selectDate: selectDate };
    (window as unknown as { jQuery: unknown }).jQuery = jq;

    const result = mainWorldLibraryAdapter("token", 2026, 3, 4, "set");

    expect(result.ok).toBe(true);
    expect(result.info).toMatchObject({ name: "jquery-ui", version: "1.14.1", format: "dd/mm/yy" });
    expect(setDate).toHaveBeenCalledTimes(1);
    expect(selectDate).toHaveBeenCalledTimes(1);
  });

  it("sets a bootstrap-datepicker date", () => {
    target();
    const setDate = vi.fn();
    const jq = vi.fn(() => ({
      data: () => ({ format: "dd/mm/yyyy", setDate }),
    })) as unknown as {
      fn: { datepicker: { version: string } };
    };
    jq.fn = { datepicker: { version: "1.10.0" } };
    (window as unknown as { jQuery: unknown }).jQuery = jq;

    const result = mainWorldLibraryAdapter("token", 2026, 3, 4, "set");

    expect(result.ok).toBe(true);
    expect(result.info).toMatchObject({
      name: "bootstrap-datepicker",
      version: "1.10.0",
      format: "dd/mm/yyyy",
    });
    expect(setDate).toHaveBeenCalledTimes(1);
  });

  it("sets a Pikaday date through its instance handle and formats with its pattern", () => {
    const input = target();
    const options: {
      format: string;
      toString?: (date: Date, format?: string) => string;
    } = { format: "DD/MM/YYYY" };
    const setDate = vi.fn((date: Date) => {
      input.value = options.toString?.(date, options.format) ?? date.toDateString();
    });
    (input as unknown as { _pikaday: unknown })._pikaday = {
      _o: options,
      setDate,
    };
    (window as unknown as { Pikaday: unknown }).Pikaday = { version: "1.8.2" };

    const result = mainWorldLibraryAdapter("token", 2026, 3, 4, "set");

    expect(result.ok).toBe(true);
    expect(result.info).toMatchObject({ name: "pikaday", version: "1.8.2", format: "DD/MM/YYYY" });
    expect(setDate).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("04/03/2026");
    expect(result.info.value).toBe("04/03/2026");
    expect(Object.prototype.hasOwnProperty.call(options, "toString")).toBe(false);
  });

  it("sets a Zebra date, fires change, and closes so onClose handlers run", () => {
    const input = target();
    const setDate = vi.fn((value: string) => {
      input.value = value;
    });
    const show = vi.fn();
    const hide = vi.fn();
    const jq = vi.fn(() => ({
      data: (name: string) =>
        name === "Zebra_DatePicker"
          ? { settings: { format: "d-M-Y" }, set_date: setDate, show, hide }
          : undefined,
    }));
    (window as unknown as { jQuery: unknown }).jQuery = jq;
    const changes: string[] = [];
    input.addEventListener("change", () => changes.push("change"));

    const result = mainWorldLibraryAdapter("token", 2000, 6, 10, "set");

    expect(result.ok).toBe(true);
    expect(result.info).toMatchObject({
      name: "zebra-datepicker",
      format: "d-M-Y",
      supported: true,
      value: "10-Jun-2000",
    });
    expect(setDate).toHaveBeenCalledWith("10-Jun-2000");
    expect(changes).toContain("change");
    expect(show).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it("inspects a Zebra picker without changing the date", () => {
    const input = target();
    const setDate = vi.fn();
    const show = vi.fn();
    const hide = vi.fn();
    const jq = vi.fn(() => ({
      data: (name: string) =>
        name === "Zebra_DatePicker"
          ? { settings: { format: "d-M-Y" }, set_date: setDate, show, hide }
          : undefined,
    }));
    (window as unknown as { jQuery: unknown }).jQuery = jq;

    const result = mainWorldLibraryAdapter("token", 2000, 6, 10, "inspect");

    expect(result.info).toMatchObject({ name: "zebra-datepicker", format: "d-M-Y" });
    expect(input.value).toBe("");
    expect(setDate).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
  });

  it("inspects without changing the date", () => {
    const input = target();
    const setDate = vi.fn();
    (input as unknown as { _flatpickr: unknown })._flatpickr = { setDate };
    (window as unknown as { flatpickr: unknown }).flatpickr = { version: "4.6.13" };

    const result = mainWorldLibraryAdapter("token", 2026, 3, 4, "inspect");

    expect(result.info.name).toBe("flatpickr");
    expect(setDate).not.toHaveBeenCalled();
    expect(input.hasAttribute("data-adp-target")).toBe(false);
  });

  it("finds a target inside an open shadow root", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    input.setAttribute("data-adp-target", "shadow-token");
    shadow.append(input);
    const setDate = vi.fn();
    (input as unknown as { _flatpickr: unknown })._flatpickr = { setDate };

    const result = mainWorldLibraryAdapter("shadow-token", 2026, 3, 4, "set");

    expect(result.ok).toBe(true);
    expect(setDate).toHaveBeenCalledTimes(1);
    expect(input.hasAttribute("data-adp-target")).toBe(false);
  });

  it("fails cleanly when the target is missing", () => {
    const result = mainWorldLibraryAdapter("missing", 2026, 3, 4, "set");
    expect(result).toMatchObject({ ok: false, info: { name: "unknown", supported: false } });
  });

  it("fails cleanly when no supported library is attached", () => {
    target();
    const result = mainWorldLibraryAdapter("token", 2026, 3, 4, "set");
    expect(result.ok).toBe(false);
    expect(result.info.name).toBe("unknown");
  });

  it("reports a library exception and still cleans up the marker", () => {
    const input = target();
    (input as unknown as { _flatpickr: unknown })._flatpickr = {
      setDate: () => {
        throw new Error("site refused the date");
      },
    };
    const result = mainWorldLibraryAdapter("token", 2026, 3, 4, "set");
    expect(result.ok).toBe(false);
    expect(result.info.error).toBe("site refused the date");
    expect(input.hasAttribute("data-adp-target")).toBe(false);
  });
});
