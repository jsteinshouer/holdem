import { describe, expect, it } from "vitest";
import { seatAngles } from "../src/table/seatRing";
import { chipRuns } from "../src/lib/chips";
import { describeViewerHand } from "../src/lib/handName";
import type { Card } from "@friendly-holdem/shared";

const card = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("seat ring", () => {
  // The viewer is always anchored at six o'clock so position reads the same on
  // every device. 90deg is the bottom of the ellipse (sin 90 = 1, y grows down).
  it("places the viewer at the bottom of the ring", () => {
    expect(seatAngles(6, 0)[0]).toBe(90);
    expect(seatAngles(6, 3)[3]).toBe(90);
  });

  it("orders opponents clockwise from the viewer", () => {
    const angles = seatAngles(6, 2);

    expect(angles[2]).toBe(90);
    expect(angles[3]).toBe(150);
    expect(angles[4]).toBe(210);
    expect(angles[1]).toBe(30);
  });

  it("spaces seats evenly for any table size", () => {
    expect(seatAngles(2, 0)).toEqual([90, 270]);
    expect(seatAngles(3, 0)).toEqual([90, 210, 330]);
  });

  it("falls back to seat one when the viewer is a spectator", () => {
    expect(seatAngles(6, 0)[0]).toBe(90);
  });
});

describe("chip runs", () => {
  it("breaks an amount into card-room denominations, largest first", () => {
    expect(chipRuns(130)).toEqual([
      { denomination: 100, count: 1 },
      { denomination: 25, count: 1 },
      { denomination: 5, count: 1 }
    ]);
  });

  it("caps how many discs are drawn without changing the amount", () => {
    expect(chipRuns(1631, 2)).toEqual([
      { denomination: 500, count: 3 },
      { denomination: 100, count: 1 }
    ]);
  });

  it("draws nothing for an empty stack", () => {
    expect(chipRuns(0)).toEqual([]);
  });
});

describe("viewer hand naming", () => {
  const board = [card("8", "clubs"), card("K", "diamonds"), card("3", "spades")];

  it("stays silent before there are five cards to name", () => {
    expect(describeViewerHand([card("A", "hearts"), card("8", "hearts")], [])).toBeNull();
    expect(describeViewerHand([], board)).toBeNull();
  });

  it("names a made pair", () => {
    expect(describeViewerHand([card("8", "hearts"), card("2", "diamonds")], board)).toBe("Pair of Eights");
  });

  it("names two pair with both ranks", () => {
    expect(describeViewerHand([card("8", "hearts"), card("K", "clubs")], board)).toBe("Two pair, Kings and Eights");
  });

  it("names trips", () => {
    expect(describeViewerHand([card("8", "hearts"), card("8", "diamonds")], board)).toBe("Three Eights");
  });

  it("falls back to a high card when nothing is made", () => {
    expect(describeViewerHand([card("A", "hearts"), card("6", "diamonds")], board)).toBe("Ace high");
  });

  it("names a flush", () => {
    expect(
      describeViewerHand(
        [card("A", "hearts"), card("6", "hearts")],
        [card("2", "hearts"), card("9", "hearts"), card("J", "hearts")]
      )
    ).toBe("Flush");
  });
});
