import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { CloseIcon } from "../icons";
const BEGINNER_STEPS = [
    "Each hand starts with blinds, then every active player receives two private hole cards.",
    "The board is dealt in streets: flop, turn, and river, with betting before and after each street.",
    "On your turn you may fold, check, call, raise, or move all-in when that action is legal.",
    "All-in players stay eligible for pots they helped build; side pots separate chips they cannot win.",
    "At showdown, eligible hands reveal and the best five-card hand wins: high card through straight flush."
];
const HOST_STEPS = [
    "Create a table, copy the invite link, and share it with friends privately.",
    "Before the first hand, joiners auto-seat until six seats are filled; later joiners watch as spectators.",
    "Use Start hand for hand one, then Deal next hand after settlement.",
    "Between hands you can seat spectators, approve rebuys, and remove away seated players.",
    "If a connected player stalls on their turn, the host auto-fold control appears after the inactivity window."
];
export function TutorialDialog({ kind, onClose }) {
    const isBeginner = kind === "beginner";
    const title = isBeginner ? "Beginner tutorial" : "Host tutorial";
    const steps = isBeginner ? BEGINNER_STEPS : HOST_STEPS;
    useEffect(() => {
        function onKeyDown(event) {
            if (event.key === "Escape") {
                onClose();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);
    return (_jsx("div", { className: "sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "tutorial-title", children: _jsxs("div", { className: "sheet__panel", children: [_jsxs("header", { className: "sheet__head", children: [_jsx("h2", { id: "tutorial-title", children: title }), _jsx("button", { "aria-label": "Dismiss", className: "icon-button", onClick: onClose, type: "button", children: _jsx(CloseIcon, {}) })] }), _jsx("ol", { className: "steps", children: steps.map((step) => (_jsx("li", { children: step }, step))) }), _jsx("button", { className: "action action--primary action--wide", onClick: onClose, type: "button", children: _jsx("span", { className: "action__label", children: "Close" }) })] }) }));
}
