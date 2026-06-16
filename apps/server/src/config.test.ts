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
      },
      activeTablePersistence: {
        mode: "memory",
        sqlitePath: expect.stringContaining("friendly-holdem"),
        inactivityTtlMs: 604800000
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

  it("loads sqlite active table persistence settings", () => {
    expect(
      loadConfig({
        ACTIVE_TABLE_PERSISTENCE: "sqlite",
        ACTIVE_TABLE_SQLITE_PATH: "C:\\data\\friendly-holdem.sqlite",
        ACTIVE_TABLE_INACTIVITY_TTL_MS: "60000"
      }).activeTablePersistence
    ).toEqual({
      mode: "sqlite",
      sqlitePath: "C:\\data\\friendly-holdem.sqlite",
      inactivityTtlMs: 60000
    });
  });

  it("rejects invalid active table persistence settings", () => {
    expect(() => loadConfig({ ACTIVE_TABLE_PERSISTENCE: "postgres" })).toThrow(
      "ACTIVE_TABLE_PERSISTENCE must be either memory or sqlite."
    );
    expect(() => loadConfig({ ACTIVE_TABLE_SQLITE_PATH: " " })).toThrow(
      "ACTIVE_TABLE_SQLITE_PATH must not be empty."
    );
    expect(() => loadConfig({ ACTIVE_TABLE_INACTIVITY_TTL_MS: "999" })).toThrow(
      "ACTIVE_TABLE_INACTIVITY_TTL_MS must be at least 1000."
    );
  });
});
