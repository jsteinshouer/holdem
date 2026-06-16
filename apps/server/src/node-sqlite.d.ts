declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export class StatementSync {
    all(...anonymousParameters: unknown[]): unknown[];
    run(...anonymousParameters: unknown[]): unknown;
  }
}
