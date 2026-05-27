import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import type {
  Card,
  CreateTablePayload,
  JoinTablePayload,
  LegalAction,
  PlayerActionPayload,
  StartHandPayload,
  TableCommandResponse,
  TableSnapshot
} from "@friendly-holdem/shared";
import "./styles.css";

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787";

type ConnectionState = "connecting" | "connected" | "offline";

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [snapshot, setSnapshot] = useState<TableSnapshot | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tableIdFromUrl = getTableIdFromPath();

  useEffect(() => {
    const nextSocket = io(serverUrl, {
      autoConnect: true,
      transports: ["websocket", "polling"]
    });

    nextSocket.on("connect", () => setConnectionState("connected"));
    nextSocket.on("disconnect", () => setConnectionState("offline"));
    nextSocket.on("connect_error", () => setConnectionState("offline"));
    nextSocket.on("table:snapshot", (nextSnapshot: TableSnapshot) => {
      setSnapshot(nextSnapshot);
      rememberLastTable(nextSnapshot.tableId);
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket || !tableIdFromUrl) {
      return;
    }

    const sessionToken = readSessionToken(tableIdFromUrl);

    if (!sessionToken) {
      return;
    }

    emitCommand(socket, "player:reconnect", { tableId: tableIdFromUrl, sessionToken })
      .then(handleSessionResponse)
      .catch((nextError: Error) => setError(nextError.message));
  }, [socket, tableIdFromUrl]);

  const inviteLink = useMemo(() => {
    if (!snapshot) {
      return "";
    }

    return new URL(snapshot.invitePath, window.location.origin).toString();
  }, [snapshot]);

  async function createTable() {
    if (!socket) {
      return;
    }

    setError(null);

    try {
      const response = await emitCommand<CreateTablePayload>(socket, "table:create", { displayName });
      const nextSnapshot = handleSessionResponse(response);
      window.history.replaceState(null, "", nextSnapshot.invitePath);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create table.");
    }
  }

  async function joinTable() {
    if (!socket || !tableIdFromUrl) {
      return;
    }

    setError(null);

    try {
      const sessionToken = readSessionToken(tableIdFromUrl);
      const response = await emitCommand<JoinTablePayload>(socket, "table:join", {
        tableId: tableIdFromUrl,
        displayName,
        ...(sessionToken ? { sessionToken } : {})
      });
      handleSessionResponse(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to join table.");
    }
  }

  async function startHand() {
    if (!socket || !snapshot) {
      return;
    }

    setError(null);

    try {
      const response = await emitCommand<StartHandPayload>(socket, "hand:start", {
        tableId: snapshot.tableId
      });
      handleSessionResponse(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to start hand.");
    }
  }

  async function playerAction(action: PlayerActionPayload["action"], raiseTo?: number) {
    if (!socket || !snapshot) {
      return;
    }

    setError(null);

    try {
      const response = await emitCommand<PlayerActionPayload>(socket, "player:action", {
        tableId: snapshot.tableId,
        action,
        ...(raiseTo ? { raiseTo } : {})
      });
      handleSessionResponse(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to act.");
    }
  }

  function handleSessionResponse(response: TableCommandResponse): TableSnapshot {
    if (!response.ok) {
      throw new Error(response.reason);
    }

    storeSessionToken(response.snapshot.tableId, response.sessionToken);
    rememberLastTable(response.snapshot.tableId);
    setSnapshot(response.snapshot);
    setDisplayName("");

    return response.snapshot;
  }

  return (
    <main className="app-shell">
      <section className="room-board" aria-labelledby="app-heading">
        <header className="room-board__masthead">
          <div>
            <p className="eyebrow">Private Hold'em Room</p>
            <h1 id="app-heading">Friendly Hold'em</h1>
          </div>
          <span className={`status-pill status-pill--${connectionState}`}>
            {connectionState === "connected" ? "Online" : connectionState}
          </span>
        </header>

        {snapshot ? (
          <TableRoom
            error={error}
            inviteLink={inviteLink}
            snapshot={snapshot}
            onPlayerAction={playerAction}
            onStartHand={startHand}
          />
        ) : tableIdFromUrl ? (
          <JoinTablePanel
            displayName={displayName}
            error={error}
            isDisabled={!socket || connectionState !== "connected"}
            tableId={tableIdFromUrl}
            onDisplayNameChange={setDisplayName}
            onJoin={joinTable}
          />
        ) : (
          <CreateTablePanel
            displayName={displayName}
            error={error}
            isDisabled={!socket || connectionState !== "connected"}
            onDisplayNameChange={setDisplayName}
            onCreate={createTable}
          />
        )}
      </section>
    </main>
  );
}

function CreateTablePanel(props: {
  displayName: string;
  error: string | null;
  isDisabled: boolean;
  onDisplayNameChange: (displayName: string) => void;
  onCreate: () => void;
}) {
  return (
    <form
      className="entry-panel"
      onSubmit={(event) => {
        event.preventDefault();
        props.onCreate();
      }}
    >
      <label htmlFor="create-display-name">Your display name</label>
      <div className="entry-panel__row">
        <input
          id="create-display-name"
          maxLength={32}
          required
          value={props.displayName}
          onChange={(event) => props.onDisplayNameChange(event.target.value)}
        />
        <button disabled={props.isDisabled} type="submit">
          Create table
        </button>
      </div>
      {props.error ? <p className="form-error">{props.error}</p> : null}
    </form>
  );
}

function JoinTablePanel(props: {
  displayName: string;
  error: string | null;
  isDisabled: boolean;
  tableId: string;
  onDisplayNameChange: (displayName: string) => void;
  onJoin: () => void;
}) {
  return (
    <form
      className="entry-panel"
      onSubmit={(event) => {
        event.preventDefault();
        props.onJoin();
      }}
    >
      <p className="table-code">Invite {props.tableId}</p>
      <label htmlFor="join-display-name">Your display name</label>
      <div className="entry-panel__row">
        <input
          id="join-display-name"
          maxLength={32}
          required
          value={props.displayName}
          onChange={(event) => props.onDisplayNameChange(event.target.value)}
        />
        <button disabled={props.isDisabled} type="submit">
          Join table
        </button>
      </div>
      {props.error ? <p className="form-error">{props.error}</p> : null}
    </form>
  );
}

function TableRoom({
  error,
  snapshot,
  inviteLink,
  onPlayerAction,
  onStartHand
}: {
  error: string | null;
  snapshot: TableSnapshot;
  inviteLink: string;
  onPlayerAction: (action: PlayerActionPayload["action"], raiseTo?: number) => void;
  onStartHand: () => void;
}) {
  const [raiseTo, setRaiseTo] = useState(() => String(snapshot.hand.currentBet + snapshot.defaults.blinds.bigBlind));
  const host = snapshot.seats
    .map((seat) => seat.player)
    .find((player) => player?.isHost);
  const currentActor = snapshot.seats
    .map((seat) => seat.player)
    .find((player) => player?.id === snapshot.hand.currentActorId);
  const minimumRaiseTo = snapshot.hand.currentBet + snapshot.defaults.blinds.bigBlind;
  const canRaise = snapshot.hand.legalActions.includes("raise");

  useEffect(() => {
    setRaiseTo(String(minimumRaiseTo));
  }, [minimumRaiseTo, snapshot.hand.currentActorId]);

  return (
    <div className="table-layout">
      <section className="table-summary" aria-labelledby="table-summary-heading">
        <div>
          <p className="eyebrow">{snapshot.viewerRole}</p>
          <h2 id="table-summary-heading">Table {snapshot.tableId}</h2>
        </div>
        <div className="invite-box">
          <label htmlFor="invite-link">Invite link</label>
          <input id="invite-link" readOnly value={inviteLink} onFocus={(event) => event.target.select()} />
        </div>
        <dl className="table-metrics" aria-label="Table status">
          <div>
            <dt>Host</dt>
            <dd>{host?.displayName ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Seats</dt>
            <dd>{snapshot.seatedPlayerCount}/6</dd>
          </div>
          <div>
            <dt>Spectators</dt>
            <dd>{snapshot.spectatorCount}</dd>
          </div>
          <div>
            <dt>Blinds</dt>
            <dd>
              ${snapshot.defaults.blinds.smallBlind}/${snapshot.defaults.blinds.bigBlind}
            </dd>
          </div>
          <div>
            <dt>Phase</dt>
            <dd>{formatPhase(snapshot.hand.phase)}</dd>
          </div>
          <div>
            <dt>Pot</dt>
            <dd>${snapshot.hand.pot}</dd>
          </div>
          <div>
            <dt>To call</dt>
            <dd>${snapshot.hand.callAmount}</dd>
          </div>
          <div>
            <dt>Action</dt>
            <dd>{currentActor?.displayName ?? "Waiting"}</dd>
          </div>
        </dl>
      </section>

      <section className="felt-panel" aria-labelledby="felt-heading">
        <div className="felt-panel__header">
          <div>
            <p className="eyebrow">Hand {snapshot.hand.handNumber || "-"}</p>
            <h2 id="felt-heading">{formatPhase(snapshot.hand.phase)}</h2>
          </div>
          <span className="pot-chip">${snapshot.hand.currentBet} current bet</span>
        </div>

        <div className="board-row" aria-label="Community cards">
          {snapshot.hand.board.length > 0 ? (
            snapshot.hand.board.map((card) => <CardView card={card} key={`${card.rank}-${card.suit}`} />)
          ) : (
            <span className="empty-board">Board waiting for the flop</span>
          )}
        </div>

        <div className="hole-card-tray" aria-label="Your hole cards">
          <span>Your cards</span>
          <div>
            {snapshot.hand.viewerHoleCards.length > 0 ? (
              snapshot.hand.viewerHoleCards.map((card) => <CardView card={card} key={`${card.rank}-${card.suit}`} />)
            ) : (
              <span className="card-back">Hidden</span>
            )}
          </div>
        </div>

        <ActionBar
          canRaise={canRaise}
          legalActions={snapshot.hand.legalActions}
          minimumRaiseTo={minimumRaiseTo}
          raiseTo={raiseTo}
          onAction={onPlayerAction}
          onRaiseToChange={setRaiseTo}
        />
      </section>

      <section className="seat-grid" aria-label="Seated players">
        {snapshot.seats.map((seat) => (
          <article className={`seat ${seat.player?.isCurrentActor ? "seat--acting" : ""}`} key={seat.seatNumber}>
            <span className="seat__number">Seat {seat.seatNumber + 1}</span>
            {seat.player ? (
              <>
                <div className="seat__title">
                  <strong>{seat.player.displayName}</strong>
                  <span>${seat.player.stack}</span>
                </div>
                <div className="seat__badges" aria-label={`${seat.player.displayName} seat status`}>
                  {seat.player.isButton ? <span>Button</span> : null}
                  {seat.player.isSmallBlind ? <span>Small blind</span> : null}
                  {seat.player.isBigBlind ? <span>Big blind</span> : null}
                  {seat.player.hasCards ? <span>Cards dealt</span> : null}
                  {seat.player.hasFolded ? <span>Folded</span> : null}
                  {seat.player.isHost ? <span>Host</span> : null}
                </div>
                {seat.player.visibleHoleCards.length > 0 ? (
                  <div className="revealed-cards" aria-label={`${seat.player.displayName} revealed cards`}>
                    {seat.player.visibleHoleCards.map((card) => (
                      <CardView card={card} key={`${seat.player?.id}-${card.rank}-${card.suit}`} />
                    ))}
                  </div>
                ) : null}
                <span>
                  {seat.player.isConnected ? "Connected" : "Away"} / Bet ${seat.player.currentBet}
                </span>
              </>
            ) : (
              <>
                <strong>Open</strong>
                <span>Available before the first hand</span>
              </>
            )}
          </article>
        ))}
      </section>

      <aside className="rail-panel" aria-labelledby="rail-heading">
        <h2 id="rail-heading">Rail</h2>
        {snapshot.spectators.length > 0 ? (
          <ul>
            {snapshot.spectators.map((spectator) => (
              <li key={spectator.id}>
                {spectator.displayName}
                <span>{spectator.isConnected ? "watching" : "away"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No spectators yet.</p>
        )}
        <div className="control-strip" aria-label="Available controls">
          <button disabled={!snapshot.availableControls.canStartHand} onClick={onStartHand} type="button">
            Start hand
          </button>
          <button disabled={!snapshot.availableControls.canSeatSpectators}>Seat spectator</button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="action-log" aria-label="Public action log">
          <h3>Action log</h3>
          {snapshot.hand.actionLog.length > 0 ? (
            <ol>
              {snapshot.hand.actionLog.map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ol>
          ) : (
            <p>No hand actions yet.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function ActionBar({
  canRaise,
  legalActions,
  minimumRaiseTo,
  raiseTo,
  onAction,
  onRaiseToChange
}: {
  canRaise: boolean;
  legalActions: LegalAction[];
  minimumRaiseTo: number;
  raiseTo: string;
  onAction: (action: PlayerActionPayload["action"], raiseTo?: number) => void;
  onRaiseToChange: (raiseTo: string) => void;
}) {
  const actionOrder: PlayerActionPayload["action"][] = ["fold", "check", "call", "all-in"];

  return (
    <div className="action-bar" aria-label="Player actions">
      {legalActions.length > 0 ? (
        <>
          <div className="action-bar__buttons">
            {actionOrder.map((action) => (
              <button
                disabled={!legalActions.includes(action)}
                key={action}
                onClick={() => onAction(action)}
                type="button"
              >
                {formatAction(action)}
              </button>
            ))}
          </div>
          <div className="raise-control">
            <label htmlFor="raise-to">Raise to</label>
            <input
              disabled={!canRaise}
              id="raise-to"
              min={minimumRaiseTo}
              step={1}
              type="number"
              value={raiseTo}
              onChange={(event) => onRaiseToChange(event.target.value)}
            />
            <button disabled={!canRaise} onClick={() => onAction("raise", Number(raiseTo))} type="button">
              Raise
            </button>
          </div>
        </>
      ) : (
        <span>No action available</span>
      )}
    </div>
  );
}

function CardView({ card }: { card: Card }) {
  const suit = suitSymbol(card.suit);
  const pips = pipPositions(card.rank);
  const label = `${card.rank} of ${card.suit}`;

  return (
    <span aria-label={label} className={`playing-card playing-card--${card.suit}`} role="img">
      <span className="playing-card__corner playing-card__corner--top">
        <strong>{card.rank}</strong>
        <span>{suit}</span>
      </span>
      {pips.length > 0 ? (
        <span className={`playing-card__pips playing-card__pips--${pips.length}`} aria-hidden="true">
          {pips.map((position, index) => (
            <span className={`playing-card__pip playing-card__pip--${position}`} key={`${position}-${index}`}>
              {suit}
            </span>
          ))}
        </span>
      ) : (
        <span className="playing-card__face" aria-hidden="true">
          <span>{card.rank}</span>
          <small>{suit}</small>
        </span>
      )}
      <span className="playing-card__corner playing-card__corner--bottom" aria-hidden="true">
        <strong>{card.rank}</strong>
        <span>{suit}</span>
      </span>
    </span>
  );
}

function formatPhase(phase: string): string {
  return phase === "preflop" ? "Preflop" : phase[0]?.toUpperCase() + phase.slice(1);
}

function formatAction(action: string): string {
  return action === "all-in" ? "All-in" : action[0]?.toUpperCase() + action.slice(1);
}

function suitSymbol(suit: Card["suit"]): string {
  const symbols: Record<Card["suit"], string> = {
    clubs: "♣",
    diamonds: "♦",
    hearts: "♥",
    spades: "♠"
  };

  return symbols[suit];
}

function pipPositions(rank: Card["rank"]): string[] {
  const positionsByRank: Record<Card["rank"], string[]> = {
    A: ["center"],
    "2": ["top-center", "bottom-center"],
    "3": ["top-center", "center", "bottom-center"],
    "4": ["top-left", "top-right", "bottom-left", "bottom-right"],
    "5": ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
    "6": ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"],
    "7": ["top-left", "top-right", "middle-left", "middle-right", "center", "bottom-left", "bottom-right"],
    "8": [
      "top-left",
      "top-right",
      "upper-left",
      "upper-right",
      "lower-left",
      "lower-right",
      "bottom-left",
      "bottom-right"
    ],
    "9": [
      "top-left",
      "top-right",
      "upper-left",
      "upper-right",
      "center",
      "lower-left",
      "lower-right",
      "bottom-left",
      "bottom-right"
    ],
    "10": [
      "top-left",
      "top-right",
      "upper-left",
      "upper-right",
      "middle-left",
      "middle-right",
      "lower-left",
      "lower-right",
      "bottom-left",
      "bottom-right"
    ],
    J: [],
    Q: [],
    K: []
  };

  return positionsByRank[rank];
}

function emitCommand<TPayload>(
  socket: Socket,
  eventName: string,
  payload: TPayload
): Promise<TableCommandResponse> {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(eventName, payload, (error: Error | null, response: TableCommandResponse) => {
      if (error) {
        reject(new Error("Server did not answer. Try again."));
        return;
      }

      if (!response.ok) {
        reject(new Error(response.reason));
        return;
      }

      resolve(response);
    });
  });
}

function getTableIdFromPath(): string | null {
  const match = /^\/table\/([^/]+)$/.exec(window.location.pathname);
  return match?.[1] ?? null;
}

function sessionStorageKey(tableId: string): string {
  return `friendly-holdem:session:${tableId}`;
}

function readSessionToken(tableId: string): string | undefined {
  return window.localStorage.getItem(sessionStorageKey(tableId)) ?? undefined;
}

function storeSessionToken(tableId: string, sessionToken: string): void {
  window.localStorage.setItem(sessionStorageKey(tableId), sessionToken);
}

function rememberLastTable(tableId: string): void {
  window.localStorage.setItem("friendly-holdem:last-table", tableId);
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
