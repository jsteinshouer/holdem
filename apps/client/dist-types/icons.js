import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function Icon({ children, className }) {
    return (_jsx("svg", { "aria-hidden": "true", className: className, fill: "none", focusable: "false", height: "20", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.75", viewBox: "0 0 24 24", width: "20", children: children }));
}
export function SunIcon({ className }) {
    return (_jsxs(Icon, { className: className, children: [_jsx("circle", { cx: "12", cy: "12", r: "4" }), _jsx("path", { d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" })] }));
}
export function MoonIcon({ className }) {
    return (_jsx(Icon, { className: className, children: _jsx("path", { d: "M20 14.5A8.2 8.2 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5Z" }) }));
}
export function CopyIcon({ className }) {
    return (_jsxs(Icon, { className: className, children: [_jsx("rect", { height: "12", rx: "2", width: "12", x: "8", y: "8" }), _jsx("path", { d: "M5 15.5A2 2 0 0 1 4 14V5a2 2 0 0 1 2-2h9a2 2 0 0 1 1.5.7" })] }));
}
export function CheckIcon({ className }) {
    return (_jsx(Icon, { className: className, children: _jsx("path", { d: "m4 12.5 5.2 5L20 6.5" }) }));
}
export function CloseIcon({ className }) {
    return (_jsx(Icon, { className: className, children: _jsx("path", { d: "m6 6 12 12M18 6 6 18" }) }));
}
export function SendIcon({ className }) {
    return (_jsx(Icon, { className: className, children: _jsx("path", { d: "M4.5 12 20 4.5 15 20l-3.4-6.1L4.5 12Z" }) }));
}
export function HelpIcon({ className }) {
    return (_jsxs(Icon, { className: className, children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M9.5 9.5a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.1-2.5 3.9" }), _jsx("path", { d: "M12 17.4h.01" })] }));
}
export function DealerIcon({ className }) {
    return (_jsxs(Icon, { className: className, children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M9.5 8.2h2.2a3.8 3.8 0 0 1 0 7.6H9.5Z" })] }));
}
