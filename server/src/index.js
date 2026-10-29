import { BATCH_SIZE, validateRecord } from "../../extension/src/shared/sync-model.js";
import { archiveStatus, exportToGitHub } from "./archive.js";

// AUTOINCREMENT allocates excluded.seq before the conflict update. Assigning it on
// a winning update lets a single table act as a paginated change feed.
export const UPSERT = `INSERT INTO vocabulary(id, clock, device_id, deleted, payload) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET seq = excluded.seq, clock = excluded.clock,
  device_id = excluded.device_id, deleted = excluded.deleted, payload = excluded.payload
  WHERE excluded.clock > vocabulary.clock OR
  (excluded.clock = vocabulary.clock AND excluded.device_id > vocabulary.device_id)`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store"
};
function json(body, status = 200) { return Response.json(body, { status, headers: CORS }); }
async function authorized(request, secret) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret || "")) return false;
  const supplied = (request.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (supplied.length > 256) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([secret, supplied].map(value => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
async function readBody(request) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    const error = new Error("需要 JSON 数据"); error.status = 415; throw error;
  }
  if (Number(request.headers.get("Content-Length")) > 1000000) { const error = new Error("请求过大"); error.status = 413; throw error; }
  const reader = request.body?.getReader();
  if (!reader) throw new Error("缺少请求数据");
  let total = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 1000000) { await reader.cancel(); const error = new Error("请求过大"); error.status = 413; throw error; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch (_) { throw new Error("JSON 数据无效"); }
}

export async function synchronize(db, body) {
  if (!body || body.schema !== 1 || !Number.isSafeInteger(body.cursor) || body.cursor < 0 ||
      !Array.isArray(body.records) || body.records.length > BATCH_SIZE) throw new Error("同步请求格式无效");
  const records = body.records.map(validateRecord);
  // First-primary session guarantees read-after-write even when read replication is enabled.
  const session = db.withSession ? db.withSession("first-primary") : db;
  const before = await session.prepare("SELECT COALESCE(MAX(seq), 0) AS revision FROM vocabulary").first();
  if (body.cursor > before.revision) return { reset: true };
  // Validate the entire batch before any DB writes; an interrupted retry is idempotent.
  const statements = records.map(record => session.prepare(UPSERT).bind(record.id, record.clock, record.deviceId,
    record.deleted ? 1 : 0, JSON.stringify(record)));
  statements.push(session.prepare("SELECT seq, payload FROM vocabulary WHERE seq > ? ORDER BY seq LIMIT 201").bind(body.cursor));
  const results = await session.batch(statements);
  const changes = results.at(-1).results;
  const page = changes.slice(0, 200);
  return { schema: 1, records: page.map(row => JSON.parse(row.payload)),
    cursor: page.length ? page.at(-1).seq : body.cursor, hasMore: changes.length > 200, archive: await archiveStatus(session) };
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method === "GET" && path === "/health") return json({ app: "SunnyLanguageLab", version: "0.6.0" });
    if (!env.DB || !/^[A-Za-z0-9_-]{32,256}$/.test(env.SYNC_TOKEN || "")) return json({ error: "服务尚未配置" }, 503);
    if (!await authorized(request, env.SYNC_TOKEN)) return json({ error: "未授权" }, 401);
    if (request.method !== "POST") return json({ error: "请使用 POST" }, 405);
    if (!["/v1/sync", "/v1/archive"].includes(path)) return json({ error: "接口不存在" }, 404);
    let body;
    try { body = await readBody(request); }
    catch (error) { return json({ error: error.message }, error.status || 400); }
    try {
      if (path === "/v1/archive") return json({ archive: await exportToGitHub(env) });
      // Input failures are 400; DB failures do not expose internal data or SQL.
      if (!body || body.schema !== 1 || !Array.isArray(body.records) || body.records.length > BATCH_SIZE ||
          !Number.isSafeInteger(body.cursor) || body.cursor < 0) return json({ error: "同步请求格式无效" }, 400);
      try { body.records.forEach(validateRecord); }
      catch (error) { return json({ error: error.message }, 400); }
      return json(await synchronize(env.DB, body));
    } catch (_) { return json({ error: "服务暂时不可用，请稍后重试" }, 500); }
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(exportToGitHub(env)); }
};
