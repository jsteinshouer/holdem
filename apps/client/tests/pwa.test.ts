import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "../src/pwa";

describe("PWA setup", () => {
  it("links the web app manifest from the client document", async () => {
    const html = await readFile(resolve("index.html"), "utf8");

    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<meta name="theme-color" content="#F2EEE6" />');
  });

  it("declares app identity, theme color, and icons in the manifest", async () => {
    const manifestText = await readFile(resolve("public/manifest.webmanifest"), "utf8");
    const manifest = JSON.parse(manifestText) as {
      name?: string;
      icons?: Array<{ form_factor?: string; src?: string; purpose?: string; sizes?: string; type?: string }>;
      screenshots?: Array<{ src?: string; form_factor?: string; sizes?: string; type?: string }>;
      theme_color?: string;
    };

    expect(manifest.name).toBe("Friendly Hold'em");
    expect(manifest.theme_color).toBe("#F2EEE6");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/friendly-holdem-icon-192.png",
          sizes: "192x192",
          type: "image/png"
        }),
        expect.objectContaining({
          src: "/icons/friendly-holdem-icon-512.png",
          sizes: "512x512",
          type: "image/png"
        }),
        expect.objectContaining({
          src: "/icons/friendly-holdem-maskable-512.png",
          purpose: "maskable",
          sizes: "512x512"
        })
      ])
    );
    expect(manifest.icons).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "image/svg+xml" })])
    );
    expect(manifest.icons?.every((icon) => icon.form_factor === undefined)).toBe(true);
    expect(manifest.screenshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/screenshots/table-wide.png",
          form_factor: "wide",
          sizes: "1280x720",
          type: "image/png"
        }),
        expect.objectContaining({
          src: "/screenshots/table-mobile.png",
          form_factor: "narrow",
          sizes: "390x844",
          type: "image/png"
        })
      ])
    );
  });

  it("registers the service worker with a root scope when production registration is enabled", async () => {
    const register = vi.fn().mockResolvedValue({ scope: "/" });

    await registerServiceWorker({
      enabled: true,
      serviceWorker: { register }
    });

    expect(register).toHaveBeenCalledWith("/service-worker.js", { scope: "/" });
  });

  it("keeps service worker registration disabled outside production", async () => {
    const register = vi.fn();

    await registerServiceWorker({
      enabled: false,
      serviceWorker: { register }
    });

    expect(register).not.toHaveBeenCalled();
  });

  it("caches app-shell assets without handling Socket.IO requests", async () => {
    const serviceWorker = await readFile(resolve("public/service-worker.js"), "utf8");

    expect(serviceWorker).toContain('"/"');
    expect(serviceWorker).toContain('"/manifest.webmanifest"');
    expect(serviceWorker).toContain('"/icons/friendly-holdem-icon-192.png"');
    expect(serviceWorker).toContain('"/screenshots/table-wide.png"');
    expect(serviceWorker).toContain('"/screenshots/table-mobile.png"');
    expect(serviceWorker).toContain('"/fonts/bitter-latin.woff2"');
    expect(serviceWorker).toContain('url.pathname.startsWith("/socket.io/")');
    expect(serviceWorker).not.toContain("push");
    expect(serviceWorker).not.toContain("sync");
  });
});
