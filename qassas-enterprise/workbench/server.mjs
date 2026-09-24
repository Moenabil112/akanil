import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const root = fileURLToPath(new URL("./", import.meta.url));
const port = Number(process.env.QASSAS_WORKBENCH_PORT ?? 3000);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const safe = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const file = join(root, safe);

  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "content-type": types[extname(file)] ?? "application/octet-stream",
    "cache-control": extname(file) === ".html" ? "no-store" : "public, max-age=60",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy":
      "default-src 'self'; connect-src 'self' http://localhost:3001 http://localhost:8080; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self' http://localhost:8080",
  });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`QASSAS Workbench listening on http://localhost:${port}`);
});
