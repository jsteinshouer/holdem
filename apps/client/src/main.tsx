import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import type {
  CreateTablePayload,
  JoinTablePayload,
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
          <TableRoom snapshot={snapshot} inviteLink={inviteLink} />
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

function TableRoom({ snapshot, inviteLink }: { snapshot: TableSnapshot; inviteLink: string }) {
  const host = snapshot.seats
    .map((seat) => seat.player)
    .find((player) => player?.isHost);

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
        </dl>
      </section>

      <section className="seat-grid" aria-label="Seated players">
        {snapshot.seats.map((seat) => (
          <article className="seat" key={seat.seatNumber}>
            <span className="seat__number">Seat {seat.seatNumber + 1}</span>
            {seat.player ? (
              <>
                <strong>{seat.player.displayName}</strong>
                <span>{seat.player.isHost ? "Host" : seat.player.isConnected ? "Connected" : "Away"}</span>
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
          <button disabled={!snapshot.availableControls.canStartHand}>Start hand</button>
          <button disabled={!snapshot.availableControls.canSeatSpectators}>Seat spectator</button>
        </div>
      </aside>
    </div>
  );
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
