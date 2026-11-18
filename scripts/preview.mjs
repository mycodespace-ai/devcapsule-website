import { selectedFolders } from "./presentations.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { root, contentRoot, prefix, walk } from "./content.mjs";
process.chdir(root);
const output = path.join(root, "_site");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};
const build = () =>
  execFileSync(process.execPath, ["scripts/build.mjs"], { stdio: "inherit" });
build();
const base = prefix();
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(base)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    let file = path.resolve(
      output,
      "." + "/" + decodeURIComponent(url.pathname.slice(base.length)),
    );
    if (!file.startsWith(output + path.sep) && file !== output) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        res.writeHead(301, { Location: url.pathname + "/" + url.search });
        res.end();
        return;
      }
      file = path.join(file, "index.html");
    }
    const exists = fs.existsSync(file) && fs.statSync(file).isFile();
    if (!exists) file = path.join(output, "404.html");
    const headers = {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    };
    const size = fs.statSync(file).size;
    let range;
    if (exists && headers["Content-Type"].startsWith("video/")) {
      headers["Accept-Ranges"] = "bytes";
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
      if (match && (match[1] || match[2])) {
        const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
        const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
        if (start > end) {
          res.writeHead(416, { ...headers, "Content-Range": "bytes */" + size });
          res.end();
          return;
        }
        range = { start, end };
        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
      }
    }
    headers["Content-Length"] = range ? range.end - range.start + 1 : size;
    res.writeHead(range ? 206 : exists ? 200 : 404, headers);
    if (req.method === "HEAD") return res.end();
    const stream = fs.createReadStream(file, range);
    res.on("close", () => stream.destroy());
    stream
      .on("error", () => res.end())
      .pipe(res);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
  }
});
let port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT must be between 1024 and 65535.");
server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && port < 65535) {
    port++;
    server.listen(port, "127.0.0.1");
  } else throw error;
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `\nDevCapsule preview: http://127.0.0.1:${port}${base}\n${process.argv.includes("--watch") ? "Watching content and presentation. Refresh the browser after rebuilding." : "Press Ctrl+C to stop."}`,
  ),
);
if (process.argv.includes("--watch")) {
  const dir = contentRoot();
  const stamp = () => {
    const paths = [
      path.join(dir, "README.md"),
      ...walk(path.join(dir, "docs")),
      ...walk(path.join(dir, "engineering-docs/blog")),
      ...selectedFolders.flatMap(folder => {
        const full = path.join(dir, folder);
        return fs.existsSync(full) ? walk(full) : [];
      }),
      ...walk(path.join(root, "src")),
      ...walk(path.join(root, "scripts")),
      path.join(root, "eleventy.config.js"),
    ];
    return paths
      .map((file) => file + ":" + fs.statSync(file).mtimeMs)
      .join("|");
  };
  let previous = stamp();
  setInterval(() => {
    const next = stamp();
    if (next !== previous) {
      previous = next;
      try {
        build();
        console.log("Preview updated. Refresh your browser.");
      } catch {
        console.error(
          "Build failed; fix the reported content/configuration problem to rebuild.",
        );
      }
    }
  }, 1000);
}
