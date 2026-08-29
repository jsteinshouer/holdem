import type { TableSnapshot } from "@friendly-holdem/shared";
export type RailTab = "log" | "chat" | "players" | "manage";
export declare function Rail({ activeTab, chatDraft, canHostAutoFoldInactive, inviteLink, snapshot, unreadChatCount, onChatDraftChange, onOpenTutorial, onSubmitChat, onTabChange, onTableCommand }: {
    activeTab: RailTab;
    chatDraft: string;
    canHostAutoFoldInactive: boolean;
    inviteLink: string;
    snapshot: TableSnapshot;
    unreadChatCount: number;
    onChatDraftChange: (value: string) => void;
    onOpenTutorial: (kind: "beginner" | "host") => void;
    onSubmitChat: () => void;
    onTabChange: (tab: RailTab) => void;
    onTableCommand: <TPayload>(eventName: string, payload: TPayload, fallbackMessage: string) => void;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Rail.d.ts.map