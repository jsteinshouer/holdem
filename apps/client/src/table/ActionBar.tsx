import type { LegalAction, PlayerActionPayload } from "@friendly-holdem/shared";
import { money } from "../lib/format";

type ActionSlot = {
  action: PlayerActionPayload["action"];
  label: string;
  consequence: string;
  reason: string;
};

// The product's central teaching device. Every action states what it costs and
// what it leaves you with, and an illegal action stays visible and disabled with
// the reason it is unavailable — that is how a first-timer learns a rule instead
// of watching a button disappear.
//
// Slots are fixed and never reorder between streets, so muscle memory holds.
export function ActionBar({
  legalActions,
  callAmount,
  stack,
  currentBet,
  minimumRaiseTo,
  maximumRaiseTo,
  isViewerTurn,
  waitingLabel,
  onAction,
  onOpenRaiseSheet
}: {
  legalActions: LegalAction[];
  callAmount: number;
  stack: number;
  currentBet: number;
  minimumRaiseTo: number;
  maximumRaiseTo: number;
  isViewerTurn: boolean;
  waitingLabel: string;
  onAction: (action: PlayerActionPayload["action"], raiseTo?: number) => void;
  onOpenRaiseSheet: () => void;
}) {
  const canRaise = legalActions.includes("raise") && maximumRaiseTo >= minimumRaiseTo;

  const slots: ActionSlot[] = [
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
    return (
      <div aria-live="polite" className="action-bar action-bar--waiting" aria-label="Player actions">
        <p className="action-bar__waiting">{waitingLabel}</p>
      </div>
    );
  }

  return (
    <div className="action-bar" aria-label="Player actions">
      {slots.map((slot) => {
        const enabled = legalActions.includes(slot.action);

        return (
          <button
            className={`action ${slot.action === "call" || slot.action === "check" ? "action--primary" : ""}`}
            disabled={!enabled}
            key={slot.action}
            onClick={() => onAction(slot.action)}
            type="button"
          >
            <span className="action__label">{slot.label}</span>
            <span className="action__note">{enabled ? slot.consequence : slot.reason}</span>
          </button>
        );
      })}
      <button className="action action--raise" disabled={!canRaise} onClick={onOpenRaiseSheet} type="button">
        <span className="action__label">Raise</span>
        <span className="action__note">
          {canRaise ? `min ${money(minimumRaiseTo - currentBet)} more` : "no raise available"}
        </span>
      </button>
    </div>
  );
}
