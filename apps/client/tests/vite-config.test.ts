import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vite dev server", () => {
  it("proxies Socket.IO requests to the Node server during local development", async () => {
    const config = await readFile(resolve("vite.config.ts"), "utf8");

    expect(config).toContain('process.env.SOCKET_PROXY_TARGET ?? "http://localhost:8787"');
    expect(config).toContain('"/socket.io"');
    expect(config).toContain("target: socketProxyTarget");
    expect(config).toContain("ws: true");
  });
});
