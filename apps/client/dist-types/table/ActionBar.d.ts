import type { LegalAction, PlayerActionPayload } from "@friendly-holdem/shared";
export declare function ActionBar({ legalActions, callAmount, stack, currentBet, minimumRaiseTo, maximumRaiseTo, isViewerTurn, waitingLabel, onAction, onOpenRaiseSheet }: {
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
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ActionBar.d.ts.map