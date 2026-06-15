import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import type {
  ApproveRebuyPayload,
  Card,
  CreateTablePayload,
  DealNextHandPayload,
  HostAutoFoldInactivePayload,
  JoinTablePayload,
  LegalAction,
  PlayerActionPayload,
  RejoinPayload,
  RemovePlayerPayload,
  SeatSpectatorPayload,
  SendChatMessagePayload,
  SitOutPayload,
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
            onSendChatMessage={sendChatMessage}
            onTableCommand={tableCommand}
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
  onSendChatMessage,
  onTableCommand,
  onStartHand
}: {
  error: string | null;
  snapshot: TableSnapshot;
  inviteLink: string;
  onPlayerAction: (action: PlayerActionPayload["action"], raiseTo?: number) => void;
  onSendChatMessage: (body: string) => void;
  onTableCommand: <TPayload>(eventName: string, payload: TPayload, fallbackMessage: string) => void;
  onStartHand: () => void;
}) {
  const [raiseTo, setRaiseTo] = useState(() => String(snapshot.hand.currentBet + snapshot.defaults.blinds.bigBlind));
  const [nowMs, setNowMs] = useState(Date.now);
  const [activeMobilePanel, setActiveMobilePanel] = useState<"log" | "chat" | "help">("log");
  const [chatDraft, setChatDraft] = useState("");
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [openTutorial, setOpenTutorial] = useState<"beginner" | "host" | null>(null);
  const previousChatCountRef = useRef(snapshot.chatMessages.length);
  const wasViewerTurnRef = useRef(false);
  const host = snapshot.seats
    .map((seat) => seat.player)
    .find((player) => player?.isHost);
  const currentActor = snapshot.seats
    .map((seat) => seat.player)
    .find((player) => player?.id === snapshot.hand.currentActorId);
  const minimumRaiseTo = snapshot.hand.currentBet + snapshot.defaults.blinds.bigBlind;
  const canRaise = snapshot.hand.legalActions.includes("raise");
  const currentActorInactiveForMs =
    snapshot.hand.currentActorSince === null ? 0 : Math.max(0, nowMs - snapshot.hand.currentActorSince);
  const canHostAutoFoldInactive =
    snapshot.isHost &&
    Boolean(currentActor) &&
    Boolean(currentActor?.isConnected) &&
    !currentActor?.isAllIn &&
    currentActorInactiveForMs >= snapshot.defaults.hostAutoFoldAfterMs;
  const isViewerTurn =
    snapshot.hand.currentActorId === snapshot.viewerParticipantId && snapshot.hand.legalActions.length > 0;

  useEffect(() => {
    setRaiseTo(String(minimumRaiseTo));
  }, [minimumRaiseTo, snapshot.hand.currentActorId]);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);

    return () => window.clearInterval(timer);
  }, [snapshot.hand.currentActorSince]);

  useEffect(() => {
    const previousCount = previousChatCountRef.current;

    if (snapshot.chatMessages.length > previousCount && activeMobilePanel !== "chat") {
      setUnreadChatCount((count) => count + snapshot.chatMessages.length - previousCount);
    }

    previousChatCountRef.current = snapshot.chatMessages.length;
  }, [activeMobilePanel, snapshot.chatMessages.length]);

  useEffect(() => {
    if (activeMobilePanel === "chat") {
      setUnreadChatCount(0);
    }
  }, [activeMobilePanel]);

  useEffect(() => {
    const originalTitle = "Friendly Hold'em";
    document.title = isViewerTurn ? "Your turn - Friendly Hold'em" : originalTitle;

    if (isViewerTurn && !wasViewerTurnRef.current && "vibrate" in navigator) {
      navigator.vibrate?.(80);
    }

    wasViewerTurnRef.current = isViewerTurn;

    return () => {
      document.title = originalTitle;
    };
  }, [isViewerTurn]);

  function submitChat() {
    const body = chatDraft.trim();

    if (!body) {
      return;
    }

    onSendChatMessage(body);
    setChatDraft("");
    setActiveMobilePanel("chat");
  }

  return (
    <div className={`table-layout ${isViewerTurn ? "table-layout--your-turn" : ""}`}>
      <section className="table-summary" aria-labelledby="table-summary-heading">
        <div>
          <p className="eyebrow">{snapshot.viewerRole}</p>
          <h2 id="table-summary-heading">Table {snapshot.tableId}</h2>
        </div>
        <div className="invite-box">
          <label htmlFor="invite-link">Invite link</label>
          <input id="invite-link" readOnly value={inviteLink} onFocus={(event) => event.target.select()} />
        </div>
        <div className="tutorial-actions" aria-label="Tutorials">
          <button onClick={() => setOpenTutorial("beginner")} type="button">
            Beginner tutorial
          </button>
          <button onClick={() => setOpenTutorial("host")} type="button">
            Host tutorial
          </button>
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

      <nav className="mobile-tabs" aria-label="Table panels">
        <button
          aria-pressed={activeMobilePanel === "log"}
          onClick={() => setActiveMobilePanel("log")}
          type="button"
        >
          Log
        </button>
        <button
          aria-pressed={activeMobilePanel === "chat"}
          onClick={() => setActiveMobilePanel("chat")}
          type="button"
        >
          Chat{unreadChatCount > 0 ? ` (${unreadChatCount})` : ""}
        </button>
        <button
          aria-pressed={activeMobilePanel === "help"}
          onClick={() => setActiveMobilePanel("help")}
          type="button"
        >
          Help
        </button>
      </nav>

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
                  {seat.player.isAllIn ? <span>All-in</span> : null}
                  {seat.player.isSittingOut ? <span>Sitting out</span> : null}
                  {seat.player.isBusted ? <span>Busted</span> : null}
                  {!seat.player.isConnected ? <span>Away</span> : null}
                  {seat.player.inactiveForMs !== null ? (
                    <span>Inactive {formatDuration(seat.player.inactiveForMs)}</span>
                  ) : null}
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
        <div className="rail-panel__section rail-panel__section--help" data-active={activeMobilePanel === "help"}>
          <RailControls
            canHostAutoFoldInactive={canHostAutoFoldInactive}
            snapshot={snapshot}
            onStartHand={onStartHand}
            onTableCommand={onTableCommand}
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="rail-panel__section rail-panel__section--log" data-active={activeMobilePanel === "log"}>
          <ActionLog entries={snapshot.hand.actionLog} />
        </div>
        <div className="rail-panel__section rail-panel__section--chat" data-active={activeMobilePanel === "chat"}>
          <ChatPanel
            chatDraft={chatDraft}
            messages={snapshot.chatMessages}
            onChatDraftChange={setChatDraft}
            onSubmitChat={submitChat}
          />
        </div>
      </aside>
      {openTutorial ? <TutorialDialog kind={openTutorial} onClose={() => setOpenTutorial(null)} /> : null}
    </div>
  );
}

