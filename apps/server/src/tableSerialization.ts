import { type TableDefaults } from "@friendly-holdem/shared";
import { ACTIVE_TABLE_SCHEMA_VERSION } from "./activeTablePersistence.js";
import {
  type Participant,
  type PrivateTable,
  type SerializedActiveHand,
  type SerializedActiveTableState
} from "./tableTypes.js";

export function serializeTable(table: PrivateTable): SerializedActiveTableState {
  return {
    schemaVersion: ACTIVE_TABLE_SCHEMA_VERSION,
    table: {
      id: table.id,
      hostId: table.hostId,
      participants: [...table.participants.values()].map((participant) => ({ ...participant })),
      hasHandStarted: table.hasHandStarted,
      hand: table.hand
        ? {
            ...table.hand,
            deck: [...table.hand.deck],
            board: [...table.hand.board],
            participants: [...table.hand.participants.values()].map((participant) => ({
              ...participant,
              holeCards: [...participant.holeCards]
            })),
            actionLog: [...table.hand.actionLog]
          }
        : null,
      chatMessages: table.chatMessages.map((message) => ({ ...message })),
      defaults: table.defaults
    }
  };
}

export function deserializeTable(state: SerializedActiveTableState, defaults: TableDefaults): PrivateTable {
  assertActiveTableState(state);

  const participants = new Map(
    state.table.participants.map((participant) => [
      participant.id,
      {
        ...participant,
        isBot: participant.isBot === true,
        botStrategyId: participant.botStrategyId ?? null,
        // Bots have no socket, so they stay connected across a restart while
        // humans reconnect with their session tokens.
        isConnected: participant.isBot === true
      }
    ])
  );

  if (!participants.has(state.table.hostId)) {
    throw new Error("persisted active table host was not found");
  }

  return {
    id: state.table.id,
    hostId: state.table.hostId,
    participants,
    participantIdsByToken: new Map(state.table.participants.map((participant) => [participant.sessionToken, participant.id])),
    hasHandStarted: state.table.hasHandStarted,
    hand: state.table.hand
      ? {
          ...state.table.hand,
          deck: [...state.table.hand.deck],
          board: [...state.table.hand.board],
          participants: new Map(
            state.table.hand.participants.map((participant) => [
              participant.participantId,
              {
                ...participant,
                holeCards: [...participant.holeCards]
              }
            ])
          ),
          actionLog: [...state.table.hand.actionLog]
        }
      : null,
    chatMessages: state.table.chatMessages.map((message) => ({ ...message })),
    defaults: state.table.defaults ?? defaults
  };
}

function assertActiveTableState(value: SerializedActiveTableState): void {
  if (!isRecord(value) || value.schemaVersion !== ACTIVE_TABLE_SCHEMA_VERSION || !isRecord(value.table)) {
    throw new Error("unsupported active table persistence schema version");
  }

  const table = value.table;

  if (
    typeof table.id !== "string" ||
    typeof table.hostId !== "string" ||
    !Array.isArray(table.participants) ||
    typeof table.hasHandStarted !== "boolean" ||
    !Array.isArray(table.chatMessages)
  ) {
    throw new Error("invalid persisted active table state");
  }

  for (const participant of table.participants) {
    assertParticipant(participant);
  }

  if (table.hand !== null) {
    assertActiveHand(table.hand);
  }
}

function assertParticipant(value: Participant): void {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.displayName !== "string" ||
    typeof value.sessionToken !== "string" ||
    (value.kind !== "player" && value.kind !== "spectator") ||
    (typeof value.seatNumber !== "number" && value.seatNumber !== null) ||
    typeof value.stack !== "number" ||
    typeof value.isSittingOut !== "boolean" ||
    typeof value.isConnected !== "boolean" ||
    (value.isBot !== undefined && typeof value.isBot !== "boolean") ||
    (value.botStrategyId !== undefined && value.botStrategyId !== null && typeof value.botStrategyId !== "string") ||
    (typeof value.lastChatSentAt !== "number" && value.lastChatSentAt !== null)
  ) {
    throw new Error("invalid persisted participant state");
  }
}

function assertActiveHand(value: SerializedActiveHand): void {
  if (
    !isRecord(value) ||
    !["preflop", "flop", "turn", "river", "showdown", "settled"].includes(String(value.phase)) ||
    typeof value.handNumber !== "number" ||
    !Array.isArray(value.deck) ||
    !Array.isArray(value.board) ||
    typeof value.buttonSeat !== "number" ||
    typeof value.smallBlindSeat !== "number" ||
    typeof value.bigBlindSeat !== "number" ||
    (typeof value.currentActorSeat !== "number" && value.currentActorSeat !== null) ||
    (typeof value.currentActorSince !== "number" && value.currentActorSince !== null) ||
    !Array.isArray(value.participants) ||
    typeof value.pot !== "number" ||
    typeof value.currentBet !== "number" ||
    typeof value.minimumRaiseIncrement !== "number" ||
    !Array.isArray(value.actionLog) ||
    (typeof value.settlementSummary !== "string" && value.settlementSummary !== null) ||
    typeof value.shouldRevealHoleCards !== "boolean"
  ) {
    throw new Error("invalid persisted hand state");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
