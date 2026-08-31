import type { PlayerActionPayload, TableSnapshot } from "@friendly-holdem/shared";
export declare function TableRoom({ error, inviteLink, snapshot, onPlayerAction, onSendChatMessage, onStartHand, onTableCommand }: {
    error: string | null;
    inviteLink: string;
    snapshot: TableSnapshot;
    onPlayerAction: (action: PlayerActionPayload["action"], raiseTo?: number) => void;
    onSendChatMessage: (body: string) => void;
    onStartHand: () => void;
    onTableCommand: <TPayload>(eventName: string, payload: TPayload, fallbackMessage: string) => void;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=TableRoom.d.ts.map