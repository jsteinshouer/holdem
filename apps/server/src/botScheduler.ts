import { hasConnectedHuman, type PrivateTable, type TableStore } from "./tableStore.js";
import type { TableSessionResponse } from "@friendly-holdem/shared";

// Server-side bot-turn scheduler. When the current actor is a bot it applies the
// bot's chosen action after a short randomized delay (about 0.5 to 2 seconds) so
// humans can follow the table. The scheduler is dependency-injected so its delay
// bounds, clear-before-rearm behavior, and startup re-arm are unit-testable with
// fake timers.

export const BOT_ACTION_MIN_DELAY_MS = 500;
export const BOT_ACTION_MAX_DELAY_MS = 2000;

export function computeBotActionDelay(random: () => number): number {
  const delayRange = BOT_ACTION_MAX_DELAY_MS - BOT_ACTION_MIN_DELAY_MS;

  return BOT_ACTION_MIN_DELAY_MS + Math.floor(random() * (delayRange + 1));
}

export type BotSchedulerDeps = {
  store: Pick<TableStore, "getTable" | "botActionForCurrentActor" | "getTableIds">;
  // Applied after a bot acts, e.g. to broadcast the new snapshot.
  onBotActed?: (tableId: string, response: TableSessionResponse) => void;
  random?: () => number;
  setTimer?: (handler: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

export type BotScheduler = {
  schedule(tableId: string): void;
  rearmRestoredTables(): void;
};

export function createBotActionScheduler(deps: BotSchedulerDeps): BotScheduler {
  const {
    store,
    onBotActed,
    random = Math.random,
    setTimer = setTimeout,
    clearTimer = clearTimeout
  } = deps;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function clearExisting(tableId: string): void {
    const existingTimer = timers.get(tableId);

    if (existingTimer) {
      clearTimer(existingTimer);
      timers.delete(tableId);
    }
  }

  function schedule(tableId: string): void {
    // Always clear any pending timer before re-arming so a table never has two
    // bot turns queued at once (no double-fire).
    clearExisting(tableId);

    const table = store.getTable(tableId);
    const hand = table?.hand;

    if (!table || !hand || hand.phase === "settled" || hand.currentActorSeat === null) {
      return;
    }

    const actor = currentActor(table, hand.currentActorSeat);

    // Bots act only while a human is present, so an abandoned table stays paused.
    if (!actor || !actor.isBot || !hasConnectedHuman(table)) {
      return;
    }

    const delayMs = computeBotActionDelay(random);
    const timer = setTimer(() => {
      timers.delete(tableId);
      const response = store.botActionForCurrentActor(tableId);

      if (response) {
        // The caller re-arms the scheduler (including the next bot turn) so the
        // bot and disconnected-action timers stay in sync.
        onBotActed?.(tableId, response);
      }
    }, delayMs);

    timers.set(tableId, timer);
  }

  function rearmRestoredTables(): void {
    for (const tableId of store.getTableIds()) {
      schedule(tableId);
    }
  }

  return { schedule, rearmRestoredTables };
}

function currentActor(table: PrivateTable, currentActorSeat: number) {
  return [...table.participants.values()].find((participant) => participant.seatNumber === currentActorSeat);
}
