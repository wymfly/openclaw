import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_ROOT = "D:/openclaw/publish";
const DEFAULT_PORT = 8088;
const DEFAULT_HOST = "0.0.0.0";

const MIME = new Map([
  [".ps1", "text/plain; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".gz", "application/gzip"],
  [".tgz", "application/gzip"],
  [".txt", "text/plain; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
]);

function safeJoin(root, requestPath) {
  const cleaned = decodeURIComponent(requestPath.split("?")[0]).replace(/^\/+/, "");
  const resolved = path.resolve(root, cleaned || ".");
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) {
    return null;
  }
  return resolved;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function renderDirectoryIndex(requestPath, targetDir) {
  return fs
    .readdirSync(targetDir, { withFileTypes: true })
    .map((entry) => {
      const href = path.posix.join(requestPath.replace(/\/$/, ""), entry.name);
      return `<li><a href="${href}">${entry.name}</a></li>`;
    })
    .join("");
}

export function createReleaseHttpServer({
  root = process.env.OPENCLAW_RELEASE_ROOT || DEFAULT_ROOT,
  port = Number(process.env.OPENCLAW_RELEASE_PORT || DEFAULT_PORT),
  host = process.env.OPENCLAW_RELEASE_HOST || DEFAULT_HOST,
} = {}) {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      return send(res, 400, "Bad Request");
    }

    const target = safeJoin(root, req.url);
    if (!target) {
      return send(res, 403, "Forbidden");
    }

    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      return send(res, 404, "Not Found");
    }

    if (stat.isDirectory()) {
      const indexHtml = path.join(target, "index.html");
      if (fs.existsSync(indexHtml)) {
        return send(res, 200, fs.readFileSync(indexHtml), {
          "Content-Type": "text/html; charset=utf-8",
        });
      }
      return send(
        res,
        200,
        `<!doctype html><meta charset="utf-8"><title>OpenClaw Releases</title><ul>${renderDirectoryIndex(req.url, target)}</ul>`,
        {
          "Content-Type": "text/html; charset=utf-8",
        },
      );
    }

    const ext = path.extname(target).toLowerCase();
    const type = MIME.get(ext) || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(target).pipe(res);
  });

  return {
    root,
    port,
    host,
    server,
    listen() {
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          console.log(`release-http listening on http://${host}:${port} root=${root}`);
          resolve({ root, port, host });
        });
      });
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await createReleaseHttpServer().listen();
}
