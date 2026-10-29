import { BATCH_SIZE, validateRecord, workerEndpoint } from "../shared/sync-model.js";

export function createSyncClient(store, fetcher = fetch) {
  let running = null;
  async function status() {
    return store.read(s => ({ enabled: s.config.enabled, endpoint: s.config.endpoint, hasToken: !!s.config.token,
      pending: s.records.filter(r => r.pending).length, count: s.records.filter(r => !r.deleted).length,
      lastSync: s.lastSync, error: s.lastError, archive: s.archive, running: !!running }));
  }
  async function configure(input) {
    const endpoint = workerEndpoint(input.endpoint);
    await store.transact(s => {
      const token = String(input.token || "").trim() || s.config.token;
      if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new Error("请填写至少 32 位的同步口令");
      if (endpoint !== s.config.endpoint) {
        if (s.config.token && !String(input.token || "").trim()) throw new Error("更换服务地址时请重新输入同步口令");
        s.cursor = 0;
        s.records.forEach(r => { r.pending = true; });
        s.lastSync = 0;
        s.archive = null;
      }
      s.config = { enabled: input.enabled !== false, endpoint, token, generation: crypto.randomUUID() };
      s.lastError = "";
    });
    return status();
  }
  async function request(config, path, body) {
    const response = await fetcher(config.endpoint + path, {
      method: "POST", credentials: "omit", redirect: "error", cache: "no-store",
      headers: { "Authorization": "Bearer " + config.token, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      const messages = { 401: "同步口令不正确", 413: "同步数据过大，请分批导入", 429: "请求较多，稍后会自动重试",
        503: "同步服务尚未配置完成" };
      throw new Error(messages[response.status] || "同步服务暂时无法连接（" + response.status + "）");
    }
    return response.json();
  }
  async function sync() {
    for (let round = 0; round < 40; round++) {
      const batch = await store.read(s => {
        const records = [];
        let bytes = 0;
        for (const record of s.records.filter(r => r.pending)) {
          const wire = validateRecord(record);
          const size = new TextEncoder().encode(JSON.stringify(wire)).length;
          if (records.length && bytes + size > 500000) break;
          records.push(wire); bytes += size;
          if (records.length === BATCH_SIZE) break;
        }
        return { config: { ...s.config }, cursor: s.cursor, records };
      });
      if (!batch.config.enabled || !batch.config.token) return status();
      const response = await request(batch.config, "/v1/sync", { schema: 1, cursor: batch.cursor, records: batch.records });
      if (response.reset) {
        await store.transact(s => {
          if (s.config.generation !== batch.config.generation) return;
          s.cursor = 0; s.records.forEach(r => { r.pending = true; });
        });
        continue;
      }
      if (!Array.isArray(response.records) || response.records.length > 200 ||
          !Number.isSafeInteger(response.cursor) || response.cursor < batch.cursor ||
          typeof response.hasMore !== "boolean") throw new Error("同步服务返回了无效数据");
      response.records.forEach(validateRecord);
      if (response.hasMore && response.cursor === batch.cursor) throw new Error("同步进度未推进，请检查服务版本");
      if (!await store.merge(response, batch.records, batch.config.generation)) return status();
      const remaining = await store.read(s => s.records.some(r => r.pending));
      if (!response.hasMore && !remaining) return status();
    }
    // Pending data remains durable; the next alarm resumes large initial imports.
    return status();
  }
  function run() {
    if (running) return running;
    running = sync().catch(async error => {
      const message = error && error.name === "TimeoutError" ? "连接超时，联网后会自动重试" :
        error instanceof TypeError ? "暂时无法联网，生词已保存在本机" : error.message || "同步失败，稍后重试";
      await store.transact(s => { if (s.config.enabled) s.lastError = message; });
      return status();
    }).finally(() => { running = null; });
    return running;
  }
  return {
    status, configure, run,
    disconnect: async () => {
      await store.transact(s => { s.config.enabled = false; s.config.token = ""; s.config.generation = crypto.randomUUID(); s.lastError = ""; });
      return status();
    },
    archive: async () => {
      await run();
      const snapshot = await store.read(s => ({ config: { ...s.config }, pending: s.records.some(r => r.pending), error: s.lastError }));
      if (!snapshot.config.enabled || !snapshot.config.token) throw new Error("请先连接同步服务");
      if (snapshot.pending || snapshot.error) throw new Error("请先完成同步，再归档到 Obsidian");
      const result = await request(snapshot.config, "/v1/archive", {});
      await store.transact(s => { if (s.config.generation === snapshot.config.generation) s.archive = result.archive; });
      if (result.archive.error) throw new Error(result.archive.error);
      return status();
    }
  };
}
