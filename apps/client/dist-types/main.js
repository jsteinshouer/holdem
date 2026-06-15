import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { registerServiceWorker } from "./pwa";
import "./styles.css";
const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787";
function App() {
    const [socket, setSocket] = useState(null);
    const [connectionState, setConnectionState] = useState("connecting");
    const [snapshot, setSnapshot] = useState(null);
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState(null);
    const tableIdFromUrl = getTableIdFromPath();
    useEffect(() => {
        const nextSocket = io(serverUrl, {
            autoConnect: true,
            transports: ["websocket", "polling"]
        });
        nextSocket.on("connect", () => setConnectionState("connected"));
        nextSocket.on("disconnect", () => setConnectionState("offline"));
        nextSocket.on("connect_error", () => setConnectionState("offline"));
        nextSocket.on("table:snapshot", (nextSnapshot) => {
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
            .catch((nextError) => setError(nextError.message));
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
            const response = await emitCommand(socket, "table:create", { displayName });
            const nextSnapshot = handleSessionResponse(response);
            window.history.replaceState(null, "", nextSnapshot.invitePath);
        }
        catch (nextError) {
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
            const response = await emitCommand(socket, "table:join", {
                tableId: tableIdFromUrl,
                displayName,
                ...(sessionToken ? { sessionToken } : {})
            });
            handleSessionResponse(response);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : "Unable to join table.");
        }
    }
    async function startHand() {
        if (!socket || !snapshot) {
            return;
        }
        setError(null);
        try {
            const response = await emitCommand(socket, "hand:start", {
                tableId: snapshot.tableId
            });
            handleSessionResponse(response);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : "Unable to start hand.");
        }
    }
    async function playerAction(action, raiseTo) {
        if (!socket || !snapshot) {
            return;
        }
        setError(null);
        try {
            const response = await emitCommand(socket, "player:action", {
                tableId: snapshot.tableId,
                action,
                ...(raiseTo ? { raiseTo } : {})
            });
            handleSessionResponse(response);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : "Unable to act.");
        }
    }
    async function tableCommand(eventName, payload, fallbackMessage) {
        if (!socket) {
            return;
        }
        setError(null);
        try {
            const response = await emitCommand(socket, eventName, payload);
            handleSessionResponse(response);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : fallbackMessage);
        }
    }
    async function sendChatMessage(body) {
        if (!socket || !snapshot) {
            return;
        }
        setError(null);
        try {
            const response = await emitCommand(socket, "chat:send", {
                tableId: snapshot.tableId,
                body
            });
            handleSessionResponse(response);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : "Unable to send chat message.");
        }
    }
    function handleSessionResponse(response) {
        if (!response.ok) {
            throw new Error(response.reason);
        }
        storeSessionToken(response.snapshot.tableId, response.sessionToken);
        rememberLastTable(response.snapshot.tableId);
        setSnapshot(response.snapshot);
        setDisplayName("");
        return response.snapshot;
    }
    return (_jsx("main", { className: "app-shell", children: _jsxs("section", { className: "room-board", "aria-labelledby": "app-heading", children: [_jsxs("header", { className: "room-board__masthead", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Private Hold'em Room" }), _jsx("h1", { id: "app-heading", children: "Friendly Hold'em" })] }), _jsx("span", { className: `status-pill status-pill--${connectionState}`, children: connectionState === "connected" ? "Online" : connectionState })] }), snapshot ? (_jsx(TableRoom, { error: error, inviteLink: inviteLink, snapshot: snapshot, onPlayerAction: playerAction, onSendChatMessage: sendChatMessage, onTableCommand: tableCommand, onStartHand: startHand })) : tableIdFromUrl ? (_jsx(JoinTablePanel, { displayName: displayName, error: error, isDisabled: !socket || connectionState !== "connected", tableId: tableIdFromUrl, onDisplayNameChange: setDisplayName, onJoin: joinTable })) : (_jsx(CreateTablePanel, { displayName: displayName, error: error, isDisabled: !socket || connectionState !== "connected", onDisplayNameChange: setDisplayName, onCreate: createTable }))] }) }));
}
function CreateTablePanel(props) {
    return (_jsxs("form", { className: "entry-panel", onSubmit: (event) => {
            event.preventDefault();
            props.onCreate();
        }, children: [_jsx("label", { htmlFor: "create-display-name", children: "Your display name" }), _jsxs("div", { className: "entry-panel__row", children: [_jsx("input", { id: "create-display-name", maxLength: 32, required: true, value: props.displayName, onChange: (event) => props.onDisplayNameChange(event.target.value) }), _jsx("button", { disabled: props.isDisabled, type: "submit", children: "Create table" })] }), props.error ? _jsx("p", { className: "form-error", children: props.error }) : null] }));
}
function JoinTablePanel(props) {
    return (_jsxs("form", { className: "entry-panel", onSubmit: (event) => {
            event.preventDefault();
            props.onJoin();
        }, children: [_jsxs("p", { className: "table-code", children: ["Invite ", props.tableId] }), _jsx("label", { htmlFor: "join-display-name", children: "Your display name" }), _jsxs("div", { className: "entry-panel__row", children: [_jsx("input", { id: "join-display-name", maxLength: 32, required: true, value: props.displayName, onChange: (event) => props.onDisplayNameChange(event.target.value) }), _jsx("button", { disabled: props.isDisabled, type: "submit", children: "Join table" })] }), props.error ? _jsx("p", { className: "form-error", children: props.error }) : null] }));
}
function TableRoom({ error, snapshot, inviteLink, onPlayerAction, onSendChatMessage, onTableCommand, onStartHand }) {
    const [raiseTo, setRaiseTo] = useState(() => String(snapshot.hand.currentBet + snapshot.defaults.blinds.bigBlind));
    const [nowMs, setNowMs] = useState(Date.now);
    const [activeMobilePanel, setActiveMobilePanel] = useState("log");
    const [chatDraft, setChatDraft] = useState("");
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [openTutorial, setOpenTutorial] = useState(null);
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
    const currentActorInactiveForMs = snapshot.hand.currentActorSince === null ? 0 : Math.max(0, nowMs - snapshot.hand.currentActorSince);
    const canHostAutoFoldInactive = snapshot.isHost &&
        Boolean(currentActor) &&
        Boolean(currentActor?.isConnected) &&
        !currentActor?.isAllIn &&
        currentActorInactiveForMs >= snapshot.defaults.hostAutoFoldAfterMs;
    const isViewerTurn = snapshot.hand.currentActorId === snapshot.viewerParticipantId && snapshot.hand.legalActions.length > 0;
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
    return (_jsxs("div", { className: `table-layout ${isViewerTurn ? "table-layout--your-turn" : ""}`, children: [_jsxs("section", { className: "table-summary", "aria-labelledby": "table-summary-heading", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: snapshot.viewerRole }), _jsxs("h2", { id: "table-summary-heading", children: ["Table ", snapshot.tableId] })] }), _jsxs("div", { className: "invite-box", children: [_jsx("label", { htmlFor: "invite-link", children: "Invite link" }), _jsx("input", { id: "invite-link", readOnly: true, value: inviteLink, onFocus: (event) => event.target.select() })] }), _jsxs("div", { className: "tutorial-actions", "aria-label": "Tutorials", children: [_jsx("button", { onClick: () => setOpenTutorial("beginner"), type: "button", children: "Beginner tutorial" }), _jsx("button", { onClick: () => setOpenTutorial("host"), type: "button", children: "Host tutorial" })] }), _jsxs("dl", { className: "table-metrics", "aria-label": "Table status", children: [_jsxs("div", { children: [_jsx("dt", { children: "Host" }), _jsx("dd", { children: host?.displayName ?? "Unknown" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Seats" }), _jsxs("dd", { children: [snapshot.seatedPlayerCount, "/6"] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Spectators" }), _jsx("dd", { children: snapshot.spectatorCount })] }), _jsxs("div", { children: [_jsx("dt", { children: "Blinds" }), _jsxs("dd", { children: ["$", snapshot.defaults.blinds.smallBlind, "/$", snapshot.defaults.blinds.bigBlind] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Phase" }), _jsx("dd", { children: formatPhase(snapshot.hand.phase) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Pot" }), _jsxs("dd", { children: ["$", snapshot.hand.pot] })] }), _jsxs("div", { children: [_jsx("dt", { children: "To call" }), _jsxs("dd", { children: ["$", snapshot.hand.callAmount] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Action" }), _jsx("dd", { children: currentActor?.displayName ?? "Waiting" })] })] })] }), _jsxs("nav", { className: "mobile-tabs", "aria-label": "Table panels", children: [_jsx("button", { "aria-pressed": activeMobilePanel === "log", onClick: () => setActiveMobilePanel("log"), type: "button", children: "Log" }), _jsxs("button", { "aria-pressed": activeMobilePanel === "chat", onClick: () => setActiveMobilePanel("chat"), type: "button", children: ["Chat", unreadChatCount > 0 ? ` (${unreadChatCount})` : ""] }), _jsx("button", { "aria-pressed": activeMobilePanel === "help", onClick: () => setActiveMobilePanel("help"), type: "button", children: "Help" })] }), _jsxs("section", { className: "felt-panel", "aria-labelledby": "felt-heading", children: [_jsxs("div", { className: "felt-panel__header", children: [_jsxs("div", { children: [_jsxs("p", { className: "eyebrow", children: ["Hand ", snapshot.hand.handNumber || "-"] }), _jsx("h2", { id: "felt-heading", children: formatPhase(snapshot.hand.phase) })] }), _jsxs("span", { className: "pot-chip", children: ["$", snapshot.hand.currentBet, " current bet"] })] }), _jsx("div", { className: "board-row", "aria-label": "Community cards", children: snapshot.hand.board.length > 0 ? (snapshot.hand.board.map((card) => _jsx(CardView, { card: card }, `${card.rank}-${card.suit}`))) : (_jsx("span", { className: "empty-board", children: "Board waiting for the flop" })) }), _jsxs("div", { className: "hole-card-tray", "aria-label": "Your hole cards", children: [_jsx("span", { children: "Your cards" }), _jsx("div", { children: snapshot.hand.viewerHoleCards.length > 0 ? (snapshot.hand.viewerHoleCards.map((card) => _jsx(CardView, { card: card }, `${card.rank}-${card.suit}`))) : (_jsx("span", { className: "card-back", children: "Hidden" })) })] }), _jsx(ActionBar, { canRaise: canRaise, legalActions: snapshot.hand.legalActions, minimumRaiseTo: minimumRaiseTo, raiseTo: raiseTo, onAction: onPlayerAction, onRaiseToChange: setRaiseTo })] }), _jsx("section", { className: "seat-grid", "aria-label": "Seated players", children: snapshot.seats.map((seat) => (_jsxs("article", { className: `seat ${seat.player?.isCurrentActor ? "seat--acting" : ""}`, children: [_jsxs("span", { className: "seat__number", children: ["Seat ", seat.seatNumber + 1] }), seat.player ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "seat__title", children: [_jsx("strong", { children: seat.player.displayName }), _jsxs("span", { children: ["$", seat.player.stack] })] }), _jsxs("div", { className: "seat__badges", "aria-label": `${seat.player.displayName} seat status`, children: [seat.player.isButton ? _jsx("span", { children: "Button" }) : null, seat.player.isSmallBlind ? _jsx("span", { children: "Small blind" }) : null, seat.player.isBigBlind ? _jsx("span", { children: "Big blind" }) : null, seat.player.hasCards ? _jsx("span", { children: "Cards dealt" }) : null, seat.player.hasFolded ? _jsx("span", { children: "Folded" }) : null, seat.player.isAllIn ? _jsx("span", { children: "All-in" }) : null, seat.player.isSittingOut ? _jsx("span", { children: "Sitting out" }) : null, seat.player.isBusted ? _jsx("span", { children: "Busted" }) : null, !seat.player.isConnected ? _jsx("span", { children: "Away" }) : null, seat.player.inactiveForMs !== null ? (_jsxs("span", { children: ["Inactive ", formatDuration(seat.player.inactiveForMs)] })) : null, seat.player.isHost ? _jsx("span", { children: "Host" }) : null] }), seat.player.visibleHoleCards.length > 0 ? (_jsx("div", { className: "revealed-cards", "aria-label": `${seat.player.displayName} revealed cards`, children: seat.player.visibleHoleCards.map((card) => (_jsx(CardView, { card: card }, `${seat.player?.id}-${card.rank}-${card.suit}`))) })) : null, _jsxs("span", { children: [seat.player.isConnected ? "Connected" : "Away", " / Bet $", seat.player.currentBet] })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: "Open" }), _jsx("span", { children: "Available before the first hand" })] }))] }, seat.seatNumber))) }), _jsxs("aside", { className: "rail-panel", "aria-labelledby": "rail-heading", children: [_jsx("h2", { id: "rail-heading", children: "Rail" }), _jsx("div", { className: "rail-panel__section rail-panel__section--help", "data-active": activeMobilePanel === "help", children: _jsx(RailControls, { canHostAutoFoldInactive: canHostAutoFoldInactive, snapshot: snapshot, onStartHand: onStartHand, onTableCommand: onTableCommand }) }), error ? _jsx("p", { className: "form-error", children: error }) : null, _jsx("div", { className: "rail-panel__section rail-panel__section--log", "data-active": activeMobilePanel === "log", children: _jsx(ActionLog, { entries: snapshot.hand.actionLog }) }), _jsx("div", { className: "rail-panel__section rail-panel__section--chat", "data-active": activeMobilePanel === "chat", children: _jsx(ChatPanel, { chatDraft: chatDraft, messages: snapshot.chatMessages, onChatDraftChange: setChatDraft, onSubmitChat: submitChat }) })] }), openTutorial ? _jsx(TutorialDialog, { kind: openTutorial, onClose: () => setOpenTutorial(null) }) : null] }));
}
function RailControls({ canHostAutoFoldInactive, snapshot, onStartHand, onTableCommand }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "spectator-list", children: [_jsx("h3", { children: "Spectators" }), snapshot.spectators.length > 0 ? (_jsx("ul", { children: snapshot.spectators.map((spectator) => (_jsxs("li", { children: [spectator.displayName, _jsx("span", { children: spectator.isConnected ? "watching" : "away" })] }, spectator.id))) })) : (_jsx("p", { children: "No spectators yet." }))] }), _jsxs("div", { className: "control-strip", "aria-label": "Available controls", children: [_jsx("button", { disabled: !snapshot.availableControls.canStartHand, onClick: onStartHand, type: "button", children: "Start hand" }), _jsx("button", { disabled: !canHostAutoFoldInactive, onClick: () => onTableCommand("host:autoFoldInactive", { tableId: snapshot.tableId }, "Unable to auto-fold inactive player."), type: "button", children: "Auto-fold inactive" }), _jsx("button", { disabled: !snapshot.availableControls.canDealNextHand, onClick: () => onTableCommand("hand:next", { tableId: snapshot.tableId }, "Unable to deal next hand."), type: "button", children: "Deal next hand" }), _jsx("button", { disabled: !snapshot.availableControls.canSitOut, onClick: () => onTableCommand("player:sitOut", { tableId: snapshot.tableId }, "Unable to sit out."), type: "button", children: "Sit out" }), _jsx("button", { disabled: !snapshot.availableControls.canRejoin, onClick: () => onTableCommand("player:rejoin", { tableId: snapshot.tableId }, "Unable to rejoin."), type: "button", children: "Rejoin" })] }), snapshot.isHost ? (_jsxs("div", { className: "host-controls", "aria-label": "Host table controls", children: [snapshot.spectators.length > 0 ? (_jsxs("div", { children: [_jsx("h3", { children: "Seat spectators" }), snapshot.spectators.map((spectator) => (_jsxs("button", { disabled: !snapshot.availableControls.canSeatSpectators, onClick: () => onTableCommand("host:seatSpectator", { tableId: snapshot.tableId, participantId: spectator.id }, "Unable to seat spectator."), type: "button", children: ["Seat ", spectator.displayName] }, spectator.id)))] })) : null, _jsxs("div", { children: [_jsx("h3", { children: "Players" }), snapshot.seats
                                .map((seat) => seat.player)
                                .filter(isSeatPlayer)
                                .filter((player) => !player.isHost)
                                .map((player) => (_jsxs("div", { className: "host-controls__row", children: [_jsx("span", { children: player.displayName }), _jsx("button", { disabled: snapshot.hand.phase !== "settled" && snapshot.hand.phase !== "waiting", onClick: () => onTableCommand("host:approveRebuy", { tableId: snapshot.tableId, participantId: player.id }, "Unable to approve rebuy."), type: "button", children: "Rebuy" }), _jsx("button", { disabled: player.isConnected || (snapshot.hand.phase !== "settled" && snapshot.hand.phase !== "waiting"), onClick: () => onTableCommand("host:removePlayer", { tableId: snapshot.tableId, participantId: player.id }, "Unable to remove player."), type: "button", children: "Remove" })] }, player.id)))] })] })) : null] }));
}
function ActionLog({ entries }) {
    return (_jsxs("div", { className: "action-log", "aria-label": "Public action log", children: [_jsx("h3", { children: "Action log" }), entries.length > 0 ? (_jsx("ol", { children: entries.map((entry, index) => (_jsx("li", { children: entry }, `${entry}-${index}`))) })) : (_jsx("p", { children: "No hand actions yet." }))] }));
}
function ChatPanel({ chatDraft, messages, onChatDraftChange, onSubmitChat }) {
    return (_jsxs("section", { className: "chat-panel", "aria-label": "Table chat", children: [_jsx("h3", { children: "Chat" }), _jsx("ol", { className: "chat-messages", children: messages.length > 0 ? (messages.map((message) => (_jsxs("li", { children: [_jsx("strong", { children: message.displayName }), _jsx("span", { children: formatTime(message.sentAt) }), _jsx("p", { children: message.body })] }, message.id)))) : (_jsx("li", { className: "chat-messages__empty", children: "No messages yet." })) }), _jsxs("form", { className: "chat-form", onSubmit: (event) => {
                    event.preventDefault();
                    onSubmitChat();
                }, children: [_jsx("label", { htmlFor: "chat-message", children: "Message" }), _jsx("textarea", { id: "chat-message", maxLength: 180, value: chatDraft, onChange: (event) => onChatDraftChange(event.target.value) }), _jsx("button", { disabled: !chatDraft.trim(), type: "submit", children: "Send" })] })] }));
}
function TutorialDialog({ kind, onClose }) {
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
    return (_jsx("div", { className: "tutorial-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "tutorial-title", children: _jsxs("div", { className: "tutorial-dialog__panel", children: [_jsxs("div", { className: "tutorial-dialog__header", children: [_jsx("h2", { id: "tutorial-title", children: title }), _jsx("button", { onClick: onClose, type: "button", children: "Close" })] }), _jsx("ol", { children: steps.map((step) => (_jsx("li", { children: step }, step))) })] }) }));
}
function ActionBar({ canRaise, legalActions, minimumRaiseTo, raiseTo, onAction, onRaiseToChange }) {
    const actionOrder = ["fold", "check", "call", "all-in"];
    return (_jsx("div", { className: "action-bar", "aria-label": "Player actions", children: legalActions.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "action-bar__buttons", children: actionOrder.map((action) => (_jsx("button", { disabled: !legalActions.includes(action), onClick: () => onAction(action), type: "button", children: formatAction(action) }, action))) }), _jsxs("div", { className: "raise-control", children: [_jsx("label", { htmlFor: "raise-to", children: "Raise to" }), _jsx("input", { disabled: !canRaise, id: "raise-to", min: minimumRaiseTo, step: 1, type: "number", value: raiseTo, onChange: (event) => onRaiseToChange(event.target.value) }), _jsx("button", { disabled: !canRaise, onClick: () => onAction("raise", Number(raiseTo)), type: "button", children: "Raise" })] })] })) : (_jsx("span", { children: "No action available" })) }));
}
function CardView({ card }) {
    const suit = suitSymbol(card.suit);
    const pips = pipPositions(card.rank);
    const label = `${card.rank} of ${card.suit}`;
    return (_jsxs("span", { "aria-label": label, className: `playing-card playing-card--${card.suit}`, role: "img", children: [_jsxs("span", { className: "playing-card__corner playing-card__corner--top", children: [_jsx("strong", { children: card.rank }), _jsx("span", { children: suit })] }), pips.length > 0 ? (_jsx("span", { className: `playing-card__pips playing-card__pips--${pips.length}`, "aria-hidden": "true", children: pips.map((position, index) => (_jsx("span", { className: `playing-card__pip playing-card__pip--${position}`, children: suit }, `${position}-${index}`))) })) : (_jsxs("span", { className: "playing-card__face", "aria-hidden": "true", children: [_jsx("span", { children: card.rank }), _jsx("small", { children: suit })] })), _jsxs("span", { className: "playing-card__corner playing-card__corner--bottom", "aria-hidden": "true", children: [_jsx("strong", { children: card.rank }), _jsx("span", { children: suit })] })] }));
}
function isSeatPlayer(player) {
    return Boolean(player);
}
function formatPhase(phase) {
    return phase === "preflop" ? "Preflop" : phase[0]?.toUpperCase() + phase.slice(1);
}
function formatAction(action) {
    return action === "all-in" ? "All-in" : action[0]?.toUpperCase() + action.slice(1);
}
function formatDuration(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}
function formatTime(value) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
    }).format(new Date(value));
}
function suitSymbol(suit) {
    const symbols = {
        clubs: "♣",
        diamonds: "♦",
        hearts: "♥",
        spades: "♠"
    };
    return symbols[suit];
}
function pipPositions(rank) {
    const positionsByRank = {
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
function emitCommand(socket, eventName, payload) {
    return new Promise((resolve, reject) => {
        socket.timeout(5000).emit(eventName, payload, (error, response) => {
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
function getTableIdFromPath() {
    const match = /^\/table\/([^/]+)$/.exec(window.location.pathname);
    return match?.[1] ?? null;
}
function sessionStorageKey(tableId) {
    return `friendly-holdem:session:${tableId}`;
}
function readSessionToken(tableId) {
    return window.localStorage.getItem(sessionStorageKey(tableId)) ?? undefined;
}
function storeSessionToken(tableId, sessionToken) {
    window.localStorage.setItem(sessionStorageKey(tableId), sessionToken);
}
function rememberLastTable(tableId) {
    window.localStorage.setItem("friendly-holdem:last-table", tableId);
}
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
registerServiceWorker().catch(() => {
    // Installability should never block realtime play.
});
