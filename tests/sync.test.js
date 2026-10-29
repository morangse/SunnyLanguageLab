import test from "node:test";
import assert from "node:assert/strict";
import { database, device, localStorage, record, TOKEN } from "./helpers.js";
import { createVocabStore, STATE_KEY, BACKUP_KEY } from "../extension/src/background/vocab-store.js";
import { createSyncClient } from "../extension/src/background/sync.js";
import { synchronize } from "../server/src/index.js";
import worker from "../server/src/index.js";
import { workerEndpoint } from "../extension/src/shared/sync-model.js";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

test("v0.4 migration keeps original backup, UI data and pending uploads across restarts", async () => {
  const legacy = [{ text: "Hello", lang: "en-US", meaning: "你好", savedAt: 1700000000000 }];
  const storage = localStorage({ vocab: legacy });
  const store = createVocabStore(storage, () => A);
  assert.equal((await store.list())[0].id, "en|hello");
  assert.deepEqual(storage.values[BACKUP_KEY].items, legacy);
  await store.toggle({ text: "world", lang: "en" });
  const restarted = createVocabStore(storage, () => B);
  assert.equal((await restarted.list()).length, 2);
  assert.equal(storage.values[STATE_KEY].deviceId, A);
  assert.equal(storage.values[STATE_KEY].records.filter(r => r.pending).length, 2);
  assert.deepEqual(storage.values[BACKUP_KEY].items, legacy);
});

test("simultaneous local saves are serialized and never overwrite one another", async () => {
  const storage = localStorage();
  const store = createVocabStore(storage, () => A);
  await Promise.all(Array.from({ length: 50 }, (_, i) => store.toggle({ text: "word" + i, lang: "en" })));
  assert.equal((await store.list()).length, 50);
  assert.equal(new Set(storage.values[STATE_KEY].records.map(r => r.clock)).size, 50);
});

test("offline save survives failure and syncs to another device after reconnect", async () => {
  const db = database();
  try {
    const a = device(db, A), b = device(db, B);
    await a.connect(); await b.connect();
    a.setOnline(false);
    await a.store.toggle({ text: "resilient", lang: "en", meaning: "有韧性的" });
    await a.client.run();
    assert.equal((await a.client.status()).pending, 1);
    assert.match((await a.client.status()).error, /本机/);
    a.setOnline(true);
    await a.client.run(); await b.client.run();
    assert.equal((await b.store.list())[0].text, "resilient");
    assert.equal((await a.client.status()).pending, 0);
    assert.equal((await a.client.status()).error, "");
  } finally { db.close(); }
});

test("deletion tombstones survive stale device replay; intentional re-save restores a word", async () => {
  const db = database();
  try {
    const a = device(db, A), b = device(db, B);
    await a.connect(); await b.connect();
    await a.store.toggle({ text: "hello", lang: "en" }); await a.client.run(); await b.client.run();
    const stale = structuredClone(b.storage.values[STATE_KEY].records[0]);
    await a.store.remove("en|hello"); await a.client.run();
    await synchronize(db, { schema: 1, cursor: 0, records: [stale] });
    await b.client.run();
    assert.deepEqual(await b.store.list(), []);
    await b.store.toggle({ text: "hello", lang: "en" }); await b.client.run(); await a.client.run();
    assert.equal((await a.store.list()).length, 1);
  } finally { db.close(); }
});

test("same-word concurrent changes converge in either upload order", async () => {
  for (const reverse of [false, true]) {
    const db = database();
    try {
      const first = record("converge", 3, A, { meaning: "A" });
      const second = record("converge", 3, B, { meaning: "B" });
      for (const r of reverse ? [second, first] : [first, second]) await synchronize(db, { schema: 1, cursor: 0, records: [r] });
      const result = await synchronize(db, { schema: 1, cursor: 0, records: [] });
      assert.equal(result.records.length, 1);
      assert.equal(result.records[0].meaning, "B");
      assert.equal(result.records[0].deviceId, B);
    } finally { db.close(); }
  }
});

test("SQLite sequence advances on winning updates and rejected retries do not change the feed", async () => {
  const db = database();
  try {
    const initial = record("sequence");
    const first = await synchronize(db, { schema: 1, cursor: 0, records: [initial] });
    const duplicate = await synchronize(db, { schema: 1, cursor: first.cursor, records: [initial] });
    assert.equal(duplicate.cursor, first.cursor);
    assert.deepEqual(duplicate.records, []);
    const update = await synchronize(db, { schema: 1, cursor: first.cursor, records: [{ ...initial, clock: 2, deleted: true }] });
    assert.ok(update.cursor > first.cursor);
    assert.equal(update.records[0].deleted, true);
  } finally { db.close(); }
});

