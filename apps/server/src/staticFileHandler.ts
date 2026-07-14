import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";

// Structural view of the request-handling logic that serves the built client.
// Extracting it out of index.ts (which runs listen()/store side effects at
// import time) lets the resolution logic be unit-tested with fake req/res
// objects instead of binding a real port. Mirrors the createRealtimeServer
// factory pattern in realtime.ts.
export type StaticFileHandlerDeps = {
  staticClientDir: string;
};

export type StaticResponse = {
  filePath: string;
  contentType: string;
};

export type StaticFileHandler = {
  // Pure resolution: maps a request URL to the file/content-type that should be
  // served. No I/O against the response.
  resolveStaticResponse(requestUrl: string): StaticResponse;
  // Wires resolution to the HTTP response (writeHead + stream the file body).
  serveStaticClient(requestUrl: string, response: ServerResponse): void;
};

export function createStaticFileHandler(deps: StaticFileHandlerDeps): StaticFileHandler {
  const { staticClientDir } = deps;

  function resolveStaticResponse(requestUrl: string): StaticResponse {
    const pathname = new URL(requestUrl, "http://localhost").pathname;
    const requestedPath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    const filePath = safeStaticPath(requestedPath);
    const existingFilePath = filePath && isFile(filePath) ? filePath : join(staticClientDir, "index.html");

    return { filePath: existingFilePath, contentType: contentTypeFor(existingFilePath) };
  }

  function serveStaticClient(requestUrl: string, response: ServerResponse): void {
    let resolution: StaticResponse;

    try {
      resolution = resolveStaticResponse(requestUrl);
    } catch (error) {
      // A malformed request URL (e.g. bad percent-encoding like "/%", "/%c0", or
      // "/%zz") makes decodeURIComponent throw a URIError. Never let it propagate
      // out of the request handler: with no top-level handler that would crash the
      // whole process. Answer with a controlled client error instead.
      const status = error instanceof URIError ? 400 : 500;

      response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
      response.end(status === 400 ? "Bad Request" : "Internal Server Error");
      return;
    }

    response.writeHead(200, { "content-type": resolution.contentType });
    createReadStream(resolution.filePath).pipe(response);
  }

  function safeStaticPath(pathname: string): string | null {
    const filePath = resolve(staticClientDir, normalize(pathname));

    return filePath.startsWith(`${staticClientDir}${sep}`) ? filePath : null;
  }

  function isFile(filePath: string): boolean {
    try {
      return statSync(filePath).isFile();
    } catch {
      return false;
    }
  }

  function contentTypeFor(filePath: string): string {
    const contentTypes: Record<string, string> = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml; charset=utf-8",
      ".webmanifest": "application/manifest+json; charset=utf-8"
    };

    return contentTypes[extname(filePath)] ?? "application/octet-stream";
  }

  return { resolveStaticResponse, serveStaticClient };
}
