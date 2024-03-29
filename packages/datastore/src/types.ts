import {ColumnType, Generated, Insertable, Selectable} from 'kysely';

export interface Database {
  queue: QueueTable;
  registry: RegistryTable;
  runs: RunsTable;
}

export type Action = 'create' | 'update' | 'delete';

export interface QueueTable {
  iri: string;
  action: ColumnType<Action, Action | undefined, Action | undefined>;
  type: ColumnType<string, string | undefined, string | undefined>;
  retry_count: ColumnType<number, number | undefined, number>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export type QueueItem = Selectable<QueueTable>;
export type NewQueueItem = Insertable<QueueTable>;

export interface RegistryTable {
  iri: string;
  type: ColumnType<string, string | undefined, string | undefined>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export type RegistryItem = Selectable<RegistryTable>;
export type NewRegistryItem = Insertable<RegistryTable>;

export interface RunsTable {
  id: Generated<number>;
  identifier: ColumnType<string, string | undefined, string | undefined>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export type RunItem = Selectable<RunsTable>;
export type NewRunItem = Insertable<RunsTable>;
