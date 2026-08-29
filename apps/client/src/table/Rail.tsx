import type {
  AddBotPayload,
  ApproveRebuyPayload,
  HostAutoFoldInactivePayload,
  RejoinPayload,
  RemovePlayerPayload,
  SeatSpectatorPayload,
  SitOutPayload,
  TableSnapshot
} from "@friendly-holdem/shared";
import { formatTime, money } from "../lib/format";
import { CopyIcon, SendIcon } from "../icons";

export type RailTab = "log" | "chat" | "players" | "manage";

// One rail, four sections. On wide screens it is a column beside the table; on
// narrow it is a bottom sheet with the same components in a different container.
// Nothing here has a mobile twin.
export function Rail({
  activeTab,
  chatDraft,
  canHostAutoFoldInactive,
  inviteLink,
  snapshot,
  unreadChatCount,
  onChatDraftChange,
  onOpenTutorial,
  onSubmitChat,
  onTabChange,
  onTableCommand
}: {
  activeTab: RailTab;
  chatDraft: string;
  canHostAutoFoldInactive: boolean;
  inviteLink: string;
  snapshot: TableSnapshot;
  unreadChatCount: number;
  onChatDraftChange: (value: string) => void;
  onOpenTutorial: (kind: "beginner" | "host") => void;
  onSubmitChat: () => void;
  onTabChange: (tab: RailTab) => void;
  onTableCommand: <TPayload>(eventName: string, payload: TPayload, fallbackMessage: string) => void;
}) {
  const tabs: { id: RailTab; label: string; badge?: number }[] = [
    { id: "log", label: "Log" },
    { id: "chat", label: "Chat", badge: unreadChatCount },
    { id: "players", label: "Players" },
    { id: "manage", label: "Manage" }
  ];

  return (
    <aside className="rail" aria-label="Table panels">
      <div className="rail__tabs" role="tablist" aria-label="Table panels">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className="rail__tab"
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
            {tab.badge ? <span className="rail__badge">{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="rail__body">
        <section className="rail__section" data-active={activeTab === "log"} aria-label="Public action log">
          <ActionLog entries={snapshot.hand.actionLog} />
        </section>

        <section className="rail__section" data-active={activeTab === "chat"} aria-label="Table chat">
          <ChatPanel
            chatDraft={chatDraft}
            messages={snapshot.chatMessages}
            onChatDraftChange={onChatDraftChange}
            onSubmitChat={onSubmitChat}
          />
        </section>

        <section className="rail__section" data-active={activeTab === "players"} aria-label="Player roster">
          <PlayersPanel snapshot={snapshot} />
        </section>

        <section className="rail__section" data-active={activeTab === "manage"} aria-label="Manage table">
          <ManagePanel
            canHostAutoFoldInactive={canHostAutoFoldInactive}
            inviteLink={inviteLink}
            snapshot={snapshot}
            onOpenTutorial={onOpenTutorial}
                onTableCommand={onTableCommand}
          />
        </section>
      </div>
    </aside>
  );
}

function ActionLog({ entries }: { entries: string[] }) {
  return entries.length > 0 ? (
    <ol className="log">
      {[...entries].reverse().map((entry, index) => (
        <li key={`${entry}-${index}`}>{entry}</li>
      ))}
    </ol>
  ) : (
    <p className="empty">Nothing has happened yet. The log fills in as the hand plays.</p>
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
  onChatDraftChange: (value: string) => void;
  onSubmitChat: () => void;
}) {
  return (
    <div className="chat">
      <ol className="chat__messages">
        {messages.length > 0 ? (
          messages.map((message) => (
            <li key={message.id}>
              <span className="chat__meta">
                <strong>{message.displayName}</strong>
                <time>{formatTime(message.sentAt)}</time>
              </span>
              <p>{message.body}</p>
            </li>
          ))
        ) : (
          <li className="empty">No messages yet. Say hello.</li>
        )}
      </ol>
      <form
        className="chat__form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitChat();
        }}
      >
        <label className="visually-hidden" htmlFor="chat-message">
          Message
        </label>
        <textarea
          id="chat-message"
          maxLength={180}
          placeholder="Message the table"
          rows={1}
          value={chatDraft}
          onChange={(event) => onChatDraftChange(event.target.value)}
        />
        <button aria-label="Send" className="icon-button icon-button--filled" disabled={!chatDraft.trim()} type="submit">
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

function PlayersPanel({ snapshot }: { snapshot: TableSnapshot }) {
  const seated = snapshot.seats.filter((seat) => seat.player);

  return (
    <div className="roster">
      <ul className="roster__list">
        {seated.map((seat) => (
          <li key={seat.seatNumber}>
            <span className="roster__name">{seat.player?.displayName}</span>
            <span className="roster__seat">Seat {seat.seatNumber + 1}</span>
            <span className="roster__stack">{money(seat.player?.stack ?? 0)}</span>
          </li>
        ))}
      </ul>

      <h3 className="rail__heading">Spectators</h3>
      {snapshot.spectators.length > 0 ? (
        <ul className="roster__list">
          {snapshot.spectators.map((spectator) => (
            <li key={spectator.id}>
              <span className="roster__name">{spectator.displayName}</span>
              <span className="roster__seat">{spectator.isConnected ? "watching" : "away"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nobody is watching.</p>
      )}
    </div>
  );
}

function ManagePanel({
  canHostAutoFoldInactive,
  inviteLink,
  snapshot,
  onOpenTutorial,
  onTableCommand
}: {
  canHostAutoFoldInactive: boolean;
  inviteLink: string;
  snapshot: TableSnapshot;
  onOpenTutorial: (kind: "beginner" | "host") => void;
  onTableCommand: <TPayload>(eventName: string, payload: TPayload, fallbackMessage: string) => void;
}) {
  const others = snapshot.seats
    .map((seat) => seat.player)
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
    .filter((player) => !player.isHost);
  const betweenHands = snapshot.hand.phase === "settled" || snapshot.hand.phase === "waiting";

  return (
    <div className="manage">
      <div className="invite">
        <label htmlFor="invite-link">Invite link</label>
        <div className="invite__row">
          <input id="invite-link" readOnly value={inviteLink} onFocus={(event) => event.target.select()} />
          <button
            aria-label="Copy invite link"
            className="icon-button"
            onClick={() => navigator.clipboard?.writeText(inviteLink).catch(() => undefined)}
            type="button"
          >
            <CopyIcon />
          </button>
        </div>
      </div>

      <div className="button-row">
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
        {snapshot.isHost ? (
          <button
            disabled={!snapshot.availableControls.canAddBot}
            onClick={() =>
              onTableCommand<AddBotPayload>("host:addBot", { tableId: snapshot.tableId }, "Unable to add bot.")
            }
            type="button"
          >
            Add bot
          </button>
        ) : null}
      </div>

      {snapshot.isHost && snapshot.spectators.length > 0 ? (
        <>
          <h3 className="rail__heading">Seat a spectator</h3>
          <div className="button-row">
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
        </>
      ) : null}

      {snapshot.isHost && others.length > 0 ? (
        <>
          <h3 className="rail__heading">Players</h3>
          <ul className="host-list">
            {others.map((player) => (
              <li key={player.id}>
                <span>{player.displayName}</span>
                <button
                  disabled={!betweenHands}
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
                  disabled={player.isConnected || !betweenHands}
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
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3 className="rail__heading">Help</h3>
      <div className="button-row">
        <button onClick={() => onOpenTutorial("beginner")} type="button">
          Beginner tutorial
        </button>
        <button onClick={() => onOpenTutorial("host")} type="button">
          Host tutorial
        </button>
      </div>
    </div>
  );
}
