import { useEffect, useRef } from "react";
import { raisePresets } from "../tableView";
import { money } from "../lib/format";
import { CloseIcon } from "../icons";

// Raising is the one action that needs a protected, focused moment: it takes an
// amount, and getting it wrong costs the hand. Every other action commits from
// the bar without interruption.
export function RaiseSheet({
  callAmount,
  currentBet,
  isRaiseToValid,
  maximumRaiseTo,
  minimumRaiseTo,
  pot,
  raiseTo,
  stack,
  onCancel,
  onRaiseToChange,
  onSubmit
}: {
  callAmount: number;
  currentBet: number;
  isRaiseToValid: boolean;
  maximumRaiseTo: number;
  minimumRaiseTo: number;
  pot: number;
  raiseTo: string;
  stack: number;
  onCancel: () => void;
  onRaiseToChange: (raiseTo: string) => void;
  onSubmit: () => void;
}) {
  const panelRef = useRef<HTMLFormElement>(null);
  const presets = raisePresets({ minimumRaiseTo, maximumRaiseTo, currentBet, pot, callAmount });
  const parsed = Number(raiseTo);
  const leftBehind = Number.isFinite(parsed) ? Math.max(0, stack + currentBet - parsed) : stack;

  useEffect(() => {
    panelRef.current?.querySelector<HTMLInputElement>("#raise-sheet-amount")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="raise-sheet-title">
      <form
        className="sheet__panel"
        ref={panelRef}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <header className="sheet__head">
          <h2 id="raise-sheet-title">Raise</h2>
          <button aria-label="Cancel" className="icon-button" onClick={onCancel} type="button">
            <CloseIcon />
          </button>
        </header>

        <dl className="metrics metrics--sheet" aria-label="Raise context">
          <div>
            <dt>Stack</dt>
            <dd>{money(stack)}</dd>
          </div>
          <div>
            <dt>Pot</dt>
            <dd>{money(pot)}</dd>
          </div>
          <div>
            <dt>To call</dt>
            <dd>{money(callAmount)}</dd>
          </div>
          <div>
            <dt>Min raise to</dt>
            <dd>{money(minimumRaiseTo)}</dd>
          </div>
        </dl>

        <div className="presets" aria-label="Preset raise choices">
          {presets.map((preset) => (
            <button
              className={Number(raiseTo) === preset.value ? "preset preset--active" : "preset"}
              disabled={preset.value < minimumRaiseTo || preset.value > maximumRaiseTo}
              key={preset.label}
              onClick={() => onRaiseToChange(String(preset.value))}
              type="button"
            >
              <span>{preset.label}</span>
              <strong>{money(preset.value)}</strong>
            </button>
          ))}
        </div>

        <label className="field" htmlFor="raise-sheet-amount">
          <span>Exact raise to</span>
          <input
            id="raise-sheet-amount"
            inputMode="numeric"
            max={maximumRaiseTo}
            min={minimumRaiseTo}
            step={1}
            type="number"
            value={raiseTo}
            onChange={(event) => onRaiseToChange(event.target.value)}
          />
        </label>

        <p className="sheet__hint">
          Allowed {money(minimumRaiseTo)} to {money(maximumRaiseTo)}.{" "}
          {isRaiseToValid ? `Leaves you ${money(leftBehind)}.` : "Enter an amount inside the range."}
        </p>

        <button className="action action--primary action--wide" disabled={!isRaiseToValid} type="submit">
          <span className="action__label">Raise to {money(Number(raiseTo) || minimumRaiseTo)}</span>
          <span className="action__note">{money(leftBehind)} left</span>
        </button>
      </form>
    </div>
  );
}
