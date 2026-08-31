import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import type {
  CreateTablePayload,
  JoinTablePayload,
  PlayerActionPayload,
  SendChatMessagePayload,
  StartHandPayload,
  TableCommandResponse,
  TableSnapshot
} from "@friendly-holdem/shared";
import { registerServiceWorker } from "./pwa";
import { connectionStatusLabel, isCommandInputDisabled, type ConnectionState } from "./tableView";
import { TableRoom } from "./table/TableRoom";
import { MoonIcon, SunIcon } from "./icons";
import "./styles.css";

const serverUrl = import.meta.env.VITE_SERVER_URL ?? window.location.origin;

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "friendly-holdem:theme";
// The room around the table is what flips; the felt and the cards barely move.
const THEME_COLORS: Record<Theme, string> = { dark: "#0F1412", light: "#F2EEE6" };

function readStoredTheme(): Theme {
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

function App() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [snapshot, setSnapshot] = useState<TableSnapshot | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tableIdFromUrl = getTableIdFromPath();

  useEffect(() => {
    const nextSocket = io(serverUrl, { autoConnect: true, transports: ["websocket", "polling"] });

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
      const response = await emitCommand<StartHandPayload>(socket, "hand:start", { tableId: snapshot.tableId });
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

  async function tableCommand<TPayload>(eventName: string, payload: TPayload, fallbackMessage: string) {
    if (!socket) {
      return;
    }

    setError(null);

    try {
      const response = await emitCommand<TPayload>(socket, eventName, payload);
      handleSessionResponse(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : fallbackMessage);
    }
  }

  async function sendChatMessage(body: string) {
    if (!socket || !snapshot) {
      return;
    }

    setError(null);

    try {
      const response = await emitCommand<SendChatMessagePayload>(socket, "chat:send", {
        tableId: snapshot.tableId,
        body
      });
      handleSessionResponse(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send chat message.");
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
    <main className="shell">
      <div className="shell__inner">
        <header className="masthead">
          <h1>Friendly Hold'em</h1>
          <div className="masthead__actions">
            <span className={`status status--${connectionState}`}>
              <span aria-hidden="true" className="status__dot" />
              {connectionStatusLabel(connectionState)}
            </span>
            <button
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              className="icon-button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              type="button"
            >
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </header>

        {snapshot ? (
          <TableRoom
            error={error}
            inviteLink={inviteLink}
            onPlayerAction={playerAction}
            onSendChatMessage={sendChatMessage}
            onStartHand={startHand}
            onTableCommand={tableCommand}
            snapshot={snapshot}
          />
        ) : (
          <EntryPanel
            displayName={displayName}
            error={error}
            isDisabled={isCommandInputDisabled(Boolean(socket), connectionState)}
            onDisplayNameChange={setDisplayName}
            onSubmit={tableIdFromUrl ? joinTable : createTable}
            tableId={tableIdFromUrl}
          />
        )}
      </div>
    </main>
  );
}

// One entry panel for both arrivals. Creating and joining differ by a single
// fact — whether the URL already names a table — so they are one component with
// one label, not two near-identical forms.
function EntryPanel({
  displayName,
  error,
  isDisabled,
  tableId,
  onDisplayNameChange,
  onSubmit
}: {
  displayName: string;
  error: string | null;
  isDisabled: boolean;
  tableId: string | null;
  onDisplayNameChange: (displayName: string) => void;
  onSubmit: () => void;
}) {
  const isJoining = Boolean(tableId);

  return (
    <section className="entry">
      <div className="entry__card">
        <h2>{isJoining ? "Join the table" : "Deal your friends in"}</h2>
        <p className="entry__lead">
          {isJoining
            ? "Pick a name your friends will recognise. No account, no password."
            : "Start a private table, send one link, and play. Play money only — nothing here is real."}
        </p>

        <form
          className="entry__form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="field" htmlFor="display-name">
            <span>Your display name</span>
            <input
              autoComplete="nickname"
              id="display-name"
              maxLength={32}
              placeholder="e.g. Grace"
              required
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
            />
          </label>
          <button className="action action--primary action--wide" disabled={isDisabled} type="submit">
            <span className="action__label">{isJoining ? "Join table" : "Create table"}</span>
          </button>
        </form>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {isJoining ? <p className="entry__note">Invite {tableId}</p> : null}
      </div>
    </section>
  );
}

function emitCommand<TPayload>(socket: Socket, eventName: string, payload: TPayload): Promise<TableCommandResponse> {
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

registerServiceWorker().catch(() => {
  // Installability should never block realtime play.
});
