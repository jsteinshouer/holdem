// Pure view-model helpers extracted from the table UI so the branchy raise and
// connection logic can be unit-tested without rendering React or a live socket.
// The lowest legal total bet the viewer may raise to, and the highest (a shove).
export function raiseBounds(params) {
    const minimumRaiseTo = params.currentBet + params.bigBlind;
    const maximumRaiseTo = params.viewer ? params.viewer.currentBet + params.viewer.stack : minimumRaiseTo;
    return { minimumRaiseTo, maximumRaiseTo };
}
// A raise-to amount must be a whole number within the allowed range. Rejects
// NaN (empty/non-numeric input) and fractional amounts via Number.isInteger.
export function isRaiseAmountInRange(amount, minimumRaiseTo, maximumRaiseTo) {
    return Number.isInteger(amount) && amount >= minimumRaiseTo && amount <= maximumRaiseTo;
}
export function raisePresets(params) {
    const { minimumRaiseTo, maximumRaiseTo, currentBet, pot, callAmount } = params;
    return [
        { label: "Min", value: minimumRaiseTo },
        { label: "Pot", value: Math.min(maximumRaiseTo, Math.max(minimumRaiseTo, currentBet + pot + callAmount)) },
        { label: "All-in", value: maximumRaiseTo }
    ];
}
export function connectionStatusLabel(state) {
    return state === "connected" ? "Online" : state;
}
// Table commands may only be sent over a live, connected socket.
export function isCommandInputDisabled(hasSocket, state) {
    return !hasSocket || state !== "connected";
}
