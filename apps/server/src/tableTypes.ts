import { type Card, type ChatMessage, type TableDefaults } from "@friendly-holdem/shared";
import { ACTIVE_TABLE_SCHEMA_VERSION } from "./activeTablePersistence.js";

export type ParticipantKind = "player" | "spectator";

export type Participant = {
  id: string;
  displayName: string;
  sessionToken: string;
  kind: ParticipantKind;
  seatNumber: number | null;
  stack: number;
  isSittingOut: boolean;
  isConnected: boolean;
  isBot: boolean;
  botStrategyId: string | null;
  lastChatSentAt: number | null;
};

export type HandParticipantState = {
  participantId: string;
  seatNumber: number;
  holeCards: Card[];
  currentBet: number;
  totalCommitted: number;
  hasFolded: boolean;
  hasActed: boolean;
  isAllIn: boolean;
};

export type ActiveHand = {
  handNumber: number;
  phase: "preflop" | "flop" | "turn" | "river" | "showdown" | "settled";
  deck: Card[];
  board: Card[];
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentActorSeat: number | null;
  currentActorSince: number | null;
  participants: Map<string, HandParticipantState>;
  pot: number;
  currentBet: number;
  minimumRaiseIncrement: number;
  actionLog: string[];
  settlementSummary: string | null;
  shouldRevealHoleCards: boolean;
};

export type PrivateTable = {
  id: string;
  hostId: string;
  participants: Map<string, Participant>;
  participantIdsByToken: Map<string, string>;
  hasHandStarted: boolean;
  hand: ActiveHand | null;
  chatMessages: ChatMessage[];
  defaults: TableDefaults;
};

export type SerializedActiveTableState = {
  schemaVersion: typeof ACTIVE_TABLE_SCHEMA_VERSION;
  table: {
    id: string;
    hostId: string;
    participants: Participant[];
    hasHandStarted: boolean;
    hand: SerializedActiveHand | null;
    chatMessages: ChatMessage[];
    defaults: TableDefaults;
  };
};

export type SerializedActiveHand = Omit<ActiveHand, "participants"> & {
  participants: HandParticipantState[];
};

export type Pot = {
  amount: number;
  eligibleParticipantIds: string[];
};
