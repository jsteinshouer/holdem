import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { suitSymbol } from "../lib/format";
const PIPS_BY_RANK = {
    A: ["center"],
    "2": ["top-center", "bottom-center"],
    "3": ["top-center", "center", "bottom-center"],
    "4": ["top-left", "top-right", "bottom-left", "bottom-right"],
    "5": ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
    "6": ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"],
    "7": ["top-left", "top-right", "middle-left", "middle-right", "center", "bottom-left", "bottom-right"],
    "8": ["top-left", "top-right", "upper-left", "upper-right", "lower-left", "lower-right", "bottom-left", "bottom-right"],
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
// The system's fixed silhouette. Theme-invariant by rule: a card is a paper
// object, so its ground, ink and suit red hold the same value in light and dark
// while only the room around it flips.
export function PlayingCard({ card, size = "md", dealIndex }) {
    const symbol = suitSymbol(card.suit);
    const pips = PIPS_BY_RANK[card.rank] ?? [];
    return (_jsxs("span", { "aria-label": `${card.rank} of ${card.suit}`, className: `card card--${size} card--${card.suit}`, role: "img", style: dealIndex === undefined ? undefined : { "--deal-index": dealIndex }, children: [_jsxs("span", { className: "card__corner card__corner--top", children: [_jsx("strong", { children: card.rank }), _jsx("span", { children: symbol })] }), pips.length > 0 ? (_jsx("span", { "aria-hidden": "true", className: `card__pips card__pips--${pips.length}`, children: pips.map((position, index) => (_jsx("span", { className: `card__pip card__pip--${position}`, children: symbol }, `${position}-${index}`))) })) : (_jsxs("span", { "aria-hidden": "true", className: "card__court", children: [_jsx("span", { children: card.rank }), _jsx("small", { children: symbol })] })), _jsxs("span", { "aria-hidden": "true", className: "card__corner card__corner--bottom", children: [_jsx("strong", { children: card.rank }), _jsx("span", { children: symbol })] })] }));
}
// A face-down card. Used for opponents holding cards we are not allowed to see.
export function CardBack({ size = "sm" }) {
    return _jsx("span", { "aria-hidden": "true", className: `card card--back card--${size}` });
}
