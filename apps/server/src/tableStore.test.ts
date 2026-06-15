import { describe, expect, it } from "vitest";
import type { Card } from "@friendly-holdem/shared";
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

  it("reconnects spectators as spectators", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const spectator = store.joinTable(host.snapshot.tableId, "Watcher");

    store.disconnectParticipant(host.snapshot.tableId, spectator.snapshot.viewerParticipantId);
    const reconnect = store.reconnectTable(host.snapshot.tableId, spectator.sessionToken);

    expect(reconnect.snapshot.viewerParticipantId).toBe(spectator.snapshot.viewerParticipantId);
    expect(reconnect.snapshot.viewerRole).toBe("spectator");
    expect(reconnect.snapshot.spectators[0]?.isConnected).toBe(true);
  });

  it("marks between-hand disconnected players sitting out until they reconnect", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.disconnectParticipant(host.snapshot.tableId, player.snapshot.viewerParticipantId);

    expect(
      store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId).seats[1]?.player?.isSittingOut
    ).toBe(true);

    const reconnect = store.reconnectTable(host.snapshot.tableId, player.sessionToken);

    expect(reconnect.snapshot.seats[1]?.player?.isSittingOut).toBe(false);
  });

  it("keeps disconnected players seated during an active hand", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    store.disconnectParticipant(host.snapshot.tableId, player.snapshot.viewerParticipantId);

    const snapshot = store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(snapshot.seats[1]?.player?.displayName).toBe("Grace");
    expect(snapshot.seats[1]?.player?.isConnected).toBe(false);
    expect(snapshot.seats[1]?.player?.isSittingOut).toBe(false);
  });

  it("auto-folds a disconnected current actor after the grace period when checking is not legal", () => {
    let now = 0;
    const store = createTableStore(defaults, undefined, () => now);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    store.disconnectParticipant(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    now = defaults.disconnectedActionGraceMs - 1;
    expect(store.autoActDisconnectedCurrentActor(host.snapshot.tableId)).toBeNull();

    now = defaults.disconnectedActionGraceMs;
    const response = store.autoActDisconnectedCurrentActor(host.snapshot.tableId);

    expect(response?.snapshot.hand.phase).toBe("settled");
    expect(response?.snapshot.seats[0]?.player?.hasFolded).toBe(true);
    expect(response?.snapshot.hand.actionLog).toContain("Host folded.");
    expect(response?.snapshot.hand.settlementSummary).toBe("Grace won $15 after everyone else folded.");
    expect(player.snapshot.viewerParticipantId).toHaveLength(22);
  });

  it("auto-checks a disconnected current actor after the grace period when checking is legal", () => {
    let now = 0;
    const store = createTableStore(defaults, undefined, () => now);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "call");
    store.disconnectParticipant(host.snapshot.tableId, player.snapshot.viewerParticipantId);

    now += defaults.disconnectedActionGraceMs;
    const response = store.autoActDisconnectedCurrentActor(host.snapshot.tableId);

    expect(response?.snapshot.hand.phase).toBe("flop");
    expect(response?.snapshot.hand.actionLog).toContain("Grace checked.");
    expect(response?.snapshot.seats[1]?.player?.hasFolded).toBe(false);
  });

  it("lets the host auto-fold a connected inactive actor only after the threshold", () => {
    let now = 0;
    const store = createTableStore(defaults, undefined, () => now);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(() => store.hostAutoFoldInactive(host.snapshot.tableId, host.snapshot.viewerParticipantId)).toThrow(
      "The current actor has not been inactive long enough."
    );

    now = defaults.hostAutoFoldAfterMs;
    const snapshot = store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(snapshot.availableControls.canHostAutoFoldInactive).toBe(true);

    const response = store.hostAutoFoldInactive(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(response.snapshot.hand.phase).toBe("settled");
    expect(response.snapshot.seats[0]?.player?.hasFolded).toBe(true);
    expect(response.snapshot.hand.settlementSummary).toBe("Grace won $15 after everyone else folded.");
    expect(player.snapshot.viewerParticipantId).toHaveLength(22);
  });

  it("rejects host auto-fold when the current actor is all-in", () => {
    let now = 0;
    const store = createTableStore(defaults, undefined, () => now);
    const host = store.createTable("Host");
    store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const table = store.getTable(host.snapshot.tableId);
    const handState = table?.hand?.participants.get(host.snapshot.viewerParticipantId);

    if (!handState) {
      throw new Error("Expected host to be in the hand.");
    }

    handState.isAllIn = true;
    now = defaults.hostAutoFoldAfterMs;

    expect(() => store.hostAutoFoldInactive(host.snapshot.tableId, host.snapshot.viewerParticipantId)).toThrow(
      "An all-in player cannot be auto-folded."
    );
  });

  it("does not expose session tokens in snapshots", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const snapshotJson = JSON.stringify(host.snapshot);

    expect(snapshotJson).not.toContain(host.sessionToken);
  });

  it("stores bounded escaped table chat messages for players and spectators", () => {
    let now = 0;
    const store = createTableStore({ ...defaults, eventLogCap: 2 }, undefined, () => now);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const spectator = store.joinTable(host.snapshot.tableId, "Watcher");

    const firstChat = store.sendChatMessage(host.snapshot.tableId, host.snapshot.viewerParticipantId, "<hello>");

    expect(firstChat.snapshot.chatMessages[0]?.body).toBe("&lt;hello&gt;");

    now += 1500;
    store.sendChatMessage(host.snapshot.tableId, player.snapshot.viewerParticipantId, "nice hand");
    now += 1500;
    const response = store.sendChatMessage(
      host.snapshot.tableId,
      spectator.snapshot.viewerParticipantId,
      "good luck"
    );

    expect(response.snapshot.chatMessages).toHaveLength(2);
    expect(response.snapshot.chatMessages[0]?.body).toBe("nice hand");
    expect(response.snapshot.chatMessages[1]?.displayName).toBe("Watcher");
    expect(store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId).chatMessages[1]?.body).toBe(
      "good luck"
    );
  });

  it("rate-limits repeated chat messages from the same participant", () => {
    let now = 0;
    const store = createTableStore(defaults, undefined, () => now);
    const host = store.createTable("Host");

    store.sendChatMessage(host.snapshot.tableId, host.snapshot.viewerParticipantId, "first");

    expect(() =>
      store.sendChatMessage(host.snapshot.tableId, host.snapshot.viewerParticipantId, "second")
    ).toThrow("Chat is moving too fast. Please wait a moment.");

    now += 1500;
    expect(store.sendChatMessage(host.snapshot.tableId, host.snapshot.viewerParticipantId, "second").snapshot.chatMessages)
      .toHaveLength(2);
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

  it("updates bets and advances betting rounds through flop, turn, and river", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const callResponse = store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "call");

    expect(callResponse.snapshot.hand.pot).toBe(20);
    expect(callResponse.snapshot.hand.currentActorId).toBe(player.snapshot.viewerParticipantId);
    expect(store.snapshotFor(host.snapshot.tableId, player.snapshot.viewerParticipantId).hand.legalActions).toEqual([
      "check",
      "raise",
      "all-in"
    ]);

    const flopResponse = store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "check");

    expect(flopResponse.snapshot.hand.phase).toBe("flop");
    expect(flopResponse.snapshot.hand.board).toHaveLength(3);
    expect(flopResponse.snapshot.hand.currentBet).toBe(0);
    expect(flopResponse.snapshot.hand.currentActorId).toBe(player.snapshot.viewerParticipantId);

    store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "check");
    const turnResponse = store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "check");

    expect(turnResponse.snapshot.hand.phase).toBe("turn");
    expect(turnResponse.snapshot.hand.board).toHaveLength(4);

    store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "check");
    const riverResponse = store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "check");

    expect(riverResponse.snapshot.hand.phase).toBe("river");
    expect(riverResponse.snapshot.hand.board).toHaveLength(5);
  });

  it("rejects illegal actions without mutating table state", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const before = store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(() => store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "check")).toThrow(
      "It is not your turn."
    );
    expect(store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId)).toEqual(before);
  });

  it("awards the pot without revealing hole cards when everyone else folds", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const response = store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "fold");
    const hostSeat = response.snapshot.seats[0]?.player;
    const playerSeat = response.snapshot.seats[1]?.player;

    expect(response.snapshot.hand.phase).toBe("settled");
    expect(response.snapshot.hand.currentActorId).toBeNull();
    expect(response.snapshot.hand.settlementSummary).toBe("Grace won $15 after everyone else folded.");
    expect(hostSeat?.stack).toBe(995);
    expect(hostSeat?.visibleHoleCards).toEqual([]);
    expect(playerSeat?.stack).toBe(1005);
    expect(playerSeat?.visibleHoleCards).toEqual([]);
  });

  it("settles a simple showdown through hand evaluation and reveals eligible hands", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const privateTable = store.getTable(host.snapshot.tableId);
    const hand = privateTable?.hand;

    if (!hand) {
      throw new Error("Expected an active hand.");
    }

    const hostState = hand.participants.get(host.snapshot.viewerParticipantId);
    const playerState = hand.participants.get(player.snapshot.viewerParticipantId);

    if (!hostState || !playerState) {
      throw new Error("Expected both players to be in the hand.");
    }

    hostState.holeCards = [card("A", "spades"), card("A", "hearts")];
    playerState.holeCards = [card("K", "spades"), card("K", "hearts")];
    hand.deck = [card("2", "spades"), card("3", "clubs"), card("9", "clubs"), card("7", "diamonds"), card("4", "hearts")];

    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "call");
    store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "check");
    const response = store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "check");

    expect(response.snapshot.hand.phase).toBe("settled");
    expect(response.snapshot.hand.settlementSummary).toBe("Host won $20 from the main pot with one pair.");
    expect(response.snapshot.seats[0]?.player?.stack).toBe(1010);
    expect(response.snapshot.seats[1]?.player?.stack).toBe(990);
    expect(response.snapshot.seats[0]?.player?.visibleHoleCards).toEqual([card("A", "spades"), card("A", "hearts")]);
    expect(response.snapshot.seats[1]?.player?.visibleHoleCards).toEqual([card("K", "spades"), card("K", "hearts")]);
  });

  it("allows a player to move all-in and auto-runs the board when no more betting is possible", () => {
    const store = createTableStore({ ...defaults, startingStack: 20 });
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const privateTable = store.getTable(host.snapshot.tableId);
    const hand = privateTable?.hand;

    if (!hand) {
      throw new Error("Expected an active hand.");
    }

    hand.participants.get(host.snapshot.viewerParticipantId)!.holeCards = [card("A", "spades"), card("A", "hearts")];
    hand.participants.get(player.snapshot.viewerParticipantId)!.holeCards = [card("K", "spades"), card("K", "hearts")];
    hand.deck = boardDeck();

    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "all-in");
    const response = store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "call");

    expect(response.snapshot.hand.phase).toBe("settled");
    expect(response.snapshot.hand.pot).toBe(40);
    expect(response.snapshot.hand.board).toHaveLength(5);
    expect(response.snapshot.hand.actionLog).toContain("Host moved all-in for $20.");
    expect(response.snapshot.hand.settlementSummary).toBe("Host won $40 from the main pot with one pair.");
    expect(response.snapshot.seats[0]?.player?.stack).toBe(40);
    expect(response.snapshot.seats[1]?.player?.stack).toBe(0);
  });

  it("keeps a disconnected all-in player eligible for pots", () => {
    const store = createTableStore({ ...defaults, startingStack: 20 });
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");
    const privateTable = store.getTable(host.snapshot.tableId);

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const hand = privateTable?.hand;

    if (!hand) {
      throw new Error("Expected an active hand.");
    }

    hand.participants.get(host.snapshot.viewerParticipantId)!.holeCards = [card("A", "spades"), card("A", "hearts")];
    hand.participants.get(player.snapshot.viewerParticipantId)!.holeCards = [card("K", "spades"), card("K", "hearts")];
    hand.deck = boardDeck();

    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "all-in");
    store.disconnectParticipant(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const response = store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "call");

    expect(response.snapshot.hand.phase).toBe("settled");
    expect(response.snapshot.hand.settlementSummary).toBe("Host won $40 from the main pot with one pair.");
    expect(response.snapshot.seats[0]?.player?.stack).toBe(40);
    expect(response.snapshot.seats[0]?.player?.isConnected).toBe(false);
    expect(response.snapshot.seats[0]?.player?.hasFolded).toBe(false);
  });

  it("creates and settles side pots only among eligible players", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const grace = store.joinTable(host.snapshot.tableId, "Grace");
    const linus = store.joinTable(host.snapshot.tableId, "Linus");
    const privateTable = store.getTable(host.snapshot.tableId);

    privateTable!.participants.get(host.snapshot.viewerParticipantId)!.stack = 100;
    privateTable!.participants.get(grace.snapshot.viewerParticipantId)!.stack = 300;
    privateTable!.participants.get(linus.snapshot.viewerParticipantId)!.stack = 1000;

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const hand = privateTable?.hand;

    if (!hand) {
      throw new Error("Expected an active hand.");
    }

    hand.participants.get(host.snapshot.viewerParticipantId)!.holeCards = [card("A", "spades"), card("A", "hearts")];
    hand.participants.get(grace.snapshot.viewerParticipantId)!.holeCards = [card("Q", "spades"), card("Q", "hearts")];
    hand.participants.get(linus.snapshot.viewerParticipantId)!.holeCards = [card("K", "spades"), card("K", "hearts")];
    hand.deck = boardDeck();

    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "all-in");
    store.playerAction(host.snapshot.tableId, grace.snapshot.viewerParticipantId, "call");
    store.playerAction(host.snapshot.tableId, linus.snapshot.viewerParticipantId, "raise", 300);
    const response = store.playerAction(host.snapshot.tableId, grace.snapshot.viewerParticipantId, "call");

    expect(response.snapshot.hand.phase).toBe("settled");
    expect(response.snapshot.hand.pot).toBe(700);
    expect(response.snapshot.hand.settlementSummary).toBe(
      "Host won $300 from the main pot with one pair. Linus won $400 from the side pot 1 with one pair."
    );
    expect(response.snapshot.seats[0]?.player?.stack).toBe(300);
    expect(response.snapshot.seats[1]?.player?.stack).toBe(0);
    expect(response.snapshot.seats[2]?.player?.stack).toBe(1100);
  });

  it("splits pots deterministically and awards odd chips by seat order", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const grace = store.joinTable(host.snapshot.tableId, "Grace");
    const linus = store.joinTable(host.snapshot.tableId, "Linus");
    const privateTable = store.getTable(host.snapshot.tableId);

    privateTable!.participants.get(host.snapshot.viewerParticipantId)!.stack = 101;
    privateTable!.participants.get(grace.snapshot.viewerParticipantId)!.stack = 101;
    privateTable!.participants.get(linus.snapshot.viewerParticipantId)!.stack = 300;

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const hand = privateTable?.hand;

    if (!hand) {
      throw new Error("Expected an active hand.");
    }

    hand.participants.get(host.snapshot.viewerParticipantId)!.holeCards = [card("A", "spades"), card("5", "hearts")];
    hand.participants.get(grace.snapshot.viewerParticipantId)!.holeCards = [card("A", "clubs"), card("5", "diamonds")];
    hand.participants.get(linus.snapshot.viewerParticipantId)!.holeCards = [card("K", "spades"), card("Q", "hearts")];
    hand.deck = boardDeck();

    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "all-in");
    store.playerAction(host.snapshot.tableId, grace.snapshot.viewerParticipantId, "call");
    const response = store.playerAction(host.snapshot.tableId, linus.snapshot.viewerParticipantId, "all-in");

    expect(response.snapshot.hand.settlementSummary).toBe(
      "Host, Grace split $303 from the main pot with one pair. Linus won $199 from the side pot 1 with high card."
    );
    expect(response.snapshot.seats[0]?.player?.stack).toBe(152);
    expect(response.snapshot.seats[1]?.player?.stack).toBe(151);
    expect(response.snapshot.seats[2]?.player?.stack).toBe(199);
  });

  it("enforces minimum raises", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(() => store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "raise", 15)).toThrow(
      "Raise must be at least $20."
    );
  });

  it("does not reopen raises after a short all-in raise", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const grace = store.joinTable(host.snapshot.tableId, "Grace");
    const linus = store.joinTable(host.snapshot.tableId, "Linus");
    const privateTable = store.getTable(host.snapshot.tableId);

    privateTable!.participants.get(linus.snapshot.viewerParticipantId)!.stack = 15;

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "call");
    store.playerAction(host.snapshot.tableId, grace.snapshot.viewerParticipantId, "call");
    store.playerAction(host.snapshot.tableId, linus.snapshot.viewerParticipantId, "all-in");

    const hostSnapshot = store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(hostSnapshot.hand.currentActorId).toBe(host.snapshot.viewerParticipantId);
    expect(hostSnapshot.hand.callAmount).toBe(5);
    expect(hostSnapshot.hand.legalActions).toEqual(["fold", "call", "all-in"]);
  });

  it("keeps folded cards hidden while revealing showdown-eligible hands", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const grace = store.joinTable(host.snapshot.tableId, "Grace");
    const linus = store.joinTable(host.snapshot.tableId, "Linus");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const privateTable = store.getTable(host.snapshot.tableId);
    const hand = privateTable?.hand;

    if (!hand) {
      throw new Error("Expected an active hand.");
    }

    hand.participants.get(grace.snapshot.viewerParticipantId)!.holeCards = [card("A", "spades"), card("A", "hearts")];
    hand.participants.get(linus.snapshot.viewerParticipantId)!.holeCards = [card("K", "spades"), card("K", "hearts")];
    hand.deck = boardDeck();

    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "fold");
    store.playerAction(host.snapshot.tableId, grace.snapshot.viewerParticipantId, "call");
    store.playerAction(host.snapshot.tableId, linus.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, grace.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, linus.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, grace.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, linus.snapshot.viewerParticipantId, "check");
    store.playerAction(host.snapshot.tableId, grace.snapshot.viewerParticipantId, "check");
    const response = store.playerAction(host.snapshot.tableId, linus.snapshot.viewerParticipantId, "check");

    expect(response.snapshot.hand.phase).toBe("settled");
    expect(response.snapshot.seats[0]?.player?.visibleHoleCards).toEqual([]);
    expect(response.snapshot.seats[1]?.player?.visibleHoleCards).toEqual([card("A", "spades"), card("A", "hearts")]);
    expect(response.snapshot.seats[2]?.player?.visibleHoleCards).toEqual([card("K", "spades"), card("K", "hearts")]);
  });

  it("lets only the host deal the next hand while stacks carry forward and blinds rotate", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "fold");

    expect(() => store.dealNextHand(host.snapshot.tableId, player.snapshot.viewerParticipantId)).toThrow(
      "Only the host can use this control."
    );

    const response = store.dealNextHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(response.snapshot.hand.handNumber).toBe(2);
    expect(response.snapshot.hand.phase).toBe("preflop");
    expect(response.snapshot.hand.buttonSeat).toBe(1);
    expect(response.snapshot.hand.smallBlindSeat).toBe(1);
    expect(response.snapshot.hand.bigBlindSeat).toBe(0);
    expect(response.snapshot.hand.currentActorSeat).toBe(1);
    expect(response.snapshot.seats[0]?.player?.stack).toBe(985);
    expect(response.snapshot.seats[1]?.player?.stack).toBe(1000);
  });

  it("allows sit out and rejoin only between hands and skips sitting-out players", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const grace = store.joinTable(host.snapshot.tableId, "Grace");
    const linus = store.joinTable(host.snapshot.tableId, "Linus");

    const sitOut = store.sitOut(host.snapshot.tableId, grace.snapshot.viewerParticipantId);

    expect(sitOut.snapshot.seats[1]?.player?.isSittingOut).toBe(true);

    const start = store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(start.snapshot.seats[1]?.player?.hasCards).toBe(false);
    expect(start.snapshot.hand.smallBlindSeat).toBe(0);
    expect(start.snapshot.hand.bigBlindSeat).toBe(2);
    expect(() => store.rejoin(host.snapshot.tableId, grace.snapshot.viewerParticipantId)).toThrow(
      "This control is only available between hands."
    );

    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "fold");
    const rejoin = store.rejoin(host.snapshot.tableId, grace.snapshot.viewerParticipantId);
    const nextHand = store.dealNextHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(rejoin.snapshot.seats[1]?.player?.isSittingOut).toBe(false);
    expect(nextHand.snapshot.seats[1]?.player?.hasCards).toBe(true);
    expect(nextHand.snapshot.seatedPlayerCount).toBe(3);
    expect(linus.snapshot.viewerParticipantId).toHaveLength(22);
  });

  it("marks busted players sitting out and lets the host approve a rebuy between hands", () => {
    const store = createTableStore({ ...defaults, startingStack: 20 });
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");
    const privateTable = store.getTable(host.snapshot.tableId);

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    const hand = privateTable?.hand;

    if (!hand) {
      throw new Error("Expected an active hand.");
    }

    hand.participants.get(host.snapshot.viewerParticipantId)!.holeCards = [card("A", "spades"), card("A", "hearts")];
    hand.participants.get(player.snapshot.viewerParticipantId)!.holeCards = [card("K", "spades"), card("K", "hearts")];
    hand.deck = boardDeck();

    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "all-in");
    const settled = store.playerAction(host.snapshot.tableId, player.snapshot.viewerParticipantId, "call");

    expect(settled.snapshot.seats[1]?.player?.stack).toBe(0);
    expect(settled.snapshot.seats[1]?.player?.isBusted).toBe(true);
    expect(settled.snapshot.seats[1]?.player?.isSittingOut).toBe(true);
    expect(() => store.dealNextHand(host.snapshot.tableId, host.snapshot.viewerParticipantId)).toThrow(
      "At least two active seated players are required to deal the next hand."
    );

    const rebuy = store.approveRebuy(
      host.snapshot.tableId,
      host.snapshot.viewerParticipantId,
      player.snapshot.viewerParticipantId
    );

    expect(rebuy.snapshot.seats[1]?.player?.stack).toBe(20);
    expect(rebuy.snapshot.seats[1]?.player?.isSittingOut).toBe(false);
    expect(store.dealNextHand(host.snapshot.tableId, host.snapshot.viewerParticipantId).snapshot.hand.handNumber).toBe(2);
  });

  it("lets the host seat spectators and remove inactive players between hands", () => {
    const store = createTableStore(defaults);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const spectator = store.joinTable(host.snapshot.tableId, "Watcher");

    store.playerAction(host.snapshot.tableId, host.snapshot.viewerParticipantId, "fold");

    const seated = store.seatSpectator(
      host.snapshot.tableId,
      host.snapshot.viewerParticipantId,
      spectator.snapshot.viewerParticipantId
    );

    expect(seated.snapshot.spectatorCount).toBe(0);
    expect(seated.snapshot.seats[2]?.player?.displayName).toBe("Watcher");

    store.disconnectParticipant(host.snapshot.tableId, player.snapshot.viewerParticipantId);

    const removed = store.removePlayer(host.snapshot.tableId, host.snapshot.viewerParticipantId, player.snapshot.viewerParticipantId);

    expect(removed.snapshot.seatedPlayerCount).toBe(2);
    expect(removed.snapshot.seats[1]?.player).toBeNull();
  });

  it("rejects between-hand host controls during an active hand without mutating state", () => {
    const store = createTableStore(defaults, undefined, () => 0);
    const host = store.createTable("Host");
    const player = store.joinTable(host.snapshot.tableId, "Grace");
    const spectator = store.joinTable(host.snapshot.tableId, "Watcher");

    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);
    const before = store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    expect(() =>
      store.approveRebuy(host.snapshot.tableId, host.snapshot.viewerParticipantId, player.snapshot.viewerParticipantId)
    ).toThrow("This control is only available between hands.");
    expect(() =>
      store.seatSpectator(host.snapshot.tableId, host.snapshot.viewerParticipantId, spectator.snapshot.viewerParticipantId)
    ).toThrow("This control is only available between hands.");
    expect(store.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId)).toEqual(before);
  });
});

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function boardDeck(): Card[] {
  return [card("8", "clubs"), card("7", "diamonds"), card("5", "hearts"), card("3", "clubs"), card("2", "diamonds")];
}
