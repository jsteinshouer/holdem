import { describe, expect, it } from "vitest";
import type { ServerResponse } from "node:http";
import { createStaticFileHandler } from "./staticFileHandler.js";

// The handler resolves paths relative to this directory. It does not need to
// exist on disk: for "/" the code always falls back to index.html, and the
// malformed-path case throws before any filesystem access.
const staticClientDir = "/tmp/friendly-holdem-static-fixture/dist";

type FakeResponse = {
  statusCode: number | undefined;
  headers: Record<string, string> | undefined;
  ended: boolean;
  body: string;
};

// Records what the request handler writes without binding a port or needing a
// real writable stream. The malformed-URL cases never reach the file stream.
function createFakeResponse(): FakeResponse & ServerResponse {
  const state: FakeResponse = {
    statusCode: undefined,
    headers: undefined,
    ended: false,
    body: ""
  };

  const fake = {
    ...state,
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this.statusCode = statusCode;
      if (headers) {
        this.headers = headers;
      }
      return this;
    },
    end(chunk?: string) {
      if (chunk) {
        this.body += chunk;
      }
      this.ended = true;
      return this;
    }
  };

  return fake as unknown as FakeResponse & ServerResponse;
}

describe("createStaticFileHandler", () => {
  it("resolves the SPA index for the root path", () => {
    const handler = createStaticFileHandler({ staticClientDir });

    const resolution = handler.resolveStaticResponse("/");

    // Behavior-preservation sanity check for the prefactor: a normal request
    // still resolves to index.html with the HTML content type.
    expect(resolution.filePath.endsWith("index.html")).toBe(true);
    expect(resolution.contentType).toBe("text/html; charset=utf-8");
  });

  // A malformed escape must not propagate a URIError out of the request handler
  // (which would crash the process). Each of these makes decodeURIComponent throw:
  // "/%" is incomplete, "/%c0" is an invalid UTF-8 lead byte, "/%zz" is non-hex.
  it.each(["/%", "/%c0", "/%zz"])(
    "returns a controlled 400 for malformed percent-encoded path %s instead of throwing",
    (malformedPath) => {
      const handler = createStaticFileHandler({ staticClientDir });
      const response = createFakeResponse();

      expect(() => handler.serveStaticClient(malformedPath, response)).not.toThrow();
      expect(response.statusCode).toBe(400);
      expect(response.ended).toBe(true);
    }
  );
});
