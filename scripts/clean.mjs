import { rm } from "node:fs/promises";

const targets = ["dist", "playwright-report", "test-results"];

for (const target of targets) {
  await rm(target, { recursive: true, force: true });
}

console.log("Removed build and test output.");
