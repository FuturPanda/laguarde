type SqlValue = string | number | bigint | Uint8Array | null;

interface NativeStatement {
  get(...params: SqlValue[]): unknown;
  all(...params: SqlValue[]): unknown[];
  run(...params: SqlValue[]): { changes: number | bigint };
}

interface NativeDatabase {
  close(): void;
  exec(sql: string): void;
  prepare?(sql: string): NativeStatement;
  query?(sql: string): NativeStatement;
}

interface NativeDatabaseConstructor {
  new (path: string, options?: Record<string, unknown>): NativeDatabase;
}

const isBun = Boolean(process.versions.bun);
const NativeDatabase = isBun
  ? ((await import("bun:sqlite")).Database as NativeDatabaseConstructor)
  : ((await import("node:sqlite")).DatabaseSync as NativeDatabaseConstructor);

class Statement<Row, Params extends SqlValue[]> {
  constructor(private readonly statement: NativeStatement) {}

  get(...params: Params): Row | null {
    return (this.statement.get(...params) as Row | undefined) ?? null;
  }

  all(...params: Params): Row[] {
    return this.statement.all(...params) as Row[];
  }

  run(...params: Params): { changes: number } {
    const result = this.statement.run(...params);
    return { changes: Number(result.changes) };
  }
}

export class Database {
  private readonly native: NativeDatabase;
  private transactionDepth = 0;

  constructor(path: string) {
    this.native = isBun
      ? new NativeDatabase(path, { create: true })
      : new NativeDatabase(path);
  }

  close(): void {
    this.native.close();
  }

  exec(sql: string): void {
    this.native.exec(sql);
  }

  query<Row = unknown, Params extends SqlValue[] = SqlValue[]>(
    sql: string,
  ): Statement<Row, Params> {
    const statement = this.native.query?.(sql) ?? this.native.prepare?.(sql);
    if (!statement) {
      throw new Error("The active SQLite runtime cannot prepare statements");
    }
    return new Statement<Row, Params>(statement);
  }

  transaction<T>(operation: () => T): () => T {
    return () => {
      if (this.transactionDepth > 0) return operation();

      this.native.exec("BEGIN IMMEDIATE");
      this.transactionDepth += 1;
      try {
        const result = operation();
        this.native.exec("COMMIT");
        return result;
      } catch (error) {
        this.native.exec("ROLLBACK");
        throw error;
      } finally {
        this.transactionDepth -= 1;
      }
    };
  }
}
