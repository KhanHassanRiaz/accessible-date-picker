export interface FocusedFieldResult {
  field: HTMLInputElement | null;
  focusedElement: Element | null;
  reason: "input" | "related-input" | "not-input";
}

export function deepActiveElement(document: Document): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

export function isTextEntryInput(element: Element | null): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false;
  const type = element.type.toLowerCase();
  return type === "text" || type === "search" || type === "date" || type === "month";
}

function closestInput(element: Element): HTMLInputElement | null {
  const parent = element.parentElement;
  if (!parent) return null;
  const siblingInput = parent.querySelector("input:not([type='hidden'])");
  return isTextEntryInput(siblingInput) ? siblingInput : null;
}

function nearestInput(element: Element): HTMLInputElement | null {
  let current: Element | null = element;
  const body = element.ownerDocument.body;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    // Never treat an arbitrary input anywhere on the page as related to a
    // focused button. Climbing all the way to body would do exactly that.
    if (current === body || current === element.ownerDocument.documentElement) break;
    const previous = current.previousElementSibling;
    if (isTextEntryInput(previous)) return previous;
    const next = current.nextElementSibling;
    if (isTextEntryInput(next)) return next;
    if (isTextEntryInput(current)) return current;
    const within = current.querySelector("input:not([type='hidden'])");
    if (isTextEntryInput(within)) return within;
    current = current.parentElement;
  }
  return null;
}

function isButtonLike(element: Element): boolean {
  if (element instanceof HTMLButtonElement) return true;
  if (element instanceof HTMLAnchorElement) return true;
  const role = element.getAttribute("role");
  if (role === "button" || role === "link") return true;
  if (element instanceof HTMLElement && element.tabIndex >= 0) return true;
  return false;
}

export function resolveFocusedField(document: Document): FocusedFieldResult {
  const active = deepActiveElement(document);
  if (!active) return { field: null, focusedElement: null, reason: "not-input" };
  if (isTextEntryInput(active)) {
    return { field: active, focusedElement: active, reason: "input" };
  }
  if (!isButtonLike(active)) {
    return { field: null, focusedElement: active, reason: "not-input" };
  }

  const controls = active.getAttribute("aria-controls");
  if (controls) {
    const root = active.getRootNode();
    for (const id of controls.split(/\s+/).filter(Boolean)) {
      const target =
        root instanceof ShadowRoot ? root.getElementById(id) : document.getElementById(id);
      if (isTextEntryInput(target)) {
        return { field: target, focusedElement: active, reason: "related-input" };
      }
    }
  }

  const related = closestInput(active) ?? nearestInput(active);
  if (related) {
    return { field: related, focusedElement: active, reason: "related-input" };
  }
  return { field: null, focusedElement: active, reason: "not-input" };
}

export function isDocumentFocused(): boolean {
  if (document.hasFocus()) return true;
  const active = deepActiveElement(document);
  return Boolean(active?.matches(":focus"));
}
