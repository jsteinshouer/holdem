import { describe, expect, it } from "vitest";
import {
  connectionStatusLabel,
  isCommandInputDisabled,
  isRaiseAmountInRange,
  raiseBounds,
  raisePresets,
  type ConnectionState
} from "../src/tableView";

describe("raiseBounds", () => {
  it("sets the minimum to the current bet plus a big blind", () => {
    const { minimumRaiseTo } = raiseBounds({ currentBet: 40, bigBlind: 10, viewer: { currentBet: 10, stack: 500 } });
    expect(minimumRaiseTo).toBe(50);
  });

  it("caps the maximum at the viewer's committed chips plus remaining stack (a shove)", () => {
    const { maximumRaiseTo } = raiseBounds({ currentBet: 40, bigBlind: 10, viewer: { currentBet: 20, stack: 130 } });
    expect(maximumRaiseTo).toBe(150);
  });

  it("falls back to the minimum when there is no seated viewer (e.g. a spectator)", () => {
    const bounds = raiseBounds({ currentBet: 40, bigBlind: 10, viewer: null });
    expect(bounds).toEqual({ minimumRaiseTo: 50, maximumRaiseTo: 50 });
  });
});

describe("isRaiseAmountInRange", () => {
  it("accepts a whole number within the range", () => {
    expect(isRaiseAmountInRange(75, 50, 150)).toBe(true);
  });

  it("accepts the inclusive endpoints", () => {
    expect(isRaiseAmountInRange(50, 50, 150)).toBe(true);
    expect(isRaiseAmountInRange(150, 50, 150)).toBe(true);
  });

  it("rejects amounts below the minimum or above the maximum", () => {
    expect(isRaiseAmountInRange(49, 50, 150)).toBe(false);
    expect(isRaiseAmountInRange(151, 50, 150)).toBe(false);
  });

  it("rejects fractional and non-numeric input", () => {
    expect(isRaiseAmountInRange(75.5, 50, 150)).toBe(false);
    // Number("") is 0 and Number("abc") is NaN — both must be rejected as raise-to values.
    expect(isRaiseAmountInRange(Number(""), 50, 150)).toBe(false);
    expect(isRaiseAmountInRange(Number("abc"), 50, 150)).toBe(false);
  });
});

describe("raisePresets", () => {
  it("offers min, a clamped pot-sized raise, and all-in", () => {
    const presets = raisePresets({ minimumRaiseTo: 50, maximumRaiseTo: 500, currentBet: 40, pot: 100, callAmount: 30 });
    expect(presets).toEqual([
      { label: "Min", value: 50 },
      { label: "Pot", value: 170 }, // currentBet 40 + pot 100 + call 30
      { label: "All-in", value: 500 }
    ]);
  });

  it("clamps a pot preset that exceeds the viewer's stack down to all-in", () => {
    const presets = raisePresets({ minimumRaiseTo: 50, maximumRaiseTo: 120, currentBet: 40, pot: 100, callAmount: 30 });
    expect(presets.find((preset) => preset.label === "Pot")?.value).toBe(120);
  });

  it("clamps a pot preset below the minimum up to the minimum", () => {
    const presets = raisePresets({ minimumRaiseTo: 50, maximumRaiseTo: 500, currentBet: 0, pot: 0, callAmount: 0 });
    expect(presets.find((preset) => preset.label === "Pot")?.value).toBe(50);
  });
});

describe("connectionStatusLabel", () => {
  it("shows 'Online' only when connected, otherwise the raw state", () => {
    expect(connectionStatusLabel("connected")).toBe("Online");
    expect(connectionStatusLabel("connecting")).toBe("connecting");
    expect(connectionStatusLabel("offline")).toBe("offline");
  });
});

describe("isCommandInputDisabled", () => {
  it("enables input only with a live socket that is connected", () => {
    expect(isCommandInputDisabled(true, "connected")).toBe(false);
  });

  it("disables input when there is no socket or the connection is not established", () => {
    expect(isCommandInputDisabled(false, "connected")).toBe(true);
    const notConnected: ConnectionState[] = ["connecting", "offline"];
    for (const state of notConnected) {
      expect(isCommandInputDisabled(true, state)).toBe(true);
    }
  });
});