function RailControls({
  canHostAutoFoldInactive,
  snapshot,
  onStartHand,
  onTableCommand
}: {
  canHostAutoFoldInactive: boolean;
  snapshot: TableSnapshot;
  onStartHand: () => void;
  onTableCommand: <TPayload>(eventName: string, payload: TPayload, fallbackMessage: string) => void;
}) {
  return (
    <>
      <div className="spectator-list">
        <h3>Spectators</h3>
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
      </div>
      <div className="control-strip" aria-label="Available controls">
        <button disabled={!snapshot.availableControls.canStartHand} onClick={onStartHand} type="button">
          Start hand
        </button>
        <button
          disabled={!canHostAutoFoldInactive}
          onClick={() =>
            onTableCommand<HostAutoFoldInactivePayload>(
              "host:autoFoldInactive",
              { tableId: snapshot.tableId },
              "Unable to auto-fold inactive player."
            )
          }
          type="button"
        >
          Auto-fold inactive
        </button>
        <button
          disabled={!snapshot.availableControls.canDealNextHand}
          onClick={() =>
            onTableCommand<DealNextHandPayload>(
              "hand:next",
              { tableId: snapshot.tableId },
              "Unable to deal next hand."
            )
          }
          type="button"
        >
          Deal next hand
        </button>
        <button
          disabled={!snapshot.availableControls.canSitOut}
          onClick={() =>
            onTableCommand<SitOutPayload>("player:sitOut", { tableId: snapshot.tableId }, "Unable to sit out.")
          }
          type="button"
        >
          Sit out
        </button>
        <button
          disabled={!snapshot.availableControls.canRejoin}
          onClick={() =>
            onTableCommand<RejoinPayload>("player:rejoin", { tableId: snapshot.tableId }, "Unable to rejoin.")
          }
          type="button"
        >
          Rejoin
        </button>
      </div>
      {snapshot.isHost ? (
        <div className="host-controls" aria-label="Host table controls">
          {snapshot.spectators.length > 0 ? (
            <div>
              <h3>Seat spectators</h3>
              {snapshot.spectators.map((spectator) => (
                <button
                  disabled={!snapshot.availableControls.canSeatSpectators}
                  key={spectator.id}
                  onClick={() =>
                    onTableCommand<SeatSpectatorPayload>(
                      "host:seatSpectator",
                      { tableId: snapshot.tableId, participantId: spectator.id },
                      "Unable to seat spectator."
                    )
                  }
                  type="button"
                >
                  Seat {spectator.displayName}
                </button>
              ))}
            </div>
          ) : null}
          <div>
            <h3>Players</h3>
            {snapshot.seats
              .map((seat) => seat.player)
              .filter(isSeatPlayer)
              .filter((player) => !player.isHost)
              .map((player) => (
                <div className="host-controls__row" key={player.id}>
                  <span>{player.displayName}</span>
                  <button
                    disabled={snapshot.hand.phase !== "settled" && snapshot.hand.phase !== "waiting"}
                    onClick={() =>
                      onTableCommand<ApproveRebuyPayload>(
                        "host:approveRebuy",
                        { tableId: snapshot.tableId, participantId: player.id },
                        "Unable to approve rebuy."
                      )
                    }
                    type="button"
                  >
                    Rebuy
                  </button>
                  <button
                    disabled={
                      player.isConnected || (snapshot.hand.phase !== "settled" && snapshot.hand.phase !== "waiting")
                    }
                    onClick={() =>
                      onTableCommand<RemovePlayerPayload>(
                        "host:removePlayer",
                        { tableId: snapshot.tableId, participantId: player.id },
                        "Unable to remove player."
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ActionLog({ entries }: { entries: string[] }) {
  return (
    <div className="action-log" aria-label="Public action log">
      <h3>Action log</h3>
      {entries.length > 0 ? (
        <ol>
          {entries.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ol>
      ) : (
        <p>No hand actions yet.</p>
      )}
    </div>
  );
}

function ChatPanel({
  chatDraft,
  messages,
  onChatDraftChange,
  onSubmitChat
}: {
  chatDraft: string;
  messages: TableSnapshot["chatMessages"];
  onChatDraftChange: (body: string) => void;
  onSubmitChat: () => void;
}) {
  return (
    <section className="chat-panel" aria-label="Table chat">
      <h3>Chat</h3>
      <ol className="chat-messages">
        {messages.length > 0 ? (
          messages.map((message) => (
            <li key={message.id}>
              <strong>{message.displayName}</strong>
              <span>{formatTime(message.sentAt)}</span>
              <p>{message.body}</p>
            </li>
          ))
        ) : (
          <li className="chat-messages__empty">No messages yet.</li>
        )}
      </ol>
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitChat();
        }}
      >
        <label htmlFor="chat-message">Message</label>
        <textarea
          id="chat-message"
          maxLength={180}
          value={chatDraft}
          onChange={(event) => onChatDraftChange(event.target.value)}
        />
        <button disabled={!chatDraft.trim()} type="submit">
          Send
        </button>
      </form>
    </section>
  );
}

function TutorialDialog({ kind, onClose }: { kind: "beginner" | "host"; onClose: () => void }) {
  const isBeginner = kind === "beginner";
  const title = isBeginner ? "Beginner tutorial" : "Host tutorial";
  const steps = isBeginner
    ? [
        "Each hand starts with blinds, then every active player receives two private hole cards.",
        "The board is dealt in streets: flop, turn, and river, with betting before and after each street.",
        "On your turn you may fold, check, call, raise, or move all-in when that action is legal.",
        "All-in players stay eligible for pots they helped build; side pots separate chips they cannot win.",
        "At showdown, eligible hands reveal and the best five-card hand wins: high card through straight flush."
      ]
    : [
        "Create a table, copy the invite link, and share it with friends privately.",
        "Before the first hand, joiners auto-seat until six seats are filled; later joiners watch as spectators.",
        "Use Start hand for hand one, then Deal next hand after settlement.",
        "Between hands you can seat spectators, approve rebuys, and remove away seated players.",
        "If a connected player stalls on their turn, the host auto-fold control appears after the inactivity window."
      ];

  return (
    <div className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="tutorial-dialog__panel">
        <div className="tutorial-dialog__header">
          <h2 id="tutorial-title">{title}</h2>
          <button onClick={onClose} type="button">
            Close
          </button>
        </div>
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
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

function isSeatPlayer(
  player: TableSnapshot["seats"][number]["player"]
): player is NonNullable<TableSnapshot["seats"][number]["player"]> {
  return Boolean(player);
}

function formatPhase(phase: string): string {
  return phase === "preflop" ? "Preflop" : phase[0]?.toUpperCase() + phase.slice(1);
}

function formatAction(action: string): string {
  return action === "all-in" ? "All-in" : action[0]?.toUpperCase() + action.slice(1);
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
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
