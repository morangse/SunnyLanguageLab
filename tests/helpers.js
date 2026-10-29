import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../server/src/index.js";
import { createVocabStore } from "../extension/src/background/vocab-store.js";
import { createSyncClient } from "../extension/src/background/sync.js";

export const TOKEN = "test-personal-sync-token-00000000000000000000000";
export function localStorage(initial = {}) {
  const values = structuredClone(initial);
  return {
    values,
    async get(keys) {
      const selected = typeof keys === "string" ? [keys] : keys;
      return structuredClone(Object.fromEntries(selected.filter(k => Object.hasOwn(values, k)).map(k => [k, values[k]])));
    },
    async set(patch) { Object.assign(values, structuredClone(patch)); }
  };
}
export function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../server/migrations/0001_vocabulary.sql", import.meta.url), "utf8"));
  const db = {
    prepare(sql) {
      let params = [];
      const query = {
        bind(...values) { params = values; return query; },
        async first() { return sqlite.prepare(sql).get(...params) || null; },
        async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } }; },
        async all() { return { results: sqlite.prepare(sql).all(...params) }; }
      };
      return query;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
    withSession() { return db; },
    sqlite,
    close() { sqlite.close(); }
  };
  return db;
}
export function record(text, clock = 1, deviceId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", extra = {}) {
  return { id: "en|" + text.toLowerCase(), text, lang: "en", lemma: "", meaning: "释义", sentence: "A sentence.",
    sentenceNative: "原句翻译", title: "Video", site: "youtube", url: "https://www.youtube.com/watch?v=test", time: 10,
    savedAt: 1700000000000, clock, deviceId, deleted: false, ...extra };
}
export function device(db, id, initial = {}) {
  const storage = localStorage(initial);
  const store = createVocabStore(storage, () => id);
  const env = { DB: db, SYNC_TOKEN: TOKEN };
  let online = true;
  const fetcher = async (url, options) => {
    if (!online) throw new TypeError("offline");
    return worker.fetch(new Request(url, options), env);
  };
  const client = createSyncClient(store, fetcher);
  return { storage, store, client, env, fetcher, setOnline(value) { online = value; },
    connect: () => client.configure({ endpoint: "https://test.example.workers.dev", token: TOKEN }) };
}
