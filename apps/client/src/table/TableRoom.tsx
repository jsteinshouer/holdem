import { useEffect, useMemo, useRef, useState } from "react";
import type { DealNextHandPayload, PlayerActionPayload, TableSnapshot } from "@friendly-holdem/shared";
import { isRaiseAmountInRange, raiseBounds } from "../tableView";
import { describeViewerHand } from "../lib/handName";
import { formatPhase, money } from "../lib/format";
import { PlayingCard } from "./PlayingCard";
import { Seat } from "./Seat";
import { ActionBar } from "./ActionBar";
import { RaiseSheet } from "./RaiseSheet";
import { Rail, type RailTab } from "./Rail";
import { TutorialDialog } from "./TutorialDialog";
import { seatAngles } from "./seatRing";

export function TableRoom({
  error,
  inviteLink,
  snapshot,
  onPlayerAction,
  onSendChatMessage,
  onStartHand,
  onTableCommand
}: {
  error: string | null;
  inviteLink: string;
  snapshot: TableSnapshot;
  onPlayerAction: (action: PlayerActionPayload["action"], raiseTo?: number) => void;
  onSendChatMessage: (body: string) => void;
  onStartHand: () => void;
  onTableCommand: <TPayload>(eventName: string, payload: TPayload, fallbackMessage: string) => void;
}) {
  const [raiseTo, setRaiseTo] = useState(() => String(snapshot.hand.currentBet + snapshot.defaults.blinds.bigBlind));
  const [isRaiseSheetOpen, setIsRaiseSheetOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now);
  const [activeTab, setActiveTab] = useState<RailTab>("log");
  const [chatDraft, setChatDraft] = useState("");
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [openTutorial, setOpenTutorial] = useState<"beginner" | "host" | null>(null);
  const previousChatCountRef = useRef(snapshot.chatMessages.length);
  const wasViewerTurnRef = useRef(false);

  const players = snapshot.seats.map((seat) => seat.player);
  const host = players.find((player) => player?.isHost);
  const currentActor = players.find((player) => player?.id === snapshot.hand.currentActorId);
  const viewerPlayer = players.find((player) => player?.id === snapshot.viewerParticipantId);
  const viewerSeatIndex = snapshot.seats.findIndex((seat) => seat.player?.id === snapshot.viewerParticipantId);
  const angles = useMemo(
    () => seatAngles(snapshot.seats.length, viewerSeatIndex < 0 ? 0 : viewerSeatIndex),
    [snapshot.seats.length, viewerSeatIndex]
  );

  const { minimumRaiseTo, maximumRaiseTo } = raiseBounds({
    currentBet: snapshot.hand.currentBet,
    bigBlind: snapshot.defaults.blinds.bigBlind,
    viewer: viewerPlayer
  });
  const parsedRaiseTo = Number(raiseTo);
  const isRaiseToValid =
    snapshot.hand.legalActions.includes("raise") &&
    isRaiseAmountInRange(parsedRaiseTo, minimumRaiseTo, maximumRaiseTo);
  const isViewerTurn =
    snapshot.hand.currentActorId === snapshot.viewerParticipantId && snapshot.hand.legalActions.length > 0;

  const currentActorInactiveForMs =
    snapshot.hand.currentActorSince === null ? 0 : Math.max(0, nowMs - snapshot.hand.currentActorSince);
  const canHostAutoFoldInactive =
    snapshot.isHost &&
    Boolean(currentActor) &&
    Boolean(currentActor?.isConnected) &&
    !currentActor?.isAllIn &&
    currentActorInactiveForMs >= snapshot.defaults.hostAutoFoldAfterMs;

  const handName = useMemo(
    () => describeViewerHand(snapshot.hand.viewerHoleCards, snapshot.hand.board),
    [snapshot.hand.viewerHoleCards, snapshot.hand.board]
  );

  const waitingLabel = useMemo(() => {
    if (snapshot.viewerRole === "spectator") {
      return "You are watching this table.";
    }

    if (snapshot.hand.phase === "waiting") {
      return snapshot.availableControls.canStartHand
        ? "Everyone is seated. Start the hand when you are ready."
        : "Waiting for the host to start the hand.";
    }

    if (snapshot.hand.phase === "settled") {
      return snapshot.hand.settlementSummary ?? "Hand complete.";
    }

    return currentActor ? `Waiting for ${currentActor.displayName} to act.` : "Waiting for the next action.";
  }, [snapshot, currentActor]);

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

    if (snapshot.chatMessages.length > previousCount && activeTab !== "chat") {
      setUnreadChatCount((count) => count + snapshot.chatMessages.length - previousCount);
    }

    previousChatCountRef.current = snapshot.chatMessages.length;
  }, [snapshot.chatMessages.length, activeTab]);

  useEffect(() => {
    if (activeTab === "chat") {
      setUnreadChatCount(0);
    }
  }, [activeTab]);

  // The turn arriving is the one moment the surface must reach a player who is
  // not looking at it.
  useEffect(() => {
    const originalTitle = "Friendly Hold'em";

    if (isViewerTurn && !wasViewerTurnRef.current) {
      document.title = "(Your turn) Friendly Hold'em";
      window.navigator.vibrate?.(30);
    } else if (!isViewerTurn) {
      document.title = originalTitle;
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
    setActiveTab("chat");
  }

  function submitRaise() {
    if (!isRaiseAmountInRange(parsedRaiseTo, minimumRaiseTo, maximumRaiseTo)) {
      return;
    }

    onPlayerAction("raise", parsedRaiseTo);
    setIsRaiseSheetOpen(false);
  }

  return (
    <div className={`table-room ${isViewerTurn ? "table-room--your-turn" : ""}`}>
      <header className="table-room__head">
        <h2 id="table-summary-heading">Table {snapshot.tableId}</h2>
        <dl className="metrics" aria-label="Table status">
          <div>
            <dt>Blinds</dt>
            <dd>
              {money(snapshot.defaults.blinds.smallBlind)} / {money(snapshot.defaults.blinds.bigBlind)}
            </dd>
          </div>
          <div>
            <dt>Seats</dt>
            <dd>{snapshot.seatedPlayerCount}/6</dd>
          </div>
          <div>
            <dt>Host</dt>
            <dd>{host?.displayName ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Watching</dt>
            <dd>{snapshot.spectatorCount}</dd>
          </div>
        </dl>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="table-room__main">
        <div className="felt-wrap">
          <div className="felt" aria-label="Seated players">
            <div className="felt__center">
              <h3 className="felt__phase">{formatPhase(snapshot.hand.phase)}</h3>
              <p className="felt__hand-no">Hand {snapshot.hand.handNumber || "—"}</p>

              <div className="board" aria-label="Community cards">
                {snapshot.hand.board.length > 0 ? (
                  snapshot.hand.board.map((card, index) => (
                    <PlayingCard card={card} dealIndex={index} key={`${card.rank}-${card.suit}`} size="md" />
                  ))
                ) : (
                  <p className="board__empty">The board is dealt after the first betting round.</p>
                )}
              </div>

              <div className="pot">
                <span className="pot__label">Pot</span>
                <strong className="pot__amount">{money(snapshot.hand.pot)}</strong>
                {snapshot.hand.currentBet > 0 ? (
                  <span className="pot__bet">{money(snapshot.hand.currentBet)} to match</span>
                ) : null}
              </div>
            </div>

            {snapshot.seats.map((seat, index) => (
              <Seat
                angle={angles[index] ?? 90}
                handName={handName}
                isViewer={seat.player?.id === snapshot.viewerParticipantId}
                key={seat.seatNumber}
                seat={seat}
                viewerHoleCards={snapshot.hand.viewerHoleCards}
              />
            ))}
          </div>
        </div>

        <div className="station">
          <ActionBar
            callAmount={snapshot.hand.callAmount}
            currentBet={snapshot.hand.currentBet}
            isViewerTurn={isViewerTurn}
            legalActions={snapshot.hand.legalActions}
            maximumRaiseTo={maximumRaiseTo}
            minimumRaiseTo={minimumRaiseTo}
            onAction={onPlayerAction}
            onOpenRaiseSheet={() => setIsRaiseSheetOpen(true)}
            stack={viewerPlayer?.stack ?? 0}
            waitingLabel={waitingLabel}
          />

          <div className="station__host">
            {snapshot.availableControls.canStartHand ? (
              <button className="action action--primary" onClick={onStartHand} type="button">
                <span className="action__label">Start hand</span>
              </button>
            ) : null}
            {snapshot.availableControls.canDealNextHand ? (
              <button
                className="action action--primary"
                onClick={() =>
                  onTableCommand<DealNextHandPayload>(
                    "hand:next",
                    { tableId: snapshot.tableId },
                    "Unable to deal next hand."
                  )
                }
                type="button"
              >
                <span className="action__label">Deal next hand</span>
              </button>
            ) : null}
          </div>
        </div>

        <Rail
          activeTab={activeTab}
          canHostAutoFoldInactive={canHostAutoFoldInactive}
          chatDraft={chatDraft}
          inviteLink={inviteLink}
          onChatDraftChange={setChatDraft}
          onOpenTutorial={setOpenTutorial}
          onSubmitChat={submitChat}
          onTabChange={setActiveTab}
          onTableCommand={onTableCommand}
          snapshot={snapshot}
          unreadChatCount={unreadChatCount}
        />
      </div>

      {openTutorial ? <TutorialDialog kind={openTutorial} onClose={() => setOpenTutorial(null)} /> : null}
      {isRaiseSheetOpen ? (
        <RaiseSheet
          callAmount={snapshot.hand.callAmount}
          currentBet={snapshot.hand.currentBet}
          isRaiseToValid={isRaiseToValid}
          maximumRaiseTo={maximumRaiseTo}
          minimumRaiseTo={minimumRaiseTo}
          onCancel={() => setIsRaiseSheetOpen(false)}
          onRaiseToChange={setRaiseTo}
          onSubmit={submitRaise}
          pot={snapshot.hand.pot}
          raiseTo={raiseTo}
          stack={viewerPlayer?.stack ?? 0}
        />
      ) : null}
    </div>
  );
}
