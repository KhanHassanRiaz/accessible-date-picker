import type { DateLibrary } from "../shared/formats.js";
import type { LibraryBridgeResponse, LibraryInfo } from "../shared/messages.js";

interface FlatpickrLike {
  setDate?: (date: Date, triggerChange?: boolean) => void;
  config?: { dateFormat?: string };
}

interface PikadayLike {
  setDate?: (date: Date, triggerChange?: boolean) => void;
  toString?: (format?: string) => string;
  _o?: {
    format?: string;
    toString?: ((date: Date, format?: string) => string) | null;
  };
}

interface ZebraDatePickerLike {
  settings?: { format?: string; always_visible?: boolean };
  set_date?: (value: string) => void;
  show?: () => void;
  hide?: () => void;
}

interface JQueryLike {
  (element: Element): JQueryElementLike;
  ui?: { version?: string };
  datepicker?: {
    _selectDate?: (target: Element, dateStr?: string) => void;
  };
  fn?: {
    datepicker?: {
      version?: string;
      Constructor?: { version?: string };
    };
  };
}

interface JQueryElementLike {
  data?: (name: string) => unknown;
  datepicker?: (method: string, value?: unknown) => unknown;
}

interface PageWindow extends Window {
  jQuery?: JQueryLike;
  $?: JQueryLike;
  flatpickr?: { version?: string };
  Pikaday?: { version?: string };
}

/**
 * Runs in the page MAIN world. It must stay self-contained: Chrome serializes
 * this function and executes it without any imports or closure variables.
 */
