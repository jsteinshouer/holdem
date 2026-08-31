import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { chipRuns } from "../lib/chips";
import { money } from "../lib/format";
// Chips render flat: solid denomination fill, a darker hairline, and a dashed
// inner ring standing in for edge spots. No gradients, no rendered highlights.
// The figure beside the stack is the authority; the discs are the encoding.
export function ChipStack({ amount, label }) {
    if (amount <= 0) {
        return null;
    }
    const runs = chipRuns(amount);
    return (_jsxs("span", { className: "chips", children: [_jsx("span", { "aria-hidden": "true", className: "chips__discs", children: runs.map((run) => (_jsx("span", { className: `chip chip--${run.denomination}`, children: run.count > 1 ? _jsx("em", { children: run.count }) : null }, run.denomination))) }), _jsx("span", { className: "chips__amount", children: money(amount) }), label ? _jsx("span", { className: "chips__label", children: label }) : null] }));
}
