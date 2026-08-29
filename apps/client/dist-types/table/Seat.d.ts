import type { TableSnapshot } from "@friendly-holdem/shared";
type SeatSnapshot = TableSnapshot["seats"][number];
export declare function Seat({ seat, angle, isViewer, viewerHoleCards, handName }: {
    seat: SeatSnapshot;
    angle: number;
    isViewer: boolean;
    viewerHoleCards?: TableSnapshot["hand"]["viewerHoleCards"];
    handName?: string | null;
}): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=Seat.d.ts.map