import { randomBytes } from "node:crypto";
import type {
  TableDefaults,
  TableSnapshot,
  TableSessionResponse,
  ViewerRole
} from "@friendly-holdem/shared";

const MAX_SEATS = 6;
const MAX_DISPLAY_NAME_LENGTH = 32;

type ParticipantKind = "player" | "spectator";

export type Participant = {
  id: string;
  displayName: string;
  sessionToken: string;
  kind: ParticipantKind;
  seatNumber: number | null;
  isConnected: boolean;
};

export type PrivateTable = {
  id: string;
  hostId: string;
  participants: Map<string, Participant>;
  participantIdsByToken: Map<string, string>;
  hasHandStarted: boolean;
  defaults: TableDefaults;
};

export type TableStore = ReturnType<typeof createTableStore>;

export function createTableStore(defaults: TableDefaults, origin?: string) {
  const tables = new Map<string, PrivateTable>();

  function createTable(displayName: string): TableSessionResponse {
    const tableId = createUniqueId(tables);
    const host = createParticipant(displayName, "player", 0);
    const table: PrivateTable = {
      id: tableId,
      hostId: host.id,
      participants: new Map([[host.id, host]]),
      participantIdsByToken: new Map([[host.sessionToken, host.id]]),
      hasHandStarted: false,
      defaults
    };

    tables.set(table.id, table);

    return {
      ok: true,
      sessionToken: host.sessionToken,
      snapshot: createSnapshot(table, host.id, origin)
    };
  }

  function joinTable(tableId: string, displayName: string, sessionToken?: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);

    if (sessionToken) {
      const reconnected = reconnectParticipant(table, sessionToken);

      if (reconnected) {
        return {
          ok: true,
          sessionToken: reconnected.sessionToken,
          snapshot: createSnapshot(table, reconnected.id, origin)
        };
      }
    }

    const seatNumber = nextOpenSeat(table);
    const participant =
      !table.hasHandStarted && seatNumber !== null
        ? createParticipant(displayName, "player", seatNumber)
        : createParticipant(displayName, "spectator", null);

    table.participants.set(participant.id, participant);
    table.participantIdsByToken.set(participant.sessionToken, participant.id);

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin)
    };
  }

  function reconnectTable(tableId: string, sessionToken: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const participant = reconnectParticipant(table, sessionToken);

    if (!participant) {
      throw new Error("Session was not found for this table.");
    }

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin)
    };
  }

  function disconnectParticipant(tableId: string, participantId: string): void {
    const participant = tables.get(tableId)?.participants.get(participantId);

    if (participant) {
      participant.isConnected = false;
    }
  }

  function snapshotFor(tableId: string, participantId: string): TableSnapshot {
    return createSnapshot(getExistingTable(tables, tableId), participantId, origin);
  }

  function getTable(tableId: string): PrivateTable | undefined {
    return tables.get(tableId);
  }

  return {
    createTable,
    joinTable,
    reconnectTable,
    disconnectParticipant,
    snapshotFor,
    getTable
  };
}

function createParticipant(
  displayName: string,
  kind: ParticipantKind,
  seatNumber: number | null
): Participant {
  return {
    id: randomToken(16),
    displayName: normalizeDisplayName(displayName),
    sessionToken: randomToken(32),
    kind,
    seatNumber,
    isConnected: true
  };
}

function createSnapshot(table: PrivateTable, viewerParticipantId: string, origin?: string): TableSnapshot {
  const viewer = table.participants.get(viewerParticipantId);

  if (!viewer) {
    throw new Error("Viewer was not found for this table.");
  }

  const viewerRole: ViewerRole =
    viewer.id === table.hostId ? "host" : viewer.kind === "player" ? "player" : "spectator";
  const seats = Array.from({ length: MAX_SEATS }, (_, seatNumber) => {
    const player =
      [...table.participants.values()].find(
        (participant) => participant.kind === "player" && participant.seatNumber === seatNumber
      ) ?? null;

    return {
      seatNumber,
      player: player ? summarizeParticipant(player, table.hostId) : null
    };
  });
  const spectators = [...table.participants.values()]
    .filter((participant) => participant.kind === "spectator")
    .map((participant) => summarizeParticipant(participant, table.hostId));
  const invitePath = `/table/${table.id}`;

  return {
    tableId: table.id,
    viewerRole,
    viewerParticipantId,
    hostId: table.hostId,
    isHost: viewer.id === table.hostId,
    invitePath,
    ...(origin ? { inviteUrl: new URL(invitePath, origin).toString() } : {}),
    seats,
    spectators,
    seatedPlayerCount: seats.filter((seat) => seat.player).length,
    spectatorCount: spectators.length,
    hasHandStarted: table.hasHandStarted,
    availableControls: {
      canStartHand: viewer.id === table.hostId && !table.hasHandStarted,
      canDealNextHand: false,
      canSeatSpectators:
        viewer.id === table.hostId && !table.hasHandStarted && spectators.length > 0 && nextOpenSeat(table) !== null
    },
    defaults: table.defaults
  };
}

function summarizeParticipant(participant: Participant, hostId: string) {
  return {
    id: participant.id,
    displayName: participant.displayName,
    isHost: participant.id === hostId,
    isConnected: participant.isConnected
  };
}

function reconnectParticipant(table: PrivateTable, sessionToken: string): Participant | undefined {
  const participantId = table.participantIdsByToken.get(sessionToken);
  const participant = participantId ? table.participants.get(participantId) : undefined;

  if (participant) {
    participant.isConnected = true;
  }

  return participant;
}

function nextOpenSeat(table: PrivateTable): number | null {
  const occupiedSeats = new Set(
    [...table.participants.values()]
      .filter((participant) => participant.kind === "player" && participant.seatNumber !== null)
      .map((participant) => participant.seatNumber)
  );

  for (let seatNumber = 0; seatNumber < MAX_SEATS; seatNumber += 1) {
    if (!occupiedSeats.has(seatNumber)) {
      return seatNumber;
    }
  }

  return null;
}

function getExistingTable(tables: Map<string, PrivateTable>, tableId: string): PrivateTable {
  const table = tables.get(tableId);

  if (!table) {
    throw new Error("Table was not found.");
  }

  return table;
}

function createUniqueId(tables: Map<string, PrivateTable>): string {
  let tableId = randomToken(16);

  while (tables.has(tableId)) {
    tableId = randomToken(16);
  }

  return tableId;
}

function randomToken(byteLength: number): string {
  return randomBytes(byteLength).toString("base64url");
}

function normalizeDisplayName(displayName: string): string {
  const normalized = displayName.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Display name is required.");
  }

  if (normalized.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error(`Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`);
  }

  return normalized;
}
