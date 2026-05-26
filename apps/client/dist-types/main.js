import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
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
    return (_jsx("main", { className: "app-shell", children: _jsxs("section", { className: "room-board", "aria-labelledby": "app-heading", children: [_jsxs("header", { className: "room-board__masthead", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Private Hold'em Room" }), _jsx("h1", { id: "app-heading", children: "Friendly Hold'em" })] }), _jsx("span", { className: `status-pill status-pill--${connectionState}`, children: connectionState === "connected" ? "Online" : connectionState })] }), snapshot ? (_jsx(TableRoom, { snapshot: snapshot, inviteLink: inviteLink })) : tableIdFromUrl ? (_jsx(JoinTablePanel, { displayName: displayName, error: error, isDisabled: !socket || connectionState !== "connected", tableId: tableIdFromUrl, onDisplayNameChange: setDisplayName, onJoin: joinTable })) : (_jsx(CreateTablePanel, { displayName: displayName, error: error, isDisabled: !socket || connectionState !== "connected", onDisplayNameChange: setDisplayName, onCreate: createTable }))] }) }));
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
function TableRoom({ snapshot, inviteLink }) {
    const host = snapshot.seats
        .map((seat) => seat.player)
        .find((player) => player?.isHost);
    return (_jsxs("div", { className: "table-layout", children: [_jsxs("section", { className: "table-summary", "aria-labelledby": "table-summary-heading", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: snapshot.viewerRole }), _jsxs("h2", { id: "table-summary-heading", children: ["Table ", snapshot.tableId] })] }), _jsxs("div", { className: "invite-box", children: [_jsx("label", { htmlFor: "invite-link", children: "Invite link" }), _jsx("input", { id: "invite-link", readOnly: true, value: inviteLink, onFocus: (event) => event.target.select() })] }), _jsxs("dl", { className: "table-metrics", "aria-label": "Table status", children: [_jsxs("div", { children: [_jsx("dt", { children: "Host" }), _jsx("dd", { children: host?.displayName ?? "Unknown" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Seats" }), _jsxs("dd", { children: [snapshot.seatedPlayerCount, "/6"] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Spectators" }), _jsx("dd", { children: snapshot.spectatorCount })] }), _jsxs("div", { children: [_jsx("dt", { children: "Blinds" }), _jsxs("dd", { children: ["$", snapshot.defaults.blinds.smallBlind, "/$", snapshot.defaults.blinds.bigBlind] })] })] })] }), _jsx("section", { className: "seat-grid", "aria-label": "Seated players", children: snapshot.seats.map((seat) => (_jsxs("article", { className: "seat", children: [_jsxs("span", { className: "seat__number", children: ["Seat ", seat.seatNumber + 1] }), seat.player ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: seat.player.displayName }), _jsx("span", { children: seat.player.isHost ? "Host" : seat.player.isConnected ? "Connected" : "Away" })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: "Open" }), _jsx("span", { children: "Available before the first hand" })] }))] }, seat.seatNumber))) }), _jsxs("aside", { className: "rail-panel", "aria-labelledby": "rail-heading", children: [_jsx("h2", { id: "rail-heading", children: "Rail" }), snapshot.spectators.length > 0 ? (_jsx("ul", { children: snapshot.spectators.map((spectator) => (_jsxs("li", { children: [spectator.displayName, _jsx("span", { children: spectator.isConnected ? "watching" : "away" })] }, spectator.id))) })) : (_jsx("p", { children: "No spectators yet." })), _jsxs("div", { className: "control-strip", "aria-label": "Available controls", children: [_jsx("button", { disabled: !snapshot.availableControls.canStartHand, children: "Start hand" }), _jsx("button", { disabled: !snapshot.availableControls.canSeatSpectators, children: "Seat spectator" })] })] })] }));
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
