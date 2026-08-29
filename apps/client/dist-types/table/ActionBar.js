import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { money } from "../lib/format";
// The product's central teaching device. Every action states what it costs and
// what it leaves you with, and an illegal action stays visible and disabled with
// the reason it is unavailable — that is how a first-timer learns a rule instead
// of watching a button disappear.
//
// Slots are fixed and never reorder between streets, so muscle memory holds.
export function ActionBar({ legalActions, callAmount, stack, currentBet, minimumRaiseTo, maximumRaiseTo, isViewerTurn, waitingLabel, onAction, onOpenRaiseSheet }) {
    const canRaise = legalActions.includes("raise") && maximumRaiseTo >= minimumRaiseTo;
    const slots = [
        {
            action: "fold",
            label: "Fold",
            consequence: `keep ${money(stack)}`,
            reason: "not your turn"
        },
        {
            action: "check",
            label: "Check",
            consequence: "costs nothing",
            reason: callAmount > 0 ? `a bet of ${money(callAmount)} is live` : "not your turn"
        },
        {
            action: "call",
            label: callAmount > 0 ? `Call ${money(callAmount)}` : "Call",
            consequence: `${money(Math.max(0, stack - callAmount))} left`,
            reason: callAmount === 0 ? "nothing to call" : "not your turn"
        },
        {
            action: "all-in",
            label: `All in ${money(stack)}`,
            consequence: "$0 left",
            reason: stack <= 0 ? "no chips behind" : "not your turn"
        }
    ];
    if (!isViewerTurn) {
        return (_jsx("div", { "aria-live": "polite", className: "action-bar action-bar--waiting", "aria-label": "Player actions", children: _jsx("p", { className: "action-bar__waiting", children: waitingLabel }) }));
    }
    return (_jsxs("div", { className: "action-bar", "aria-label": "Player actions", children: [slots.map((slot) => {
                const enabled = legalActions.includes(slot.action);
                return (_jsxs("button", { className: `action ${slot.action === "call" || slot.action === "check" ? "action--primary" : ""}`, disabled: !enabled, onClick: () => onAction(slot.action), type: "button", children: [_jsx("span", { className: "action__label", children: slot.label }), _jsx("span", { className: "action__note", children: enabled ? slot.consequence : slot.reason })] }, slot.action));
            }), _jsxs("button", { className: "action action--raise", disabled: !canRaise, onClick: onOpenRaiseSheet, type: "button", children: [_jsx("span", { className: "action__label", children: "Raise" }), _jsx("span", { className: "action__note", children: canRaise ? `min ${money(minimumRaiseTo - currentBet)} more` : "no raise available" })] })] }));
}
