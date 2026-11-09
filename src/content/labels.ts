import { STRINGS } from "../strings.js";

export function cleanLabelText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s*•·:–—-]+/u, "")
    .replace(/[\s*•·:–—-]+$/u, "")
    .trim();
}

function rootFor(element: Element): Document | ShadowRoot {
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root : element.ownerDocument;
}

function elementById(root: Document | ShadowRoot, id: string): Element | null {
  return root.getElementById(id);
}

function textFromIds(element: Element, ids: string): string | null {
  const root = rootFor(element);
  const parts: string[] = [];
  for (const id of ids.split(/\s+/).filter(Boolean)) {
    const target = elementById(root, id);
    if (target) {
      const text = cleanLabelText(target.textContent);
      if (text) parts.push(text);
    }
  }
  return parts.length ? parts.join(" ") : null;
}

function labelFor(element: Element): string | null {
  const root = rootFor(element);
  const labels = root.querySelectorAll("label[for]");
  const id = element.getAttribute("id");
  if (!id) return null;
  for (const label of labels) {
    if (label.getAttribute("for") === id) {
      const text = cleanLabelText(label.textContent);
      if (text) return text;
    }
  }
  return null;
}

function wrappingLabel(element: Element): string | null {
  const label = element.closest("label");
  if (!label) return null;
  const clone = label.cloneNode(true) as HTMLElement;
  for (const input of clone.querySelectorAll("input, select, textarea")) {
    input.remove();
  }
  const text = cleanLabelText(clone.textContent);
  return text || null;
}

function groupText(element: Element): string | null {
  const fieldset = element.closest("fieldset");
  const legend = fieldset?.querySelector("legend");
  if (legend) {
    const text = cleanLabelText(legend.textContent);
    if (text) return text;
  }

  let current: Element | null = element;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    let sibling: Element | null = current.previousElementSibling;
    while (sibling) {
      const text = cleanLabelText(sibling.textContent);
      if (text && text.length <= 120 && !sibling.querySelector("input, select, textarea")) {
        return text;
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return null;
}

export function getFieldLabel(field: Element): string {
  const labelledBy = field.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = textFromIds(field, labelledBy);
    if (text) return text;
  }

  const ariaLabel = cleanLabelText(field.getAttribute("aria-label") ?? "");
  if (ariaLabel) return ariaLabel;

  const explicit = labelFor(field);
  if (explicit) return explicit;

  const wrapping = wrappingLabel(field);
  if (wrapping) return wrapping;

  const title = cleanLabelText(field.getAttribute("title") ?? "");
  if (title) return title;

  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    const placeholder = cleanLabelText(field.placeholder);
    if (placeholder) return placeholder;
  }

  const group = groupText(field);
  if (group) return group;

  return STRINGS.fieldFallbackLabel;
}

export function getAriaDescription(field: Element): string {
  const describedBy = field.getAttribute("aria-describedby");
  if (!describedBy) return "";
  return textFromIds(field, describedBy) ?? "";
}
