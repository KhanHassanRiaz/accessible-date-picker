export interface ClickPoint {
  x: number;
  y: number;
}

const POINTER_EVENT_INIT: PointerEventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
  pointerId: 1,
  pointerType: "mouse",
  isPrimary: true,
};

export function allRoots(): (Document | ShadowRoot)[] {
  const roots: (Document | ShadowRoot)[] = [document];
  const queue: (Document | ShadowRoot)[] = [document];
  while (queue.length) {
    const root = queue.shift();
    if (!root) continue;
    const elements = root.querySelectorAll("*");
    for (const element of elements) {
      if (element.shadowRoot) {
        roots.push(element.shadowRoot);
        queue.push(element.shadowRoot);
      }
    }
  }
  return roots;
}

export function elementsInRoots(selector: string): Element[] {
  const result: Element[] = [];
  for (const root of allRoots()) {
    result.push(...root.querySelectorAll(selector));
  }
  return result;
}

export function isVisible(element: Element): boolean {
  if (!(element instanceof Element)) return false;
  if (!element.isConnected) return false;
  const rects = element.getClientRects();
  if (rects.length === 0) return false;
  const style = getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse"
  ) {
    return false;
  }
  if (Number.parseFloat(style.opacity) === 0) return false;
  return true;
}

export function rectCenter(element: Element): ClickPoint {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function dispatchClickSequence(
  element: Element,
  point: ClickPoint = rectCenter(element),
): void {
  const view = element.ownerDocument.defaultView;
  if (!view) return;
  const baseInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view,
    clientX: point.x,
    clientY: point.y,
    screenX: point.x,
    screenY: point.y,
    button: 0,
    buttons: 1,
  };
  const PointerEventConstructor = view.PointerEvent;
  element.dispatchEvent(
    new PointerEventConstructor("pointerdown", {
      ...baseInit,
      ...POINTER_EVENT_INIT,
    }),
  );
  element.dispatchEvent(new view.MouseEvent("mousedown", baseInit));
  element.dispatchEvent(
    new PointerEventConstructor("pointerup", {
      ...baseInit,
      ...POINTER_EVENT_INIT,
      buttons: 0,
    }),
  );
  element.dispatchEvent(new view.MouseEvent("mouseup", { ...baseInit, buttons: 0 }));
  element.dispatchEvent(
    new view.MouseEvent("click", {
      ...baseInit,
      buttons: 0,
      detail: 1,
    }),
  );
}

export function dispatchKey(target: EventTarget, key: string): void {
  const view = target instanceof Element ? target.ownerDocument.defaultView : window;
  if (!view) return;
  const init: KeyboardEventInit = {
    key,
    code: key === "Escape" ? "Escape" : key,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  target.dispatchEvent(new view.KeyboardEvent("keydown", init));
  target.dispatchEvent(new view.KeyboardEvent("keyup", init));
}

export function focusWithoutScroll(element: HTMLElement): void {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export function nativeInputValueSetter(input: HTMLInputElement, value: string): void {
  const view = input.ownerDocument.defaultView;
  const descriptor = view
    ? Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "value")
    : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
}

export function nativeSelectValueSetter(select: HTMLSelectElement, value: string): void {
  const view = select.ownerDocument.defaultView;
  const descriptor = view
    ? Object.getOwnPropertyDescriptor(view.HTMLSelectElement.prototype, "value")
    : Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(select, value);
  } else {
    select.value = value;
  }
}

export function dispatchInputEvents(element: HTMLElement): void {
  const view = element.ownerDocument.defaultView;
  if (!view) return;
  element.dispatchEvent(new view.Event("input", { bubbles: true, composed: true }));
  element.dispatchEvent(new view.Event("change", { bubbles: true, composed: true }));
}

export function dispatchFocusBlur(element: HTMLElement): void {
  const view = element.ownerDocument.defaultView;
  if (!view) return;
  element.dispatchEvent(new view.FocusEvent("focus", { bubbles: false, composed: true }));
  element.dispatchEvent(new view.FocusEvent("blur", { bubbles: false, composed: true }));
}

export function isControlDisabled(element: Element): boolean {
  if (element instanceof HTMLButtonElement && element.disabled) return true;
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    if (element.disabled) return true;
  }
  if (element.getAttribute("aria-disabled") === "true") return true;
  const className = typeof element.className === "string" ? element.className : "";
  return /(?:^|\s)(?:disabled|is-disabled|ui-state-disabled|flatpickr-disabled|pika-disabled)(?:\s|$)/i.test(
    className,
  );
}

export function hasDisabledAncestor(element: Element, boundary?: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if (isControlDisabled(current)) return true;
    if (current === boundary) break;
    current = current.parentElement;
  }
  return false;
}

export function waitForMutationOrTimeout(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const observers: MutationObserver[] = [];
    const finish = (mutated: boolean): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      for (const observer of observers) observer.disconnect();
      resolve(mutated);
    };
    const roots = allRoots();
    for (const root of roots) {
      const target = root instanceof Document ? root.documentElement : root;
      const observer = new MutationObserver(() => {
        finish(true);
      });
      observer.observe(target, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      observers.push(observer);
    }
    const timer = window.setTimeout(() => {
      finish(false);
    }, timeoutMs);
  });
}

export async function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number,
  pollMs = 50,
): Promise<boolean> {
  const deadline = performance.now() + timeoutMs;
  if (predicate()) return true;
  while (performance.now() < deadline) {
    const remaining = Math.max(1, deadline - performance.now());
    await Promise.race([
      waitForMutationOrTimeout(Math.min(pollMs, remaining)),
      new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(pollMs, remaining))),
    ]);
    if (predicate()) return true;
  }
  return predicate();
}

export function shortText(element: Element, limit = 200): string {
  return element.textContent.replace(/\s+/g, " ").trim().slice(0, limit);
}
