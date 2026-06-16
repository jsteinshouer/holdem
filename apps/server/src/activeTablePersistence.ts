import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { Logger } from "./logger.js";
import type { SerializedActiveTableState } from "./tableStore.js";

export const ACTIVE_TABLE_SCHEMA_VERSION = 1;

export type ActiveTablePersistenceMode = "memory" | "sqlite";

export type ActiveTablePersistenceRecord = {
  tableId: string;
  schemaVersion: number;
  lastActivityAt: number;
  updatedAt: number;
  state: SerializedActiveTableState;
};

export type ActiveTablePersistencePort = {
  loadActiveTables(nowMs: number): ActiveTablePersistenceRecord[];
  saveTable(record: ActiveTablePersistenceRecord): void;
  deleteExpiredTables(nowMs: number): string[];
  quarantineTable(tableId: string, reason: string): void;
};

export type ActiveTablePersistenceConfig = {
  mode: ActiveTablePersistenceMode;
  sqlitePath: string;
  inactivityTtlMs: number;
};

export function createActiveTablePersistence(
  config: ActiveTablePersistenceConfig,
  logger: Logger
): ActiveTablePersistencePort | null {
  if (config.mode === "memory") {
    return null;
  }

  return createSqliteActiveTablePersistence(config.sqlitePath, config.inactivityTtlMs, logger);
}

export function createSqliteActiveTablePersistence(
  sqlitePath: string,
  inactivityTtlMs: number,
  logger: Logger
): ActiveTablePersistencePort {
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
  const databasePath = resolve(sqlitePath);
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);

  database.exec(`
    CREATE TABLE IF NOT EXISTS active_tables (
      table_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      state_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quarantined_active_tables (
      table_id TEXT PRIMARY KEY,
      schema_version INTEGER,
      last_activity_at INTEGER,
      updated_at INTEGER,
      state_json TEXT,
      quarantined_at INTEGER NOT NULL,
      reason TEXT NOT NULL
    );
  `);

  const selectActiveTables = database.prepare(
    "SELECT table_id, schema_version, last_activity_at, updated_at, state_json FROM active_tables"
  );
  const saveActiveTable = database.prepare(`
    INSERT INTO active_tables (table_id, schema_version, last_activity_at, updated_at, state_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(table_id) DO UPDATE SET
      schema_version = excluded.schema_version,
      last_activity_at = excluded.last_activity_at,
      updated_at = excluded.updated_at,
      state_json = excluded.state_json
  `);
  const deleteActiveTable = database.prepare("DELETE FROM active_tables WHERE table_id = ?");
  const selectExpiredTables = database.prepare("SELECT table_id FROM active_tables WHERE last_activity_at < ?");
  const moveToQuarantine = database.prepare(`
    INSERT INTO quarantined_active_tables (
      table_id,
      schema_version,
      last_activity_at,
      updated_at,
      state_json,
      quarantined_at,
      reason
    )
    SELECT table_id, schema_version, last_activity_at, updated_at, state_json, ?, ?
    FROM active_tables
    WHERE table_id = ?
    ON CONFLICT(table_id) DO UPDATE SET
      schema_version = excluded.schema_version,
      last_activity_at = excluded.last_activity_at,
      updated_at = excluded.updated_at,
      state_json = excluded.state_json,
      quarantined_at = excluded.quarantined_at,
      reason = excluded.reason
  `);

  return {
    loadActiveTables(nowMs) {
      void nowMs;
      const records: ActiveTablePersistenceRecord[] = [];

      for (const row of selectActiveTables.all() as SqliteActiveTableRow[]) {
        try {
          const state = JSON.parse(row.state_json) as SerializedActiveTableState;
          records.push({
            tableId: row.table_id,
            schemaVersion: row.schema_version,
            lastActivityAt: row.last_activity_at,
            updatedAt: row.updated_at,
            state
          });
        } catch {
          this.quarantineTable(row.table_id, "corrupt serialized active table state");
        }
      }

      return records;
    },
    saveTable(record) {
      saveActiveTable.run(
        record.tableId,
        record.schemaVersion,
        record.lastActivityAt,
        record.updatedAt,
        JSON.stringify(record.state)
      );
    },
    deleteExpiredTables(nowMs) {
      const cutoff = nowMs - inactivityTtlMs;
      const expiredRows = selectExpiredTables.all(cutoff) as { table_id: string }[];

      for (const row of expiredRows) {
        deleteActiveTable.run(row.table_id);
      }

      return expiredRows.map((row) => row.table_id);
    },
    quarantineTable(tableId, reason) {
      moveToQuarantine.run(Date.now(), reason, tableId);
      deleteActiveTable.run(tableId);
      logger.error("active table persistence record quarantined", {
        tableId,
        reason
      });
    }
  };
}

type SqliteActiveTableRow = {
  table_id: string;
  schema_version: number;
  last_activity_at: number;
  updated_at: number;
  state_json: string;
};
