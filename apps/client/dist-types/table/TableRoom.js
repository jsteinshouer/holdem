import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { isRaiseAmountInRange, raiseBounds } from "../tableView";
import { describeViewerHand } from "../lib/handName";
import { formatPhase, money } from "../lib/format";
import { PlayingCard } from "./PlayingCard";
import { Seat } from "./Seat";
import { ActionBar } from "./ActionBar";
import { RaiseSheet } from "./RaiseSheet";
import { Rail, TAB_LABELS } from "./Rail";
import { TutorialDialog } from "./TutorialDialog";
import { seatAngles } from "./seatRing";
export function TableRoom({ error, inviteLink, snapshot, onPlayerAction, onSendChatMessage, onStartHand, onTableCommand }) {
    const [raiseTo, setRaiseTo] = useState(() => String(snapshot.hand.currentBet + snapshot.defaults.blinds.bigBlind));
    const [isRaiseSheetOpen, setIsRaiseSheetOpen] = useState(false);
    const [nowMs, setNowMs] = useState(Date.now);
    const [activeTab, setActiveTab] = useState("log");
    const [chatDraft, setChatDraft] = useState("");
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [openTutorial, setOpenTutorial] = useState(null);
    const [isRailOpen, setIsRailOpen] = useState(false);
    const stationRef = useRef(null);
    const tableRef = useRef(null);
    const previousChatCountRef = useRef(snapshot.chatMessages.length);
    const wasViewerTurnRef = useRef(false);
    const players = snapshot.seats.map((seat) => seat.player);
    const host = players.find((player) => player?.isHost);
    const currentActor = players.find((player) => player?.id === snapshot.hand.currentActorId);
    const viewerPlayer = players.find((player) => player?.id === snapshot.viewerParticipantId);
    const viewerSeatIndex = snapshot.seats.findIndex((seat) => seat.player?.id === snapshot.viewerParticipantId);
    const angles = useMemo(() => seatAngles(snapshot.seats.length, viewerSeatIndex < 0 ? 0 : viewerSeatIndex), [snapshot.seats.length, viewerSeatIndex]);
    const { minimumRaiseTo, maximumRaiseTo } = raiseBounds({
        currentBet: snapshot.hand.currentBet,
        bigBlind: snapshot.defaults.blinds.bigBlind,
        viewer: viewerPlayer
    });
    const parsedRaiseTo = Number(raiseTo);
    const isRaiseToValid = snapshot.hand.legalActions.includes("raise") &&
        isRaiseAmountInRange(parsedRaiseTo, minimumRaiseTo, maximumRaiseTo);
    const isViewerTurn = snapshot.hand.currentActorId === snapshot.viewerParticipantId && snapshot.hand.legalActions.length > 0;
    const currentActorInactiveForMs = snapshot.hand.currentActorSince === null ? 0 : Math.max(0, nowMs - snapshot.hand.currentActorSince);
    const canHostAutoFoldInactive = snapshot.isHost &&
        Boolean(currentActor) &&
        Boolean(currentActor?.isConnected) &&
        !currentActor?.isAllIn &&
        currentActorInactiveForMs >= snapshot.defaults.hostAutoFoldAfterMs;
    const latestAction = snapshot.hand.actionLog.at(-1) ?? "The hand has not started yet.";
    const handName = useMemo(() => describeViewerHand(snapshot.hand.viewerHoleCards, snapshot.hand.board), [snapshot.hand.viewerHoleCards, snapshot.hand.board]);
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
        const station = stationRef.current;
        const table = tableRef.current;
        if (!station || !table || typeof ResizeObserver === "undefined") {
            return;
        }
        // Three layers pin to the bottom on a phone — board and pot, your plate, your
        // actions — so the mobile priority list survives however tall the table gets.
        // Each needs the real height of the layer below it.
        const viewer = table.querySelector(".seat--viewer");
        const measure = () => {
            table.style.setProperty("--station-h", `${Math.round(station.offsetHeight)}px`);
            table.style.setProperty("--viewer-h", `${Math.round(viewer?.offsetHeight ?? 0)}px`);
        };
        const observer = new ResizeObserver(measure);
        observer.observe(station);
        if (viewer) {
            observer.observe(viewer);
        }
        measure();
        return () => observer.disconnect();
    }, [viewerSeatIndex]);
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
        }
        else if (!isViewerTurn) {
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
    function openRail(tab) {
        setActiveTab(tab);
        setIsRailOpen(true);
    }
    const drawerTabs = ["log", "chat", "manage"];
    return (_jsxs("div", { className: `table-room ${isViewerTurn ? "table-room--your-turn" : ""}`, ref: tableRef, children: [_jsxs("header", { className: "table-room__head", children: [_jsxs("h2", { id: "table-summary-heading", children: ["Table ", snapshot.tableId] }), _jsxs("dl", { className: "metrics", "aria-label": "Table status", children: [_jsxs("div", { children: [_jsx("dt", { children: "Blinds" }), _jsxs("dd", { children: [money(snapshot.defaults.blinds.smallBlind), " / ", money(snapshot.defaults.blinds.bigBlind)] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Seats" }), _jsxs("dd", { children: [snapshot.seatedPlayerCount, "/6"] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Host" }), _jsx("dd", { children: host?.displayName ?? "Unknown" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Watching" }), _jsx("dd", { children: snapshot.spectatorCount })] })] })] }), error ? (_jsx("p", { className: "form-error", role: "alert", children: error })) : null, _jsxs("div", { className: "table-room__main", children: [_jsx("div", { className: "felt-wrap", children: _jsxs("div", { className: "felt", "aria-label": "Seated players", children: [_jsxs("div", { className: "felt__center", children: [_jsx("h3", { className: "felt__phase", children: formatPhase(snapshot.hand.phase) }), _jsxs("p", { className: "felt__hand-no", children: ["Hand ", snapshot.hand.handNumber || "—"] }), _jsx("div", { className: "board", "aria-label": "Community cards", children: snapshot.hand.board.length > 0 ? (snapshot.hand.board.map((card, index) => (_jsx(PlayingCard, { card: card, dealIndex: index, size: "md" }, `${card.rank}-${card.suit}`)))) : (_jsx("p", { className: "board__empty", children: "The board is dealt after the first betting round." })) }), _jsxs("div", { className: "pot", children: [_jsx("span", { className: "pot__label", children: "Pot" }), _jsx("strong", { className: "pot__amount", children: money(snapshot.hand.pot) }), snapshot.hand.currentBet > 0 ? (_jsxs("span", { className: "pot__bet", children: [money(snapshot.hand.currentBet), " to match"] })) : null] })] }), snapshot.seats.map((seat, index) => (_jsx(Seat, { angle: angles[index] ?? 90, handName: handName, isViewer: seat.player?.id === snapshot.viewerParticipantId, seat: seat, viewerHoleCards: snapshot.hand.viewerHoleCards }, seat.seatNumber)))] }) }), _jsxs("div", { className: "station", ref: stationRef, children: [_jsx("div", { className: "station__panels", children: drawerTabs.map((tab) => (_jsxs("button", { "aria-controls": "table-rail", "aria-expanded": isRailOpen && activeTab === tab, className: "station__panel-trigger", onClick: () => (isRailOpen && activeTab === tab ? setIsRailOpen(false) : openRail(tab)), type: "button", children: [TAB_LABELS[tab], tab === "chat" && unreadChatCount > 0 ? (_jsx("span", { className: "rail__badge", children: unreadChatCount })) : null] }, tab))) }), _jsxs("p", { "aria-live": "polite", className: "station__latest", children: [_jsx("span", { children: "Latest" }), latestAction] }), _jsx(ActionBar, { callAmount: snapshot.hand.callAmount, currentBet: snapshot.hand.currentBet, isViewerTurn: isViewerTurn, legalActions: snapshot.hand.legalActions, maximumRaiseTo: maximumRaiseTo, minimumRaiseTo: minimumRaiseTo, onAction: onPlayerAction, onOpenRaiseSheet: () => setIsRaiseSheetOpen(true), stack: viewerPlayer?.stack ?? 0, waitingLabel: waitingLabel }), _jsxs("div", { className: "station__host", children: [snapshot.availableControls.canStartHand ? (_jsx("button", { className: "action action--primary", onClick: onStartHand, type: "button", children: _jsx("span", { className: "action__label", children: "Start hand" }) })) : null, snapshot.availableControls.canDealNextHand ? (_jsx("button", { className: "action action--primary", onClick: () => onTableCommand("hand:next", { tableId: snapshot.tableId }, "Unable to deal next hand."), type: "button", children: _jsx("span", { className: "action__label", children: "Deal next hand" }) })) : null] })] }), _jsx(Rail, { activeTab: activeTab, canHostAutoFoldInactive: canHostAutoFoldInactive, chatDraft: chatDraft, inviteLink: inviteLink, isOpen: isRailOpen, onChatDraftChange: setChatDraft, onClose: () => setIsRailOpen(false), onOpenTutorial: setOpenTutorial, onSubmitChat: submitChat, onTableCommand: onTableCommand, snapshot: snapshot }), isRailOpen ? (_jsx("button", { "aria-label": "Close panels", className: "rail__scrim", onClick: () => setIsRailOpen(false), type: "button" })) : null] }), openTutorial ? _jsx(TutorialDialog, { kind: openTutorial, onClose: () => setOpenTutorial(null) }) : null, isRaiseSheetOpen ? (_jsx(RaiseSheet, { callAmount: snapshot.hand.callAmount, currentBet: snapshot.hand.currentBet, isRaiseToValid: isRaiseToValid, maximumRaiseTo: maximumRaiseTo, minimumRaiseTo: minimumRaiseTo, onCancel: () => setIsRaiseSheetOpen(false), onRaiseToChange: setRaiseTo, onSubmit: submitRaise, pot: snapshot.hand.pot, raiseTo: raiseTo, stack: viewerPlayer?.stack ?? 0 })) : null] }));
}
