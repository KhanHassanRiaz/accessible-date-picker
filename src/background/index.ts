import { mainWorldLibraryAdapter } from "../bridge/mainWorld.js";
import type {
  GetConfigResponse,
  GetFormatResponse,
  LibraryBridgeResponse,
  LibraryInfo,
  SetFormatResponse,
} from "../shared/messages.js";
import {
  ensureDefaultConfig,
  isRecord,
  readConfig,
  readFormat,
  writeFormat,
} from "../shared/storage.js";
import { STRINGS } from "../strings.js";

declare const __ADP_TEST__: boolean;

const START_MESSAGE = { type: "adp:start" } as const;
const CONTENT_SCRIPT = "content.js";
const UNKNOWN_LIBRARY: LibraryInfo = {
  name: "unknown",
  version: null,
  format: null,
  supported: false,
  value: null,
};

function isTestBuild(): boolean {
  return typeof __ADP_TEST__ !== "undefined" && __ADP_TEST__;
}

function tabIdOf(tab: chrome.tabs.Tab | undefined): number | null {
  return typeof tab?.id === "number" ? tab.id : null;
}

function isRestrictedUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return true;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "file:") {
    return true;
  }
  if (url.hostname === "chromewebstore.google.com") return true;
  if (url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore")) {
    return true;
  }
  return false;
}

async function showRestrictedBadge(tabId: number): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#9b1c1c" });
    await chrome.action.setBadgeText({ tabId, text: STRINGS.restrictedBadge });
    await chrome.action.setTitle({ tabId, title: STRINGS.notAllowedTooltip });
  } catch {
    // The tab may already be gone.
  }
}

async function clearBadge(tabId: number): Promise<void> {
  try {
    await chrome.action.setBadgeText({ tabId, text: "" });
    await chrome.action.setTitle({
      tabId,
      title: `${STRINGS.extensionName}: ${STRINGS.extensionDescription}`,
    });
  } catch {
    // The tab may already be gone.
  }
}

export async function startForTab(tabId: number): Promise<boolean> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return false;
  }
  if (isRestrictedUrl(tab.url)) {
    await showRestrictedBadge(tabId);
    return false;
  }
  await clearBadge(tabId);

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: [CONTENT_SCRIPT],
    });
  } catch {
    await showRestrictedBadge(tabId);
    return false;
  }

  try {
    await chrome.tabs.sendMessage(tabId, START_MESSAGE);
    return true;
  } catch {
    // No frame handled the message, for example when focus is outside the page.
    return false;
  }
}

async function startActiveTab(): Promise<boolean> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tabId = tabIdOf(tab);
  if (tabId === null) return false;
  return startForTab(tabId);
}

function validLibraryRequest(request: Record<string, unknown>): request is Record<
  string,
  unknown
> & {
  token: string;
  year: number;
  month: number;
  day: number;
  mode: "set" | "inspect";
} {
  return (
    typeof request.token === "string" &&
    /^adp-[a-z0-9-]{1,80}$/.test(request.token) &&
    typeof request.year === "number" &&
    Number.isInteger(request.year) &&
    request.year >= 1 &&
    request.year <= 9999 &&
    typeof request.month === "number" &&
    Number.isInteger(request.month) &&
    request.month >= 1 &&
    request.month <= 12 &&
    typeof request.day === "number" &&
    Number.isInteger(request.day) &&
    request.day >= 1 &&
    request.day <= 31 &&
    (request.mode === "set" || request.mode === "inspect")
  );
}

function isLibraryResponse(value: unknown): value is LibraryBridgeResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean" || !isRecord(value.info)) return false;
  return typeof value.info.name === "string" && typeof value.info.supported === "boolean";
}

async function runLibraryAdapter(
  request: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
): Promise<LibraryBridgeResponse> {
  if (!validLibraryRequest(request)) {
    return { ok: false, info: { ...UNKNOWN_LIBRARY, error: "invalid request" } };
  }
  const tabId = sender.tab?.id;
  const frameId = sender.frameId;
  if (typeof tabId !== "number" || typeof frameId !== "number") {
    return { ok: false, info: { ...UNKNOWN_LIBRARY, error: "no sender frame" } };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      injectImmediately: true,
      func: mainWorldLibraryAdapter,
      args: [request.token, request.year, request.month, request.day, request.mode],
    });
    const result = results[0]?.result;
    if (isLibraryResponse(result)) return result;
    return { ok: false, info: { ...UNKNOWN_LIBRARY, error: "no adapter result" } };
  } catch (error) {
    return {
      ok: false,
      info: {
        ...UNKNOWN_LIBRARY,
        error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      },
    };
  }
}

function handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): boolean {
  if (!isRecord(message) || typeof message.type !== "string") return false;

  switch (message.type) {
    case "adp:library": {
      void runLibraryAdapter(message, sender).then(sendResponse);
      return true;
    }
    case "adp:get-config": {
      void readConfig()
        .then((config): GetConfigResponse => ({ config }))
        .then(sendResponse);
      return true;
    }
    case "adp:get-format": {
      const origin = typeof message.origin === "string" ? message.origin : "";
      const fieldKey = typeof message.fieldKey === "string" ? message.fieldKey : "";
      void readFormat(origin, fieldKey)
        .then((format): GetFormatResponse => ({ format }))
        .then(sendResponse);
      return true;
    }
    case "adp:set-format": {
      void writeFormat(message.origin, message.fieldKey, message.pattern)
        .then((ok): SetFormatResponse => ({ ok }))
        .then(sendResponse);
      return true;
    }
    default:
      return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return handleMessage(message, sender, sendResponse);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-date-picker") return;
  const tabId = tabIdOf(tab);
  if (tabId !== null) void startForTab(tabId);
});

chrome.action.onClicked.addListener((tab) => {
  const tabId = tabIdOf(tab);
  if (tabId !== null) void startForTab(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultConfig();
});

if (isTestBuild()) {
  const testGlobal = globalThis as typeof globalThis & {
    __adpTestStartActive?: () => Promise<boolean>;
    __adpTestStartTab?: (tabId: number) => Promise<boolean>;
  };
  testGlobal.__adpTestStartActive = startActiveTab;
  testGlobal.__adpTestStartTab = startForTab;
}
