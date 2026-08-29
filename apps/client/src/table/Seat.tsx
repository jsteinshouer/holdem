import type { TableSnapshot } from "@friendly-holdem/shared";
import { CardBack, PlayingCard } from "./PlayingCard";
import { ChipStack } from "./ChipStack";
import { formatDuration, money } from "../lib/format";

type SeatSnapshot = TableSnapshot["seats"][number];

// One seat component for all six positions and every state, on both device
// classes. It carries a strict slot order — name, stack, bet, state — so six
// plates scan as one aligned column of data rather than six small compositions.
//
// Identity and position are the same object: this plate IS the player's place at
// the table, which is why no separate roster panel repeats it.
export function Seat({
  seat,
  angle,
  isViewer,
  viewerHoleCards,
  handName
}: {
  seat: SeatSnapshot;
  angle: number;
  isViewer: boolean;
  viewerHoleCards?: TableSnapshot["hand"]["viewerHoleCards"];
  handName?: string | null;
}) {
  const player = seat.player;
  const seatLabel = `Seat ${seat.seatNumber + 1}`;

  const states: { key: string; label: string }[] = [];

  if (player?.isAllIn) states.push({ key: "allin", label: "All in" });
  if (player?.hasFolded) states.push({ key: "folded", label: "Folded" });
  if (player?.isSittingOut) states.push({ key: "out", label: "Sitting out" });
  if (player?.isBusted) states.push({ key: "busted", label: "Busted" });
  if (player?.isBot) states.push({ key: "bot", label: "Bot" });
  if (player && !player.isConnected && !player.isBot) states.push({ key: "away", label: "Away" });
  if (player?.isHost) states.push({ key: "host", label: "Host" });

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

  return (
    <article className={className} style={{ "--seat-angle": `${angle}deg` } as React.CSSProperties}>
      {player ? (
        <>
          <header className="seat__head">
            <span className="seat__name">{player.displayName}</span>
            <span className="seat__marks" aria-hidden="true">
              {player.isButton ? <span className="mark mark--button">D</span> : null}
              {player.isSmallBlind ? <span className="mark">SB</span> : null}
              {player.isBigBlind ? <span className="mark">BB</span> : null}
            </span>
          </header>

          <span className="seat__stack">{money(player.stack)}</span>

          {player.currentBet > 0 ? (
            <span className="seat__bet">
              <ChipStack amount={player.currentBet} />
            </span>
          ) : null}

          <span className="seat__states">
            <span className="seat__seat-no">{seatLabel}</span>
            {player.isCurrentActor ? <span className="state state--acting">To act</span> : null}
            {states.map((state) => (
              <span className={`state state--${state.key}`} key={state.key}>
                {state.label}
              </span>
            ))}
            {player.inactiveForMs !== null && player.isCurrentActor ? (
              <span className="state state--idle">{formatDuration(player.inactiveForMs)}</span>
            ) : null}
          </span>

          <span className="seat__cards">
            {isViewer && viewerHoleCards && viewerHoleCards.length > 0 ? (
              viewerHoleCards.map((card, index) => (
                <PlayingCard card={card} dealIndex={index} key={`${card.rank}-${card.suit}`} size="md" />
              ))
            ) : player.visibleHoleCards.length > 0 ? (
              player.visibleHoleCards.map((card, index) => (
                <PlayingCard card={card} dealIndex={index} key={`${card.rank}-${card.suit}`} size="sm" />
              ))
            ) : player.hasCards ? (
              <>
                <CardBack />
                <CardBack />
              </>
            ) : null}
          </span>

          {isViewer && handName ? <span className="seat__hand-name">{handName}</span> : null}
        </>
      ) : (
        <>
          <header className="seat__head">
            <span className="seat__name seat__name--open">Open seat</span>
          </header>
          <span className="seat__states">
            <span className="seat__seat-no">{seatLabel}</span>
          </span>
        </>
      )}
    </article>
  );
}
