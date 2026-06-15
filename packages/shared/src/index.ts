export type BlindStructure = {
  smallBlind: number;
  bigBlind: number;
};

export type TableDefaults = {
  startingStack: number;
  blinds: BlindStructure;
  disconnectedActionGraceMs: number;
  hostAutoFoldAfterMs: number;
  eventLogCap: number;
};

export type ViewerRole = "host" | "player" | "spectator";

export type ParticipantSummary = {
  id: string;
  displayName: string;
  isHost: boolean;
  isConnected: boolean;
};

export type ChatMessage = {
  id: string;
  participantId: string;
  displayName: string;
  body: string;
  sentAt: string;
};

export type CardSuit = "clubs" | "diamonds" | "hearts" | "spades";

export type CardRank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export type Card = {
  rank: CardRank;
  suit: CardSuit;
};

export type SeatSnapshot = {
  seatNumber: number;
  player:
    | (ParticipantSummary & {
        stack: number;
        currentBet: number;
        hasCards: boolean;
        hasFolded: boolean;
        isAllIn: boolean;
        isSittingOut: boolean;
        isBusted: boolean;
        visibleHoleCards: Card[];
        isButton: boolean;
        isSmallBlind: boolean;
        isBigBlind: boolean;
        isCurrentActor: boolean;
        inactiveForMs: number | null;
      })
    | null;
};

export type AvailableControls = {
  canStartHand: boolean;
  canDealNextHand: boolean;
  canSeatSpectators: boolean;
  canSitOut: boolean;
  canRejoin: boolean;
  canHostAutoFoldInactive: boolean;
};

export type HandPhase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown" | "settled";

export type LegalAction = "fold" | "check" | "call" | "raise" | "all-in";

export type HandSnapshot = {
  phase: HandPhase;
  handNumber: number;
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  board: Card[];
  pot: number;
  currentBet: number;
  callAmount: number;
  currentActorSeat: number | null;
  currentActorId: string | null;
  currentActorSince: number | null;
  legalActions: LegalAction[];
  viewerHoleCards: Card[];
  actionLog: string[];
  settlementSummary: string | null;
};

export type TableSnapshot = {
  tableId: string;
  viewerRole: ViewerRole;
  viewerParticipantId: string;
  hostId: string;
  isHost: boolean;
  invitePath: string;
  inviteUrl?: string;
  seats: SeatSnapshot[];
  spectators: ParticipantSummary[];
  seatedPlayerCount: number;
  spectatorCount: number;
  chatMessages: ChatMessage[];
  hasHandStarted: boolean;
  hand: HandSnapshot;
  availableControls: AvailableControls;
  defaults: TableDefaults;
};

export type CreateTablePayload = {
  displayName: string;
};

export type JoinTablePayload = {
  tableId: string;
  displayName: string;
  sessionToken?: string;
};

export type ReconnectPlayerPayload = {
  tableId: string;
  sessionToken: string;
};

export type StartHandPayload = {
  tableId: string;
};

export type DealNextHandPayload = {
  tableId: string;
};

export type PlayerActionPayload = {
  tableId: string;
  action: LegalAction;
  raiseTo?: number;
};

export type SitOutPayload = {
  tableId: string;
};

export type RejoinPayload = {
  tableId: string;
};

export type ApproveRebuyPayload = {
  tableId: string;
  participantId: string;
};

export type SeatSpectatorPayload = {
  tableId: string;
  participantId: string;
};

export type RemovePlayerPayload = {
  tableId: string;
  participantId: string;
};

export type HostAutoFoldInactivePayload = {
  tableId: string;
};

export type SendChatMessagePayload = {
  tableId: string;
  body: string;
};

export type TableSessionResponse = {
  ok: true;
  sessionToken: string;
  snapshot: TableSnapshot;
};

export type CommandRejectedResponse = {
  ok: false;
  reason: string;
};

export type TableCommandResponse = TableSessionResponse | CommandRejectedResponse;
