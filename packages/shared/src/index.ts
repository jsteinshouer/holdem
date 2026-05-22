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

export type TableSummary = {
  tableId: string;
  viewerRole: ViewerRole;
  seatedPlayerCount: number;
  spectatorCount: number;
  defaults: TableDefaults;
};
