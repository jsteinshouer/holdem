import { describe, expect, it } from "vitest";
import { createTableStore } from "./tableStore.js";

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
});
