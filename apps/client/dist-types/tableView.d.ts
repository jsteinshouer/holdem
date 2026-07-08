export type ConnectionState = "connecting" | "connected" | "offline";
export type RaiseViewer = {
    currentBet: number;
    stack: number;
};
export declare function raiseBounds(params: {
    currentBet: number;
    bigBlind: number;
    viewer: RaiseViewer | null | undefined;
}): {
    minimumRaiseTo: number;
    maximumRaiseTo: number;
};
export declare function isRaiseAmountInRange(amount: number, minimumRaiseTo: number, maximumRaiseTo: number): boolean;
export declare function raisePresets(params: {
    minimumRaiseTo: number;
    maximumRaiseTo: number;
    currentBet: number;
    pot: number;
    callAmount: number;
}): {
    label: string;
    value: number;
}[];
export declare function connectionStatusLabel(state: ConnectionState): string;
export declare function isCommandInputDisabled(hasSocket: boolean, state: ConnectionState): boolean;
//# sourceMappingURL=tableView.d.ts.map