export declare const DENOMINATIONS: readonly [500, 100, 25, 5, 1];
export type ChipRun = {
    denomination: (typeof DENOMINATIONS)[number];
    count: number;
};
export declare function chipRuns(amount: number, maxChips?: number): ChipRun[];
//# sourceMappingURL=chips.d.ts.map