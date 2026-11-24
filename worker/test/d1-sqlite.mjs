// Une base D1 de poche pour les tests, sur node:sqlite (Node 22+).
//
// Juste ce que le worker emploie : prepare().bind().first()/all()/run(), et
// batch() — execute comme D1 le fait, dans une transaction : tout ou rien.
import { DatabaseSync } from 'node:sqlite';

export function baseD1() {
  const sqlite = new DatabaseSync(':memory:');
  const preparer = (sql, args = []) => ({
    sql, args,
    bind: (...a) => preparer(sql, a),
    first: async () => {
      const r = sqlite.prepare(sql).get(...args);
      return r === undefined ? null : { ...r };
    },
    all: async () => ({ results: sqlite.prepare(sql).all(...args).map(r => ({ ...r })) }),
    run: async () => {
      const r = sqlite.prepare(sql).run(...args);
      return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return {
    sqlite,
    prepare: (sql) => preparer(sql),
    batch: async (ops) => {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const o of ops) out.push(await o.run());
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
    exec: async (sql) => sqlite.exec(sql),
  };
}
