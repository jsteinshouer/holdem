import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { registerServiceWorker } from "./pwa";
import { connectionStatusLabel, isCommandInputDisabled } from "./tableView";
import { TableRoom } from "./table/TableRoom";
import { MoonIcon, SunIcon } from "./icons";
import "./styles.css";
const serverUrl = import.meta.env.VITE_SERVER_URL ?? window.location.origin;
const THEME_STORAGE_KEY = "friendly-holdem:theme";
// The room around the table is what flips; the felt and the cards barely move.
const THEME_COLORS = { dark: "#0F1412", light: "#F2EEE6" };
function readStoredTheme() {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}
function App() {
    const [theme, setTheme] = useState(readStoredTheme);
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
    }, [theme]);
    const [socket, setSocket] = useState(null);
    const [connectionState, setConnectionState] = useState("connecting");
    const [snapshot, setSnapshot] = useState(null);
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState(null);
    const tableIdFromUrl = getTableIdFromPath();
    useEffect(() => {
        const nextSocket = io(serverUrl, { autoConnect: true, transports: ["websocket", "polling"] });
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
            const response = await emitCommand(socket, "hand:start", { tableId: snapshot.tableId });
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
    return (_jsx("main", { className: "shell", children: _jsxs("div", { className: "shell__inner", children: [_jsxs("header", { className: "masthead", children: [_jsx("h1", { children: "Friendly Hold'em" }), _jsxs("div", { className: "masthead__actions", children: [_jsxs("span", { className: `status status--${connectionState}`, children: [_jsx("span", { "aria-hidden": "true", className: "status__dot" }), connectionStatusLabel(connectionState)] }), _jsx("button", { "aria-label": theme === "light" ? "Switch to dark mode" : "Switch to light mode", className: "icon-button", onClick: () => setTheme(theme === "light" ? "dark" : "light"), type: "button", children: theme === "light" ? _jsx(MoonIcon, {}) : _jsx(SunIcon, {}) })] })] }), snapshot ? (_jsx(TableRoom, { error: error, inviteLink: inviteLink, onPlayerAction: playerAction, onSendChatMessage: sendChatMessage, onStartHand: startHand, onTableCommand: tableCommand, snapshot: snapshot })) : (_jsx(EntryPanel, { displayName: displayName, error: error, isDisabled: isCommandInputDisabled(Boolean(socket), connectionState), onDisplayNameChange: setDisplayName, onSubmit: tableIdFromUrl ? joinTable : createTable, tableId: tableIdFromUrl }))] }) }));
}
// One entry panel for both arrivals. Creating and joining differ by a single
// fact — whether the URL already names a table — so they are one component with
// one label, not two near-identical forms.
function EntryPanel({ displayName, error, isDisabled, tableId, onDisplayNameChange, onSubmit }) {
    const isJoining = Boolean(tableId);
    return (_jsx("section", { className: "entry", children: _jsxs("div", { className: "entry__card", children: [_jsx("h2", { children: isJoining ? "Join the table" : "Deal your friends in" }), _jsx("p", { className: "entry__lead", children: isJoining
                        ? "Pick a name your friends will recognise. No account, no password."
                        : "Start a private table, send one link, and play. Play money only — nothing here is real." }), _jsxs("form", { className: "entry__form", onSubmit: (event) => {
                        event.preventDefault();
                        onSubmit();
                    }, children: [_jsxs("label", { className: "field", htmlFor: "display-name", children: [_jsx("span", { children: "Your display name" }), _jsx("input", { autoComplete: "nickname", id: "display-name", maxLength: 32, placeholder: "e.g. Grace", required: true, value: displayName, onChange: (event) => onDisplayNameChange(event.target.value) })] }), _jsx("button", { className: "action action--primary action--wide", disabled: isDisabled, type: "submit", children: _jsx("span", { className: "action__label", children: isJoining ? "Join table" : "Create table" }) })] }), error ? (_jsx("p", { className: "form-error", role: "alert", children: error })) : null, isJoining ? _jsxs("p", { className: "entry__note", children: ["Invite ", tableId] }) : null] }) }));
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
