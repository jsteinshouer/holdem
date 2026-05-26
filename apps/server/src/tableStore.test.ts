import { describe, expect, it } from "vitest";
import { createDeck, createTableStore } from "./tableStore.js";

const defaults = {
  startingStack: 1000,
  blinds: {
    smallBlind: 5,
    bigBlind: 10
  },
  disconnectedActionGraceMs: 30000,
  hostAutoFoldAfterMs: 120000,
  eventLogCap: 200
};

describe("table store", () => {
  it("creates a unique 52-card deck", () => {
    const deck = createDeck();
    const uniqueCards = new Set(deck.map((card) => `${card.rank}-${card.suit}`));

    expect(deck).toHaveLength(52);
    expect(uniqueCards.size).toBe(52);
  });

  it("creates a private table and assigns the creator as host", () => {
    const store = createTableStore(defaults, "http://client.test");
    const response = store.createTable("Ada");

    expect(response.sessionToken).toHaveLength(43);
    expect(response.snapshot.tableId).toHaveLength(22);
    expect(response.snapshot.viewerRole).toBe("host");
    expect(response.snapshot.isHost).toBe(true);
    expect(response.snapshot.inviteUrl).toBe(`http://client.test/table/${response.snapshot.tableId}`);
    expect(response.snapshot.seats[0]?.player?.displayName).toBe("Ada");
  });

  it("auto-seats participants before the first hand until six seats are filled", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");

    for (let index = 2; index <= 6; index += 1) {
      const response = store.joinTable(host.snapshot.tableId, `Player ${index}`);

      expect(response.snapshot.viewerRole).toBe("player");
      expect(response.snapshot.seatedPlayerCount).toBe(index);
    }
  });

  it("joins participants beyond seat capacity as spectators", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");

    for (let index = 2; index <= 6; index += 1) {
      store.joinTable(host.snapshot.tableId, `Player ${index}`);
    }

    const spectator = store.joinTable(host.snapshot.tableId, "Watcher");

    expect(spectator.snapshot.viewerRole).toBe("spectator");
    expect(spectator.snapshot.seatedPlayerCount).toBe(6);
    expect(spectator.snapshot.spectatorCount).toBe(1);
    expect(spectator.snapshot.spectators[0]?.displayName).toBe("Watcher");
  });

  it("reconnects a browser session to the same identity", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.disconnectParticipant(host.snapshot.tableId, player.snapshot.viewerParticipantId);
    expect(
      store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId).seats[1]?.player
        ?.isConnected
    ).toBe(false);

    const reconnect = store.reconnectTable(host.snapshot.tableId, player.sessionToken);

    expect(reconnect.snapshot.viewerParticipantId).toBe(player.snapshot.viewerParticipantId);
    expect(reconnect.snapshot.viewerRole).toBe("player");
    expect(reconnect.snapshot.seats[1]?.player?.isConnected).toBe(true);
  });

  it("does not expose session tokens in snapshots", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const snapshotJson = JSON.stringify(host.snapshot);

    expect(snapshotJson).not.toContain(host.sessionToken);
  });

  it("lets the host start the first hand with blinds, private cards, and preflop action", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    const response = store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const hostSeat = response.snapshot.seats[0]?.player;
    const playerSeat = response.snapshot.seats[1]?.player;
    const privateTable = store.getTable(host.snapshot.tableId);

    expect(response.snapshot.hasHandStarted).toBe(true);
    expect(response.snapshot.hand.phase).toBe("preflop");
    expect(response.snapshot.hand.buttonSeat).toBe(0);
    expect(response.snapshot.hand.smallBlindSeat).toBe(0);
    expect(response.snapshot.hand.bigBlindSeat).toBe(1);
    expect(response.snapshot.hand.currentActorSeat).toBe(0);
    expect(response.snapshot.hand.currentActorId).toBe(host.snapshot.viewerParticipantId);
    expect(response.snapshot.hand.pot).toBe(15);
    expect(response.snapshot.hand.currentBet).toBe(10);
    expect(response.snapshot.hand.callAmount).toBe(5);
    expect(response.snapshot.hand.legalActions).toEqual(["fold", "call", "raise", "all-in"]);
    expect(response.snapshot.hand.viewerHoleCards).toHaveLength(2);
    expect(hostSeat?.stack).toBe(995);
    expect(hostSeat?.currentBet).toBe(5);
    expect(hostSeat?.isButton).toBe(true);
    expect(hostSeat?.isSmallBlind).toBe(true);
    expect(hostSeat?.isCurrentActor).toBe(true);
    expect(playerSeat?.stack).toBe(990);
    expect(playerSeat?.currentBet).toBe(10);
    expect(playerSeat?.isBigBlind).toBe(true);
    expect(privateTable?.hand?.deck).toHaveLength(48);
    expect(player.snapshot.hand.viewerHoleCards).toEqual([]);
  });

  it("rejects non-host hand starts with a safe reason", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    expect(() => store.startHand(host.snapshot.tableId, player.snapshot.viewerParticipantId)).toThrow(
      "Only the host can start a hand."
    );
  });

  it("requires at least two seated players before the host can start a hand", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");

    expect(() => store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId)).toThrow(
      "At least two seated players are required to start a hand."
    );
  });

  it("sets first preflop actor after the big blind for multi-player tables", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    store.joinTable(host.snapshot.tableId, "Grace");
    store.joinTable(host.snapshot.tableId, "Linus");

    const response = store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(response.snapshot.hand.buttonSeat).toBe(0);
    expect(response.snapshot.hand.smallBlindSeat).toBe(1);
    expect(response.snapshot.hand.bigBlindSeat).toBe(2);
    expect(response.snapshot.hand.currentActorSeat).toBe(0);
    expect(response.snapshot.hand.callAmount).toBe(10);
    expect(response.snapshot.hand.legalActions).toEqual(["fold", "call", "raise", "all-in"]);
  });

  it("only exposes a viewer's own hole cards in player-specific snapshots", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const spectator = store.joinTable(host.snapshot.tableId, "Watcher");

    const privateTable = store.getTable(host.snapshot.tableId);
    const hostHoleCards = privateTable?.hand?.participants.get(host.snapshot.viewerParticipantId)?.holeCards ?? [];
    const playerHoleCards = privateTable?.hand?.participants.get(player.snapshot.viewerParticipantId)?.holeCards ?? [];
    const hostSnapshot = store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const playerSnapshot = store.snapshotFor(host.snapshot.tableId, player.snapshot.viewerParticipantId);
    const spectatorSnapshot = store.snapshotFor(host.snapshot.tableId, spectator.snapshot.viewerParticipantId);

    expect(hostSnapshot.hand.viewerHoleCards).toEqual(hostHoleCards);
    expect(playerSnapshot.hand.viewerHoleCards).toEqual(playerHoleCards);
    expect(spectatorSnapshot.hand.viewerHoleCards).toEqual([]);
    expect(JSON.stringify(hostSnapshot)).not.toContain(JSON.stringify(playerHoleCards[0]));
    expect(JSON.stringify(hostSnapshot)).not.toContain(JSON.stringify(playerHoleCards[1]));
    expect(JSON.stringify(playerSnapshot)).not.toContain(JSON.stringify(hostHoleCards[0]));
    expect(JSON.stringify(playerSnapshot)).not.toContain(JSON.stringify(hostHoleCards[1]));
    expect(JSON.stringify(spectatorSnapshot)).not.toContain(JSON.stringify(hostHoleCards[0]));
    expect(JSON.stringify(spectatorSnapshot)).not.toContain(JSON.stringify(playerHoleCards[0]));
  });
});
