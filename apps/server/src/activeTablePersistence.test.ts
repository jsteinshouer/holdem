import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Logger } from "./logger.js";
import {
  createActiveTablePersistence,
  createSqliteActiveTablePersistence,
  type ActiveTablePersistencePort,
  type ActiveTablePersistenceRecord
} from "./activeTablePersistence.js";
import { createTableStore } from "./tableStore.js";

const defaults = {
  startingStack: 1000,
  blinds: {
    smallBlind: 5,
    bigBlind: 10
  },
  disconnectedActionGraceMs: 30000,
  hostAutoFoldAfterMs: 120000,
  eventLogCap: 200
};

describe("SQLite active table persistence", () => {
  it("stores one restorable active table record per table", () => {
    const logger = createTestLogger();
    const persistence = createSqliteActiveTablePersistence(testDatabasePath(), 60000, logger);
    const store = createTableStore(defaults, undefined, () => 1000, persistence);
    const host = store.createTable("Host");

    store.joinTable(host.snapshot.tableId, "Grace");
    store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);

    const restored = createTableStore(defaults, undefined, () => 1000, persistence);

    expect(restored.getTableIds()).toEqual([host.snapshot.tableId]);
    expect(restored.snapshotFor(host.snapshot.tableId, host.snapshot.viewerParticipantId).hand.phase).toBe("preflop");
  });

  it("expires active tables by last successful table-changing command time", () => {
    const persistence = createSqliteActiveTablePersistence(testDatabasePath(), 1000, createTestLogger());
    const store = createTableStore(defaults, undefined, () => 1000, persistence);
    const host = store.createTable("Host");

    expect(persistence.deleteExpiredTables(1999)).toEqual([]);
    expect(persistence.deleteExpiredTables(2001)).toEqual([host.snapshot.tableId]);
    expect(createTableStore(defaults, undefined, () => 2001, persistence).getTableIds()).toEqual([]);
  });

  it("quarantines corrupt records without exposing sensitive state in logs", () => {
    const databasePath = testDatabasePath();
    const logger = createTestLogger();
    const persistence = createSqliteActiveTablePersistence(databasePath, 60000, logger);
    const database = new DatabaseSync(databasePath);

    database
      .prepare(
        "INSERT INTO active_tables (table_id, schema_version, last_activity_at, updated_at, state_json) VALUES (?, ?, ?, ?, ?)"
      )
      .run("bad-table", 1, 1000, 1000, "{not-json-with-session-token-secret");

    expect(persistence.loadActiveTables(1000)).toEqual([]);
    expect(logger.entries).toEqual([
      {
        level: "error",
        message: "active table persistence record quarantined",
        context: {
          tableId: "bad-table",
          reason: "corrupt serialized active table state"
        }
      }
    ]);
    expect(JSON.stringify(logger.entries)).not.toContain("session-token-secret");
    expect(
      database.prepare("SELECT table_id FROM quarantined_active_tables WHERE table_id = ?").all("bad-table")
    ).toHaveLength(1);
  });
});

describe("active table persistence factory", () => {
  it("returns null in memory mode so the store stays purely in memory", () => {
    const port = createActiveTablePersistence(
      { mode: "memory", sqlitePath: testDatabasePath(), inactivityTtlMs: 60000 },
      createTestLogger()
    );

    expect(port).toBeNull();
  });

  it("returns a SQLite-backed port in sqlite mode", () => {
    const port = createActiveTablePersistence(
      { mode: "sqlite", sqlitePath: testDatabasePath(), inactivityTtlMs: 60000 },
      createTestLogger()
    );

    expect(port).not.toBeNull();
    expect(port?.loadActiveTables(1000)).toEqual([]);
  });
});

describe("active table restore quarantine", () => {
  it("quarantines a restored record whose schema version is unsupported", () => {
    const record = captureSavedRecord();
    const target = createCapturingPersistence([{ ...record, schemaVersion: 999 }]);

    const restored = createTableStore(defaults, undefined, () => 1000, target);

    expect(restored.getTableIds()).toEqual([]);
    expect(target.quarantined).toEqual([
      { tableId: record.tableId, reason: "unsupported active table persistence schema version" }
    ]);
  });

  it("quarantines a restored record whose table id does not match its state", () => {
    const record = captureSavedRecord();
    const target = createCapturingPersistence([{ ...record, tableId: "mismatched-id" }]);

    const restored = createTableStore(defaults, undefined, () => 1000, target);

    expect(restored.getTableIds()).toEqual([]);
    expect(target.quarantined).toEqual([
      { tableId: "mismatched-id", reason: "unsupported active table persistence schema version" }
    ]);
  });

  it("quarantines a restored record that fails to deserialize", () => {
    const record = captureSavedRecord();
    const corrupt: ActiveTablePersistenceRecord = {
      ...record,
      state: { ...record.state, table: { ...record.state.table, hostId: "missing-host" } }
    };
    const target = createCapturingPersistence([corrupt]);

    const restored = createTableStore(defaults, undefined, () => 1000, target);

    expect(restored.getTableIds()).toEqual([]);
    expect(target.quarantined).toEqual([
      { tableId: record.tableId, reason: "persisted active table host was not found" }
    ]);
  });
});

type CapturingPersistence = ActiveTablePersistencePort & {
  saved: ActiveTablePersistenceRecord[];
  quarantined: { tableId: string; reason: string }[];
};

function createCapturingPersistence(initial: ActiveTablePersistenceRecord[] = []): CapturingPersistence {
  const saved: ActiveTablePersistenceRecord[] = [];
  const quarantined: { tableId: string; reason: string }[] = [];

  return {
    saved,
    quarantined,
    loadActiveTables: () => initial,
    saveTable: (record) => {
      saved.push(record);
    },
    deleteExpiredTables: () => [],
    quarantineTable: (tableId, reason) => {
      quarantined.push({ tableId, reason });
    }
  };
}

// Runs a real store against a capturing port to obtain a genuine serialized
// active-table record, then hands it back so tests can corrupt one field.
function captureSavedRecord(): ActiveTablePersistenceRecord {
  const source = createCapturingPersistence();
  const store = createTableStore(defaults, undefined, () => 1000, source);
  const host = store.createTable("Host");

  store.joinTable(host.snapshot.tableId, "Grace");
  store.startHand(host.snapshot.tableId, host.snapshot.viewerParticipantId);

  const record = source.saved.at(-1);
  if (!record) {
    throw new Error("expected the store to persist an active table record");
  }

  return record;
}

function testDatabasePath(): string {
  return join(mkdtempSync(join(tmpdir(), "friendly-holdem-test-")), "active-tables.sqlite");
}

function createTestLogger(): Logger & {
  entries: { level: "info" | "warn" | "error"; message: string; context: unknown }[];
} {
  const entries: { level: "info" | "warn" | "error"; message: string; context: unknown }[] = [];

  return {
    entries,
    info(message, context) {
      entries.push({ level: "info", message, context });
    },
    warn(message, context) {
      entries.push({ level: "warn", message, context });
    },
    error(message, context) {
      entries.push({ level: "error", message, context });
    }
  };
}
