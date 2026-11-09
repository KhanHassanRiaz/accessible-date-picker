export type AnnouncementPriority = "polite" | "assertive";

interface LiveRegions {
  polite: HTMLElement;
  assertive: HTMLElement;
  cleanupTimer: number | null;
  token: string;
}

let regions: LiveRegions | null = null;
let sequence = 0;

const HIDDEN_STYLE = [
  "position:absolute",
  "width:1px",
  "height:1px",
  "margin:-1px",
  "padding:0",
  "border:0",
  "overflow:hidden",
  "clip:rect(0 0 0 0)",
  "clip-path:inset(50%)",
  "white-space:nowrap",
].join(";");

function createRegion(priority: AnnouncementPriority, token: string): HTMLElement {
  const region = document.createElement("div");
  region.id = `adp-live-${priority}-${token}`;
  region.setAttribute("aria-live", priority);
  region.setAttribute("aria-atomic", "true");
  region.setAttribute("role", priority === "assertive" ? "alert" : "status");
  region.setAttribute("data-adp-live", priority);
  region.style.cssText = HIDDEN_STYLE;
  document.documentElement.append(region);
  return region;
}

function ensureRegions(): LiveRegions {
  if (regions && regions.polite.isConnected && regions.assertive.isConnected) {
    if (regions.cleanupTimer !== null) {
      window.clearTimeout(regions.cleanupTimer);
      regions.cleanupTimer = null;
    }
    return regions;
  }
  if (regions) {
    regions.polite.remove();
    regions.assertive.remove();
    if (regions.cleanupTimer !== null) window.clearTimeout(regions.cleanupTimer);
  }
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  regions = {
    polite: createRegion("polite", token),
    assertive: createRegion("assertive", token),
    cleanupTimer: null,
    token,
  };
  return regions;
}

export function announce(message: string, priority: AnnouncementPriority = "polite"): void {
  const current = ensureRegions();
  const region = priority === "assertive" ? current.assertive : current.polite;
  const other = priority === "assertive" ? current.polite : current.assertive;
  other.textContent = "";
  region.textContent = "";
  sequence += 1;
  const currentSequence = sequence;
  window.setTimeout(() => {
    if (sequence !== currentSequence) return;
    if (!region.isConnected) return;
    region.textContent = message;
  }, 30);
}

export function scheduleAnnouncementCleanup(delayMs = 10_000): void {
  if (!regions) return;
  const current = regions;
  if (current.cleanupTimer !== null) window.clearTimeout(current.cleanupTimer);
  current.cleanupTimer = window.setTimeout(() => {
    current.polite.remove();
    current.assertive.remove();
    if (regions === current) regions = null;
  }, delayMs);
}

export function cancelAnnouncementCleanup(): void {
  if (regions?.cleanupTimer !== null && regions?.cleanupTimer !== undefined) {
    window.clearTimeout(regions.cleanupTimer);
    regions.cleanupTimer = null;
  }
}

export function liveRegionToken(): string | null {
  return regions?.token ?? null;
}
