import { announce, scheduleAnnouncementCleanup } from "./announcer.js";
import { deepActiveElement, isDocumentFocused, resolveFocusedField } from "./fieldDetect.js";
import { ContentFlow, isFlowActive } from "./flow.js";
import { STRINGS } from "../strings.js";

declare global {
  interface Window {
    __adpContentLoaded?: boolean;
  }
}

const START_MESSAGE = "adp:start";

function activeFrameIsChildFrame(): boolean {
  const active = deepActiveElement(document);
  return active instanceof HTMLIFrameElement;
}

function shouldHandleStart(): boolean {
  if (!isDocumentFocused()) return false;
  // A parent document reports focus when the active element is the child
  // iframe. The child frame, which owns the real focused field, handles it.
  if (activeFrameIsChildFrame()) return false;
  return true;
}

async function startFromFocusedField(): Promise<void> {
  if (isFlowActive()) return;
  if (!shouldHandleStart()) return;
  const focused = resolveFocusedField(document);
  if (!focused.field) {
    announce(STRINGS.notInput, "assertive");
    scheduleAnnouncementCleanup();
    return;
  }
  await ContentFlow.start(focused.field);
}

function registerStartListener(): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (
      typeof message !== "object" ||
      message === null ||
      (message as { type?: unknown }).type !== START_MESSAGE
    ) {
      return false;
    }
    if (!shouldHandleStart()) return false;
    void startFromFocusedField()
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch(() => {
        sendResponse({ ok: false });
      });
    return true;
  });
}

if (!window.__adpContentLoaded) {
  window.__adpContentLoaded = true;
  registerStartListener();
}

export { startFromFocusedField };
