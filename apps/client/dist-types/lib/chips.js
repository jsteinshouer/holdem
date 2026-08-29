// Card-room chip denominations. Colour encodes value here, which is why these
// tones live apart from every UI state token and are never borrowed for chrome.
export const DENOMINATIONS = [500, 100, 25, 5, 1];
// Breaks an amount into a chip run, largest denomination first. `maxChips` caps
// how many discs are drawn so a five-figure stack does not become a bar chart;
// the figure beside the stack always carries the exact amount.
export function chipRuns(amount, maxChips = 4) {
    let remaining = Math.max(0, Math.round(amount));
    const runs = [];
    for (const denomination of DENOMINATIONS) {
        if (remaining < denomination) {
            continue;
        }
        const count = Math.floor(remaining / denomination);
        remaining -= count * denomination;
        runs.push({ denomination, count });
    }
    return runs.slice(0, maxChips);
}