export function mainWorldLibraryAdapter(
  token: string,
  year: number,
  month: number,
  day: number,
  mode: "set" | "inspect",
): LibraryBridgeResponse {
  const none: LibraryInfo = {
    name: "unknown",
    version: null,
    format: null,
    supported: false,
    value: null,
  };

  function deepFind(root: Document | ShadowRoot, depth: number): HTMLElement | null {
    if (depth > 10) return null;
    const direct = root.querySelector<HTMLElement>(`[data-adp-target="${token}"]`);
    if (direct) return direct;
    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) {
        const found = deepFind(element.shadowRoot, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function cleanup(): void {
    try {
      if (element?.getAttribute("data-adp-target") === token) {
        element.removeAttribute("data-adp-target");
      }
    } catch {
      // The page may have detached the element.
    }
  }

  let element: HTMLElement | null = null;
  try {
    element = deepFind(document, 0);
  } catch {
    element = null;
  }
  if (!element) {
    return { ok: false, info: none };
  }

  const page = window as PageWindow;
  const input = element as HTMLInputElement;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  let info: LibraryInfo = { ...none };

  const jq = page.jQuery ?? page.$;
  const flatpickrInstance = (element as HTMLElement & { _flatpickr?: FlatpickrLike })._flatpickr;
  const pikadayHandle = element as HTMLElement & {
    _pikaday?: PikadayLike;
    pikaday?: PikadayLike;
  };
  const pikadayInstance = pikadayHandle._pikaday ?? pikadayHandle.pikaday;

  function formatPikadayDate(value: Date, pattern: string | undefined): string | null {
    if (!pattern) return null;
    const day = value.getDate();
    const month = value.getMonth() + 1;
    const year = value.getFullYear();
    const monthLong = [
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
    ][month - 1];
    let output = "";
    let index = 0;
    while (index < pattern.length) {
      const token = /^(YYYY|YY|MMMM|MMM|MM|M|DD|D)/.exec(pattern.slice(index))?.[0];
      if (!token) {
        output += pattern[index] ?? "";
        index += 1;
        continue;
      }
      switch (token) {
        case "D":
          output += String(day);
          break;
        case "DD":
          output += String(day).padStart(2, "0");
          break;
        case "M":
          output += String(month);
          break;
        case "MM":
          output += String(month).padStart(2, "0");
          break;
        case "MMM":
          output += (monthLong ?? "").slice(0, 3);
          break;
        case "MMMM":
          output += monthLong ?? "";
          break;
        case "YY":
          output += String(year % 100).padStart(2, "0");
          break;
        case "YYYY":
          output += String(year).padStart(4, "0");
          break;
      }
      index += token.length;
    }
    return output;
  }

  function formatZebraDate(value: Date, pattern: string): string {
    const day = value.getDate();
    const month = value.getMonth() + 1;
    const year = value.getFullYear();
    const monthLong = [
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
    ][month - 1];
    let output = "";
    let index = 0;
    while (index < pattern.length) {
      const character = pattern[index] ?? "";
      switch (character) {
        case "d":
          output += String(day).padStart(2, "0");
          break;
        case "j":
          output += String(day);
          break;
        case "m":
          output += String(month).padStart(2, "0");
          break;
        case "n":
          output += String(month);
          break;
        case "M":
          output += (monthLong ?? "").slice(0, 3);
          break;
        case "F":
          output += monthLong ?? "";
          break;
        case "Y":
          output += String(year).padStart(4, "0");
          break;
        case "y":
          output += String(year % 100).padStart(2, "0");
          break;
        default:
          output += character;
          break;
      }
      index += 1;
    }
    return output;
  }

  try {
    if (flatpickrInstance && typeof flatpickrInstance.setDate === "function") {
      const library: DateLibrary = "flatpickr";
      info = {
        name: library,
        version: page.flatpickr?.version ?? null,
        format: flatpickrInstance.config?.dateFormat ?? null,
        supported: true,
        value: input.value,
      };
      if (mode === "set") {
        flatpickrInstance.setDate(date, true);
      }
    } else {
      let handled = false;
      if (jq && typeof jq === "function") {
        const wrapped = jq(element);
        const zebraInstance = wrapped.data?.("Zebra_DatePicker") as ZebraDatePickerLike | undefined;
        const instance = wrapped.data?.("datepicker") as
          | {
              settings?: { dateFormat?: string };
              format?: string;
              setDate?: (value: Date | string) => void;
              update?: (value: Date | string) => void;
            }
          | undefined;
        if (zebraInstance && typeof zebraInstance.set_date === "function") {
          const pattern = zebraInstance.settings?.format ?? "Y-m-d";
          info = {
            name: "zebra-datepicker",
            version: null,
            format: pattern,
            supported: true,
            value: input.value,
          };
          if (mode === "set") {
            zebraInstance.set_date(formatZebraDate(date, pattern));
            input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
            // Zebra runs the site's onChange while rendering a view and its
            // onClose when the calendar hides. Some sites, including the
            // Punjab Jobs profile form, calculate dependent fields only in
            // onClose, so a plain value write would leave those fields stale.
            try {
              zebraInstance.show?.();
            } catch {
              // Rendering is best effort; hiding below still fires onClose.
            }
            zebraInstance.hide?.();
          }
          handled = true;
        } else if (instance) {
          const isJqueryUi = Boolean(instance.settings);
          const isBootstrap =
            typeof instance.format === "string" || typeof instance.update === "function";
          if (isJqueryUi) {
            const pluginAvailable = typeof wrapped.datepicker === "function";
            info = {
              name: "jquery-ui",
              version: jq.ui?.version ?? null,
              format: instance.settings?.dateFormat ?? null,
              supported: pluginAvailable || typeof instance.setDate === "function",
              value: input.value,
            };
            if (mode === "set") {
              if (pluginAvailable) {
                wrapped.datepicker?.("setDate", date);
                jq.datepicker?._selectDate?.(element);
              } else if (typeof instance.setDate === "function") {
                instance.setDate(date);
              }
            }
            handled = true;
          } else if (isBootstrap) {
            info = {
              name: "bootstrap-datepicker",
              version:
                jq.fn?.datepicker?.version ?? jq.fn?.datepicker?.Constructor?.version ?? null,
              format: instance.format ?? null,
              supported:
                typeof instance.setDate === "function" || typeof instance.update === "function",
              value: input.value,
            };
            if (mode === "set") {
              if (typeof instance.setDate === "function") instance.setDate(date);
              else if (typeof instance.update === "function") instance.update(date);
            }
            handled = true;
          }
        }
      }

      if (!handled && pikadayInstance && typeof pikadayInstance.setDate === "function") {
        const settings = pikadayInstance._o;
        info = {
          name: "pikaday",
          version: page.Pikaday?.version ?? null,
          format: settings?.format ?? null,
          supported: true,
          value: input.value,
        };
        if (mode === "set") {
          const hasOwnToString = settings
            ? Object.prototype.hasOwnProperty.call(settings, "toString")
            : false;
          const originalToString = settings?.toString ?? null;
          const previousToString =
            hasOwnToString && typeof originalToString === "function" ? originalToString : null;
          if (settings) {
            settings.toString = (value, format) => {
              if (previousToString) return previousToString(value, format);
              return formatPikadayDate(value, format) ?? value.toDateString();
            };
          }
          try {
            pikadayInstance.setDate(date, true);
          } finally {
            if (settings) {
              if (hasOwnToString) settings.toString = originalToString;
              else delete settings.toString;
            }
          }
        }
      }
    }
  } catch (error) {
    cleanup();
    return {
      ok: false,
      info: {
        ...info,
        error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        value: input.value,
      },
    };
  }

  cleanup();
  return { ok: info.supported, info: { ...info, value: input.value } };
}
