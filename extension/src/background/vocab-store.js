import { SCHEMA, normalizeItem, validateRecord, compareVersion, activeItems, vocabId } from "../shared/sync-model.js";

export const STATE_KEY = "sunnyV05";
export const BACKUP_KEY = "sunnyV04Backup";

export function createVocabStore(storage, makeDeviceId = () => crypto.randomUUID()) {
  let chain = Promise.resolve();
  async function load() {
    const got = await storage.get([STATE_KEY, "vocab", BACKUP_KEY]);
    if (got[STATE_KEY]) {
      if (got[STATE_KEY].schema !== SCHEMA) throw new Error("生词数据版本较新，请更新插件");
      return got[STATE_KEY];
    }
    const state = {
      schema: SCHEMA, deviceId: makeDeviceId(), clock: 0, cursor: 0, records: [],
      config: { enabled: false, endpoint: "", token: "", generation: makeDeviceId() },
      lastSync: 0, lastError: "", archive: null
    };
    // Keep the exact v0.4 array before normalizing or adding sync metadata.
    const legacy = Array.isArray(got.vocab) ? got.vocab : [];
    if (legacy.length && !got[BACKUP_KEY]) {
      await storage.set({ [BACKUP_KEY]: { exportedAt: Date.now(), items: legacy } });
    }
    const records = new Map();
    for (const raw of legacy) {
      try {
        const item = normalizeItem(raw);
        records.set(item.id, { ...item, clock: ++state.clock, deviceId: state.deviceId, deleted: false, pending: true });
      } catch (_) { /* Invalid legacy entries remain recoverable in the untouched backup. */ }
    }
    state.records = [...records.values()];
    await persist(state);
    return state;
  }
  async function persist(state) {
    // One storage operation also updates the legacy view used by the existing UI.
    await storage.set({ [STATE_KEY]: state, vocab: activeItems(state.records) });
  }
  function transact(fn) {
    const next = chain.then(async () => {
      const state = await load();
      const result = await fn(state);
      await persist(state);
      return result;
    });
    chain = next.catch(() => {});
    return next;
  }
  function read(fn) {
    const next = chain.then(async () => fn(await load()));
    chain = next.catch(() => {});
    return next;
  }
  function revise(state, item, deleted) {
    if (state.clock >= 1e12) throw new Error("同步版本达到上限，请联系维护者");
    return { ...normalizeItem(item), clock: ++state.clock, deviceId: state.deviceId, deleted, pending: true };
  }
  return {
    transact, read,
    list: () => read(s => activeItems(s.records)),
    isSaved: (text, lang) => read(s => s.records.some(r => r.id === vocabId(text, lang) && !r.deleted)),
    toggle: raw => transact(s => {
      const item = normalizeItem(raw);
      const index = s.records.findIndex(r => r.id === item.id);
      const old = s.records[index];
      const deleted = !!old && !old.deleted;
      const updated = revise(s, deleted ? old : { ...item, savedAt: Date.now() }, deleted);
      if (index < 0) s.records.push(updated); else s.records[index] = updated;
      const items = activeItems(s.records);
      return { saved: !deleted, items, count: items.length };
    }),
    remove: (id, all = false) => transact(s => {
      s.records = s.records.map(r => !r.deleted && (all || r.id === id) ? revise(s, r, true) : r);
      const items = activeItems(s.records);
      return { items, count: items.length };
    }),
    restore: input => transact(s => {
      const items = Array.isArray(input) ? input : input && (input.records || input.items);
      if (!Array.isArray(items) || items.length > 20000) throw new Error("请选择有效的 Sunny JSON 备份（最多 20000 条）");
      // Validate the whole import before changing state. Restores only add missing active items.
      const normalized = items.filter(r => !r.deleted).map(normalizeItem);
      const existing = new Map(s.records.map(r => [r.id, r]));
      let added = 0;
      for (const item of normalized) {
        if (existing.has(item.id) && !existing.get(item.id).deleted) continue;
        existing.set(item.id, revise(s, item, false));
        added++;
      }
      s.records = [...existing.values()];
      return { added };
    }),
    backup: () => read(s => ({ app: "SunnyLanguageLab", schema: SCHEMA, exportedAt: new Date().toISOString(),
      records: s.records.map(validateRecord) })),
    legacyBackup: () => storage.get(BACKUP_KEY).then(got => got[BACKUP_KEY] || null),
    merge: (response, sent, generation) => transact(s => {
      if (s.config.generation !== generation) return false;
      const records = new Map(s.records.map(r => [r.id, r]));
      for (const raw of response.records) {
        const incoming = validateRecord(raw);
        const local = records.get(incoming.id);
        s.clock = Math.max(s.clock, incoming.clock);
        if (!local || compareVersion(incoming, local) > 0) records.set(incoming.id, { ...incoming, pending: false });
      }
      // Never acknowledge a newer local edit made while the network request was in flight.
      for (const ack of sent) {
        const local = records.get(ack.id);
        if (local && compareVersion(local, ack) === 0) local.pending = false;
      }
      s.records = [...records.values()];
      s.cursor = response.cursor;
      s.archive = response.archive || null;
      s.lastError = "";
      if (!response.hasMore && !s.records.some(r => r.pending)) s.lastSync = Date.now();
      return true;
    })
  };
}
