// Wire format shared by the extension and its personal Worker. No browser APIs.
export const SCHEMA = 1;
export const BATCH_SIZE = 25;
export const TEXT_LIMITS = {
  text: 500, lemma: 500, meaning: 4000, sentence: 4000,
  sentenceNative: 4000, site: 80, title: 1000, url: 2000
};

export function vocabId(text, lang) {
  const word = String(text || "").trim().toLowerCase();
  const language = String(lang || "und").trim().toLowerCase().replace(/_/g, "-").split("-")[0] || "und";
  if (!word || word.length > TEXT_LIMITS.text || !/^[a-z]{2,8}$/.test(language)) return "";
  return language + "|" + word;
}

export function normalizeItem(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("生词格式无效");
  const item = {};
  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    item[key] = String(raw[key] || "").slice(0, limit);
  }
  item.text = item.text.trim();
  item.id = vocabId(item.text, raw.lang);
  if (!item.id) throw new Error("生词或语言无效");
  item.lang = item.id.split("|")[0];
  item.time = Math.max(0, Math.min(1e9, Math.floor(Number(raw.time) || 0)));
  item.savedAt = Number.isSafeInteger(raw.savedAt) && raw.savedAt > 0 && raw.savedAt <= 8640000000000000 ? raw.savedAt : Date.now();
  return item;
}

export function validateRecord(raw) {
  if (!raw || !Number.isSafeInteger(raw.clock) || raw.clock < 1 || raw.clock > 1e12 ||
      typeof raw.deviceId !== "string" || !/^[a-z0-9-]{16,64}$/.test(raw.deviceId) ||
      typeof raw.deleted !== "boolean") throw new Error("同步记录版本无效");
  const item = normalizeItem(raw);
  if (raw.id !== item.id) throw new Error("同步记录标识无效");
  return { ...item, clock: raw.clock, deviceId: raw.deviceId, deleted: raw.deleted };
}

export function compareVersion(a, b) {
  if (a.clock !== b.clock) return a.clock < b.clock ? -1 : 1;
  return a.deviceId === b.deviceId ? 0 : a.deviceId < b.deviceId ? -1 : 1;
}

export function activeItems(records) {
  return records.filter(r => !r.deleted).sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id))
    .map(({ clock, deviceId, deleted, pending, ...item }) => item);
}

export function workerEndpoint(input) {
  const url = new URL(String(input || "").trim());
  if (url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev") ||
      url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") {
    throw new Error("请填写个人服务的 https://名称.账号.workers.dev 地址");
  }
  return url.origin;
}
