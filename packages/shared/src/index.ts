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

export type SeatSnapshot = {
  seatNumber: number;
  player: ParticipantSummary | null;
};

export type AvailableControls = {
  canStartHand: boolean;
  canDealNextHand: boolean;
  canSeatSpectators: boolean;
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
  hasHandStarted: boolean;
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
