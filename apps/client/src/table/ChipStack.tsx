import { chipRuns } from "../lib/chips";
import { money } from "../lib/format";

// Chips render flat: solid denomination fill, a darker hairline, and a dashed
// inner ring standing in for edge spots. No gradients, no rendered highlights.
// The figure beside the stack is the authority; the discs are the encoding.
export function ChipStack({ amount, label }: { amount: number; label?: string }) {
  if (amount <= 0) {
    return null;
  }

  const runs = chipRuns(amount);

  return (
    <span className="chips">
      <span aria-hidden="true" className="chips__discs">
        {runs.map((run) => (
          <span className={`chip chip--${run.denomination}`} key={run.denomination}>
            {run.count > 1 ? <em>{run.count}</em> : null}
          </span>
        ))}
      </span>
      <span className="chips__amount">{money(amount)}</span>
      {label ? <span className="chips__label">{label}</span> : null}
    </span>
  );
}
