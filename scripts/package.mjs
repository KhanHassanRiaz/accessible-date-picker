import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const zipPath = path.join(root, `accessible-date-picker-${packageJson.version}.zip`);

// Always build the production extension. A previous test run may have left a
// test manifest in dist/ that must never be packaged for users.
execFileSync(process.execPath, [path.join(root, "scripts/build.mjs")], {
  cwd: root,
  stdio: "inherit",
});

const output = createWriteStream(zipPath);
const archive = archiver("zip", { zlib: { level: 9 } });

const finished = new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
  archive.on("error", reject);
});

archive.pipe(output);
archive.directory(path.join(root, "dist"), false);
await archive.finalize();
await finished;

console.log(`Wrote ${path.basename(zipPath)} (${archive.pointer()} bytes).`);
