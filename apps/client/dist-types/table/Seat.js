import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CardBack, PlayingCard } from "./PlayingCard";
import { ChipStack } from "./ChipStack";
import { formatDuration, money } from "../lib/format";
// One seat component for all six positions and every state, on both device
// classes. It carries a strict slot order — name, stack, bet, state — so six
// plates scan as one aligned column of data rather than six small compositions.
//
// Identity and position are the same object: this plate IS the player's place at
// the table, which is why no separate roster panel repeats it.
export function Seat({ seat, angle, isViewer, viewerHoleCards, handName }) {
    const player = seat.player;
    const seatLabel = `Seat ${seat.seatNumber + 1}`;
    const states = [];
    if (player?.isAllIn)
        states.push({ key: "allin", label: "All in" });
    if (player?.hasFolded)
        states.push({ key: "folded", label: "Folded" });
    if (player?.isSittingOut)
        states.push({ key: "out", label: "Sitting out" });
    if (player?.isBusted)
        states.push({ key: "busted", label: "Busted" });
    if (player?.isBot)
        states.push({ key: "bot", label: "Bot" });
    if (player && !player.isConnected && !player.isBot)
        states.push({ key: "away", label: "Away" });
    if (player?.isHost)
        states.push({ key: "host", label: "Host" });
    const className = [
        "seat",
        player?.isCurrentActor ? "seat--acting" : "",
        player?.hasFolded ? "seat--folded" : "",
        player && !player.isConnected && !player.isBot ? "seat--away" : "",
        player?.isAllIn ? "seat--allin" : "",
        isViewer ? "seat--viewer" : "",
        player ? "" : "seat--empty"
    ]
        .filter(Boolean)
        .join(" ");
    return (_jsx("article", { className: className, style: { "--seat-angle": `${angle}deg` }, children: player ? (_jsxs(_Fragment, { children: [_jsxs("header", { className: "seat__head", children: [_jsx("span", { className: "seat__name", children: player.displayName }), _jsxs("span", { className: "seat__marks", "aria-hidden": "true", children: [player.isButton ? _jsx("span", { className: "mark mark--button", children: "D" }) : null, player.isSmallBlind ? _jsx("span", { className: "mark", children: "SB" }) : null, player.isBigBlind ? _jsx("span", { className: "mark", children: "BB" }) : null] })] }), _jsx("span", { className: "seat__stack", children: money(player.stack) }), player.currentBet > 0 ? (_jsx("span", { className: "seat__bet", children: _jsx(ChipStack, { amount: player.currentBet }) })) : null, _jsxs("span", { className: "seat__states", children: [_jsx("span", { className: "seat__seat-no", children: seatLabel }), player.isCurrentActor ? _jsx("span", { className: "state state--acting", children: "To act" }) : null, states.map((state) => (_jsx("span", { className: `state state--${state.key}`, children: state.label }, state.key))), player.inactiveForMs !== null && player.isCurrentActor ? (_jsx("span", { className: "state state--idle", children: formatDuration(player.inactiveForMs) })) : null] }), _jsx("span", { className: "seat__cards", "aria-label": isViewer ? "Your hole cards" : `${player.displayName} shown cards`, children: isViewer && viewerHoleCards && viewerHoleCards.length > 0 ? (viewerHoleCards.map((card, index) => (_jsx(PlayingCard, { card: card, dealIndex: index, size: "lg" }, `${card.rank}-${card.suit}`)))) : player.visibleHoleCards.length > 0 ? (player.visibleHoleCards.map((card, index) => (_jsx(PlayingCard, { card: card, dealIndex: index, size: "sm" }, `${card.rank}-${card.suit}`)))) : player.hasCards ? (_jsxs(_Fragment, { children: [_jsx(CardBack, { size: "xs" }), _jsx(CardBack, { size: "xs" })] })) : null }), isViewer && handName ? _jsx("span", { className: "seat__hand-name", children: handName }) : null] })) : (_jsxs(_Fragment, { children: [_jsx("header", { className: "seat__head", children: _jsx("span", { className: "seat__name seat__name--open", children: "Open seat" }) }), _jsx("span", { className: "seat__states", children: _jsx("span", { className: "seat__seat-no", children: seatLabel }) })] })) }));
}
