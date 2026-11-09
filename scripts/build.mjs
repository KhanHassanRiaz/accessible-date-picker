import { copyFile, cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const testBuild = process.argv.includes("--test");

execFileSync(process.execPath, [path.join(root, "scripts/make-icons.mjs")], {
  cwd: root,
  stdio: "inherit",
});

await mkdir(dist, { recursive: true });

const shared = {
  bundle: true,
  sourcemap: false,
  minify: false,
  target: "chrome102",
  platform: "browser",
  legalComments: "none",
  define: {
    __ADP_TEST__: testBuild ? "true" : "false",
  },
  banner: {
    js: "/* Accessible Date Picker. No remote code, no network calls. */",
  },
  logLevel: "warning",
};

await build({
  ...shared,
  entryPoints: [path.join(root, "src/background/index.ts")],
  outfile: path.join(dist, "background.js"),
  format: "esm",
});

await build({
  ...shared,
  entryPoints: [path.join(root, "src/content/index.ts")],
  outfile: path.join(dist, "content.js"),
  format: "iife",
});

await build({
  ...shared,
  entryPoints: [path.join(root, "src/options/options.ts")],
  outfile: path.join(dist, "options/options.js"),
  format: "iife",
});

await copyFile(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
if (testBuild) {
  // The test hook calls startForTab directly, which does not grant activeTab.
  // Grant the local fixture origins only; the production build never has this.
  const testManifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
  testManifest.host_permissions = ["http://127.0.0.1/*", "http://localhost/*"];
  await writeFile(path.join(dist, "manifest.json"), `${JSON.stringify(testManifest, null, 2)}\n`);
}
await mkdir(path.join(dist, "options"), { recursive: true });
await copyFile(
  path.join(root, "src/options/options.html"),
  path.join(dist, "options/options.html"),
);
await copyFile(path.join(root, "src/options/options.css"), path.join(dist, "options/options.css"));
await cp(path.join(root, "assets/icons"), path.join(dist, "icons"), { recursive: true });

const license = path.join(root, "LICENSE");
try {
  await stat(license);
  await copyFile(license, path.join(dist, "LICENSE"));
} catch {
  // LICENSE is copied when present.
}

const manifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
const required = [
  manifest.background.service_worker,
  manifest.options_ui.page,
  "content.js",
  "background.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
];
for (const relative of required) {
  try {
    await stat(path.join(dist, relative));
  } catch {
    throw new Error(`Build is missing ${relative}`);
  }
}

console.log(`Built ${testBuild ? "test" : "production"} extension in dist/.`);
