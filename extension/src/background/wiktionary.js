import { fetchJSON } from "./network.js";

// Return plain text only. Remote HTML is never placed into the extension DOM.
export function plainDefinition(html) {
  return String(html || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g,
      value => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[value])
    .replace(/\s+/g, " ").trim().slice(0, 1200);
}
export function readDefinitions(payload, language = "en") {
  const groups = payload && payload[language.split("-")[0]];
  if (!Array.isArray(groups)) return [];
  const entries = [];
  for (const group of groups) {
    for (const row of Array.isArray(group.definitions) ? group.definitions : []) {
      const text = plainDefinition(row.definition);
      if (text) entries.push({ part: plainDefinition(group.partOfSpeech), text });
      if (entries.length === 6) return entries;
    }
  }
  return entries;
}
export async function lookupEnglish(word, language = "en", fetcher = fetch) {
  const term = String(word || "").trim();
  if (!term || term.length > 80 || /[\r\n<>]/.test(term)) throw new Error("请选择较短的单词查询");
  const page = "https://en.wiktionary.org/wiki/" + encodeURIComponent(term);
  try {
    const payload = await fetchJSON("https://en.wiktionary.org/api/rest_v1/page/definition/" + encodeURIComponent(term),
      { credentials: "omit", headers: { Accept: "application/json" } }, fetcher);
    return { source: "Wiktionary", url: page, license: "CC BY-SA 4.0", entries: readDefinitions(payload, language) };
  } catch (_) {
    return { source: "Wiktionary", url: page, license: "CC BY-SA 4.0", entries: [], message: "在线词典暂时不可用，可在来源页查看。" };
  }
}