test("large initial upload and paginated download transfer 235 records without loss", async () => {
  const db = database();
  try {
    const a = device(db, A), b = device(db, B);
    await a.connect(); await b.connect();
    await a.store.restore(Array.from({ length: 235 }, (_, i) => ({ text: "term" + i, lang: "en", meaning: "释义" })));
    await a.client.run(); await b.client.run();
    assert.equal((await b.store.list()).length, 235);
    assert.equal((await a.client.status()).pending, 0);
    assert.equal((await b.client.status()).pending, 0);
  } finally { db.close(); }
});

test("an edit during upload is not cleared by acknowledgement of its earlier version", async () => {
  const db = database();
  try {
    const a = device(db, A); await a.connect();
    await a.store.toggle({ text: "race", lang: "en" });
    let first = true;
    const client = createSyncClient(a.store, async (url, options) => {
      const response = await a.fetcher(url, options);
      if (first) { first = false; await a.store.remove("en|race"); }
      return response;
    });
    await client.run();
    assert.equal((await client.status()).pending, 0);
    const cloud = await synchronize(db, { schema: 1, cursor: 0, records: [] });
    assert.equal(cloud.records[0].deleted, true);
  } finally { db.close(); }
});

test("disconnect during a request prevents its late response from changing local state", async () => {
  const db = database();
  try {
    const a = device(db, A); await a.connect();
    await a.store.toggle({ text: "pending", lang: "en" });
    const client = createSyncClient(a.store, async (url, options) => {
      const response = await a.fetcher(url, options);
      await a.client.disconnect();
      return response;
    });
    await client.run();
    const status = await a.client.status();
    assert.equal(status.pending, 1);
    assert.equal(status.enabled, false);
    assert.equal(status.hasToken, false);
    assert.ok(!JSON.stringify(status).includes(TOKEN));
    assert.ok(!JSON.stringify(await a.store.backup()).includes(TOKEN));
  } finally { db.close(); }
});

test("restored cloud DB triggers a full replay from the device's durable data", async () => {
  const db = database();
  try {
    const a = device(db, A); await a.connect();
    await a.store.toggle({ text: "recover", lang: "en" }); await a.client.run();
    db.sqlite.exec("DELETE FROM vocabulary");
    await a.client.run();
    const cloud = await synchronize(db, { schema: 1, cursor: 0, records: [] });
    assert.equal(cloud.records[0].text, "recover");
  } finally { db.close(); }
});

test("import is additive and invalid imports are atomic", async () => {
  const store = createVocabStore(localStorage(), () => A);
  await store.toggle({ text: "keep", lang: "en", meaning: "original" });
  const result = await store.restore({ records: [record("keep", 1, A, { meaning: "replacement" }), record("add"), record("removed", 2, A, { deleted: true })] });
  assert.equal(result.added, 1);
  assert.equal((await store.list()).find(r => r.text === "keep").meaning, "original");
  await assert.rejects(store.restore([{ text: "valid", lang: "en" }, { text: "", lang: "en" }]));
  assert.equal((await store.list()).length, 2);
});

test("personal endpoints reject non-HTTPS, redirects, credentials and lookalike hosts", () => {
  assert.equal(workerEndpoint("https://sunny.user.workers.dev/"), "https://sunny.user.workers.dev");
  for (const url of ["http://sunny.workers.dev", "https://workers.dev.attacker.com", "https://a:b@sunny.workers.dev", "https://sunny.workers.dev/?token=x", "https://sunny.workers.dev/path"]) {
    assert.throws(() => workerEndpoint(url));
  }
});

test("HTTP requires auth and validates whole batches before writes", async () => {
  const db = database();
  const env = { DB: db, SYNC_TOKEN: TOKEN };
  try {
    assert.equal((await worker.fetch(new Request("https://sync.workers.dev/health"), env)).status, 200);
    assert.equal((await worker.fetch(new Request("https://sync.workers.dev/v1/sync", { method: "POST" }), env)).status, 401);
    const post = body => worker.fetch(new Request("https://sync.workers.dev/v1/sync", { method: "POST", headers: {
      Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) }), env);
    assert.equal((await post({ schema: 1, cursor: 0, records: [record("valid"), { ...record("bad"), clock: -1 }] })).status, 400);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM vocabulary").get().n, 0);
    assert.equal((await post({ schema: 1, cursor: 0, records: [record("hello")] })).status, 200);
    const huge = new Request("https://sync.workers.dev/v1/sync", { method: "POST", headers: {
      Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: " ".repeat(1000001) });
    assert.equal((await worker.fetch(huge, env)).status, 413);
  } finally { db.close(); }
});
