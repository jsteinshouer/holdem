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

export function TutorialDialog({ kind, onClose }: { kind: "beginner" | "host"; onClose: () => void }) {
  const isBeginner = kind === "beginner";
  const title = isBeginner ? "Beginner tutorial" : "Host tutorial";
  const steps = isBeginner ? BEGINNER_STEPS : HOST_STEPS;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="sheet__panel">
        <header className="sheet__head">
          <h2 id="tutorial-title">{title}</h2>
          <button aria-label="Dismiss" className="icon-button" onClick={onClose} type="button">
            <CloseIcon />
          </button>
        </header>
        <ol className="steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <button className="action action--primary action--wide" onClick={onClose} type="button">
          <span className="action__label">Close</span>
        </button>
      </div>
    </div>
  );
}
