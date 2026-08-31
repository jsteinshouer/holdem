import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { raisePresets } from "../tableView";
import { money } from "../lib/format";
import { CloseIcon } from "../icons";
// Raising is the one action that needs a protected, focused moment: it takes an
// amount, and getting it wrong costs the hand. Every other action commits from
// the bar without interruption.
export function RaiseSheet({ callAmount, currentBet, isRaiseToValid, maximumRaiseTo, minimumRaiseTo, pot, raiseTo, stack, onCancel, onRaiseToChange, onSubmit }) {
    const panelRef = useRef(null);
    const presets = raisePresets({ minimumRaiseTo, maximumRaiseTo, currentBet, pot, callAmount });
    const parsed = Number(raiseTo);
    const leftBehind = Number.isFinite(parsed) ? Math.max(0, stack + currentBet - parsed) : stack;
    useEffect(() => {
        panelRef.current?.querySelector("#raise-sheet-amount")?.focus();
        function onKeyDown(event) {
            if (event.key === "Escape") {
                onCancel();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onCancel]);
    return (_jsx("div", { className: "sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "raise-sheet-title", children: _jsxs("form", { className: "sheet__panel", ref: panelRef, onSubmit: (event) => {
                event.preventDefault();
                onSubmit();
            }, children: [_jsxs("header", { className: "sheet__head", children: [_jsx("h2", { id: "raise-sheet-title", children: "Raise" }), _jsx("button", { "aria-label": "Cancel", className: "icon-button", onClick: onCancel, type: "button", children: _jsx(CloseIcon, {}) })] }), _jsxs("dl", { className: "metrics metrics--sheet", "aria-label": "Raise context", children: [_jsxs("div", { children: [_jsx("dt", { children: "Stack" }), _jsx("dd", { children: money(stack) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Pot" }), _jsx("dd", { children: money(pot) })] }), _jsxs("div", { children: [_jsx("dt", { children: "To call" }), _jsx("dd", { children: money(callAmount) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Min raise to" }), _jsx("dd", { children: money(minimumRaiseTo) })] })] }), _jsx("div", { className: "presets", "aria-label": "Preset raise choices", children: presets.map((preset) => (_jsxs("button", { className: Number(raiseTo) === preset.value ? "preset preset--active" : "preset", disabled: preset.value < minimumRaiseTo || preset.value > maximumRaiseTo, onClick: () => onRaiseToChange(String(preset.value)), type: "button", children: [_jsx("span", { children: preset.label }), _jsx("strong", { children: money(preset.value) })] }, preset.label))) }), _jsxs("label", { className: "field", htmlFor: "raise-sheet-amount", children: [_jsx("span", { children: "Exact raise to" }), _jsx("input", { id: "raise-sheet-amount", inputMode: "numeric", max: maximumRaiseTo, min: minimumRaiseTo, step: 1, type: "number", value: raiseTo, onChange: (event) => onRaiseToChange(event.target.value) })] }), _jsxs("p", { className: "sheet__hint", children: ["Allowed ", money(minimumRaiseTo), " to ", money(maximumRaiseTo), ".", " ", isRaiseToValid ? `Leaves you ${money(leftBehind)}.` : "Enter an amount inside the range."] }), _jsxs("button", { className: "action action--primary action--wide", disabled: !isRaiseToValid, type: "submit", children: [_jsxs("span", { className: "action__label", children: ["Raise to ", money(Number(raiseTo) || minimumRaiseTo)] }), _jsxs("span", { className: "action__note", children: [money(leftBehind), " left"] })] })] }) }));
}
