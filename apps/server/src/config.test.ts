import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("loads the MVP defaults", () => {
    expect(loadConfig({})).toEqual({
      port: 8787,
      clientOrigin: "http://localhost:5173",
      clientCorsOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
      defaults: {
        startingStack: 1000,
        blinds: {
          smallBlind: 5,
          bigBlind: 10
        },
        disconnectedActionGraceMs: 30000,
        hostAutoFoldAfterMs: 120000,
        eventLogCap: 200
      }
    });
  });

  it("rejects a big blind that is not larger than the small blind", () => {
    expect(() =>
      loadConfig({
        DEFAULT_SMALL_BLIND: "10",
        DEFAULT_BIG_BLIND: "10"
      })
    ).toThrow("DEFAULT_BIG_BLIND must be at least 11.");
  });

  it("normalizes the allowed client origin", () => {
    expect(loadConfig({ CLIENT_ORIGIN: "https://example.test/play" }).clientOrigin).toBe(
      "https://example.test"
    );
  });

  it("allows both loopback hostnames for local browser websocket connections", () => {
    expect(loadConfig({ CLIENT_ORIGIN: "http://127.0.0.1:5173" }).clientCorsOrigins).toEqual([
      "http://127.0.0.1:5173",
      "http://localhost:5173"
    ]);
  });
});
