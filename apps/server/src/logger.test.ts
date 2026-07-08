import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.js";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes structured JSON with timestamp, level, service, message and context", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createLogger("server").info("table created", { tableId: "abc", seats: 6 });

    expect(log).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(log.mock.calls[0]![0] as string);
    expect(entry).toMatchObject({
      level: "info",
      service: "server",
      message: "table created",
      tableId: "abc",
      seats: 6
    });
    expect(typeof entry.timestamp).toBe("string");
  });

  it("routes warn and error to their matching console channels", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("server");

    logger.warn("slow command");
    logger.error("startup failed");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    expect(JSON.parse(warn.mock.calls[0]![0] as string).level).toBe("warn");
    expect(JSON.parse(error.mock.calls[0]![0] as string).level).toBe("error");
  });

  it("drops undefined context fields so redacted values never surface as keys", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // A caller that redacts a secret passes undefined; it must not appear at all.
    createLogger("server").info("player action", { tableId: "abc", holeCards: undefined, sessionToken: undefined });

    const entry = JSON.parse(log.mock.calls[0]![0] as string);
    expect(entry).not.toHaveProperty("holeCards");
    expect(entry).not.toHaveProperty("sessionToken");
    expect(entry).toHaveProperty("tableId", "abc");
  });

  it("keeps null and false context values because only undefined is dropped", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createLogger("server").info("table restored", { restored: false, currentActor: null });

    const entry = JSON.parse(log.mock.calls[0]![0] as string);
    expect(entry.restored).toBe(false);
    expect(entry.currentActor).toBeNull();
  });
});
