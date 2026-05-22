import { describe, expect, it } from "vitest";
import type { TableDefaults } from "./index";

describe("shared table defaults type", () => {
  it("supports the fixed MVP blind and stack defaults", () => {
    const defaults: TableDefaults = {
      startingStack: 1000,
      blinds: {
        smallBlind: 5,
        bigBlind: 10
      },
      disconnectedActionGraceMs: 30000,
      hostAutoFoldAfterMs: 120000,
      eventLogCap: 200
    };

    expect(defaults.blinds.bigBlind).toBe(10);
  });
});
