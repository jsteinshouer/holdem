import type { TableSnapshot } from "@friendly-holdem/shared";
export type RailTab = "log" | "chat" | "players" | "manage";
export declare const TAB_LABELS: Record<RailTab, string>;
export declare function Rail({ activeTab, isOpen, onClose, chatDraft, canHostAutoFoldInactive, inviteLink, snapshot, onChatDraftChange, onOpenTutorial, onSubmitChat, onTableCommand }: {
    activeTab: RailTab;
    isOpen: boolean;
    onClose: () => void;
    chatDraft: string;
    canHostAutoFoldInactive: boolean;
    inviteLink: string;
    snapshot: TableSnapshot;
    onChatDraftChange: (value: string) => void;
    onOpenTutorial: (kind: "beginner" | "host") => void;
    onSubmitChat: () => void;
    onTableCommand: <TPayload>(eventName: string, payload: TPayload, fallbackMessage: string) => void;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Rail.d.ts.map