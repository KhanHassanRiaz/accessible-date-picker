import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const publicDir = path.join(here, "public");
const primaryPort = Number(process.env.ADP_FIXTURE_PORT ?? 4173);
const secondaryPort = primaryPort + 1;

const vendor = new Map([
  ["/vendor/jquery.js", "node_modules/jquery/dist/jquery.min.js"],
  ["/vendor/jquery-ui.js", "node_modules/jquery-ui/dist/jquery-ui.min.js"],
  ["/vendor/jquery-ui.css", "node_modules/jquery-ui/dist/themes/base/jquery-ui.min.css"],
  [
    "/vendor/bootstrap-datepicker.js",
    "node_modules/bootstrap-datepicker/dist/js/bootstrap-datepicker.min.js",
  ],
  [
    "/vendor/bootstrap-datepicker.css",
    "node_modules/bootstrap-datepicker/dist/css/bootstrap-datepicker3.standalone.min.css",
  ],
  ["/vendor/flatpickr.js", "node_modules/flatpickr/dist/flatpickr.min.js"],
  ["/vendor/flatpickr.css", "node_modules/flatpickr/dist/flatpickr.min.css"],
  ["/vendor/pikaday.js", "node_modules/pikaday/pikaday.js"],
  ["/vendor/pikaday.css", "tests/fixtures/vendor/pikaday.css"],
  ["/vendor/zebra_datepicker.js", "tests/fixtures/vendor/zebra_datepicker.js"],
  ["/vendor/zebra.css", "tests/fixtures/vendor/zebra.css"],
  ["/vendor/react.js", "node_modules/react/umd/react.production.min.js"],
  ["/vendor/react-dom.js", "node_modules/react-dom/umd/react-dom.production.min.js"],
]);

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

function resolveInside(base, relative) {
  const resolved = path.resolve(base, relative);
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  if (resolved !== base && !resolved.startsWith(prefix)) return null;
  return resolved;
}

async function sendFile(response, filePath) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;
    const data = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mime.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(data);
    return true;
  } catch {
    return false;
  }
}

function createFixtureServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }

    if (pathname === "/health") {
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("ok");
      return;
    }

    if (pathname.startsWith("/vendor/")) {
      const relative = vendor.get(pathname);
      const filePath = relative ? resolveInside(root, relative) : null;
      if (filePath && (await sendFile(response, filePath))) return;
      response.writeHead(404).end("Not found");
      return;
    }

    const relative = pathname === "/" ? "/index.html" : pathname;
    const filePath = resolveInside(publicDir, `.${relative}`);
    if (filePath && (await sendFile(response, filePath))) return;

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

const servers = [createFixtureServer(), createFixtureServer()];
await listen(servers[0], primaryPort);
await listen(servers[1], secondaryPort);

console.log(`Fixture server: http://127.0.0.1:${primaryPort}/`);
console.log(`Cross-origin fixture server: http://127.0.0.1:${secondaryPort}/`);

function shutdown() {
  for (const server of servers) server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
