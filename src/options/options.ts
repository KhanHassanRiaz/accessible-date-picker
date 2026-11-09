import {
  clampEarliestYear,
  clampFutureYears,
  forgetFormats,
  readConfig,
  writeConfig,
} from "../shared/storage.js";
import { STRINGS } from "../strings.js";

const SHORTCUTS_URL = "chrome://extensions/shortcuts";

function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Options page is missing ${id}.`);
  }
  return element;
}

function setStatus(element: HTMLElement, message: string): void {
  element.textContent = message;
}

async function init(): Promise<void> {
  const form = byId("year-form", HTMLFormElement);
  const earliestInput = byId("earliest-year", HTMLInputElement);
  const futureInput = byId("future-years", HTMLInputElement);
  const yearStatus = byId("year-status", HTMLElement);
  const formatsStatus = byId("formats-status", HTMLElement);
  const shortcutsButton = byId("open-shortcuts", HTMLButtonElement);
  const forgetButton = byId("forget-formats", HTMLButtonElement);

  const config = await readConfig();
  earliestInput.value = String(config.earliestYear);
  futureInput.value = String(config.futureYears);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const earliestYear = Number(earliestInput.value);
    const futureYears = Number(futureInput.value);
    if (
      !Number.isInteger(earliestYear) ||
      earliestYear < 1900 ||
      earliestYear > 2100 ||
      !Number.isInteger(futureYears) ||
      futureYears < 0 ||
      futureYears > 200
    ) {
      setStatus(yearStatus, STRINGS.options.yearRangeInvalid);
      earliestInput.focus();
      return;
    }
    void writeConfig({
      earliestYear: clampEarliestYear(earliestYear),
      futureYears: clampFutureYears(futureYears),
    })
      .then((saved) => {
        earliestInput.value = String(saved.earliestYear);
        futureInput.value = String(saved.futureYears);
        setStatus(yearStatus, STRINGS.options.yearRangeSaved);
      })
      .catch(() => {
        setStatus(yearStatus, STRINGS.options.yearRangeSaveFailed);
      });
  });

  forgetButton.addEventListener("click", () => {
    void forgetFormats()
      .then(() => {
        setStatus(formatsStatus, STRINGS.options.formatsForgotten);
      })
      .catch(() => {
        setStatus(formatsStatus, STRINGS.options.formatsForgetFailed);
      });
  });

  shortcutsButton.addEventListener("click", () => {
    setStatus(byId("shortcut-status", HTMLElement), "");
    void chrome.tabs.create({ url: SHORTCUTS_URL }).catch(() => {
      setStatus(byId("shortcut-status", HTMLElement), STRINGS.options.shortcutPageError);
    });
  });
}

void init();
