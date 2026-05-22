import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
const demoTable = {
    tableId: "invite-preview",
    viewerRole: "host",
    seatedPlayerCount: 0,
    spectatorCount: 0,
    defaults: {
        startingStack: 1000,
        blinds: {
            smallBlind: 5,
            bigBlind: 10
        },
        disconnectedActionGraceMs: 30000,
        hostAutoFoldAfterMs: 120000,
        eventLogCap: 200
    }
};
function App() {
    return (_jsx("main", { className: "app-shell", children: _jsxs("section", { className: "table-room", "aria-labelledby": "table-heading", children: [_jsx("div", { className: "table-room__status", children: "Private table foundation" }), _jsx("h1", { id: "table-heading", children: "Friendly Hold'em" }), _jsx("p", { children: "A quiet tabletop room is ready for the next slices: private invites, player snapshots, host controls, and one complete hand of play-money Hold'em." }), _jsxs("dl", { className: "table-room__defaults", "aria-label": "Default table settings", children: [_jsxs("div", { children: [_jsx("dt", { children: "Starting stack" }), _jsxs("dd", { children: ["$", demoTable.defaults.startingStack.toLocaleString()] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Blinds" }), _jsxs("dd", { children: ["$", demoTable.defaults.blinds.smallBlind, "/$", demoTable.defaults.blinds.bigBlind] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Event log cap" }), _jsx("dd", { children: demoTable.defaults.eventLogCap })] })] })] }) }));
}
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
