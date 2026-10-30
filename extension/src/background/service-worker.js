import { getSettings, setSettings, readKey, writeKey, recoverLegacyAI } from "./settings.js";
import { createLookupCache } from "./cache.js";
import { lookupChinese } from "./chinese-dictionary.js";
import { lookupEnglish } from "./wiktionary.js";
import { explain } from "./llm.js";
import { createVocabStore } from "./vocab-store.js";
import { createSyncClient } from "./sync.js";

const store = createVocabStore(chrome.storage.local);
const sync = createSyncClient(store);
const cache = createLookupCache();
const optionsURL = chrome.runtime.getURL("src/options/options.html");
const settingsPages = new Set([optionsURL, chrome.runtime.getURL("src/options/panel.html")]);
const allowedPreferences = new Set(["enabled", "learnLang", "nativeLang", "blurNative", "blurLearn", "autoPause", "fontScale", "showSidebar", "vocabHighlight", "vocabLevel", "vocabStyle", "hoverPause", "subtitleBackdrop"]);
const attemptSync = () => { void sync.run().catch(() => {}); };
function optionsOnly(sender) {
  // The settings page can also run inside its own extension-origin iframe.
  // Browser-provided sender.url remains the boundary; a YouTube content script is never trusted.
  if (sender.id !== chrome.runtime.id || !settingsPages.has(String(sender.url || "").split(/[?#]/)[0])) throw new Error("请在插件设置页操作");
}
function selected(message) {
  const text = String(message.text || "").trim();
  if (!text || text.length > 500) throw new Error("请选择 500 字以内的内容");
  return { text, lang: String(message.lang || "en").slice(0, 16), sentence: String(message.sentence || "").slice(0, 4000) };
}
const routes = {
  async getState() {
    return { settings: await getSettings(), hasKeys: { gemini: !!await readKey("gemini"), anthropic: !!await readKey("anthropic") },
      vocabCount: (await store.list()).length };
  },
  async preferencesPatch(message) {
    const patch = Object.fromEntries(Object.entries(message.patch || {}).filter(([key]) => allowedPreferences.has(key)));
    return { settings: await setSettings(patch) };
  },
  async saveConfig(message, sender) {
    optionsOnly(sender);
    if (message.provider !== undefined && message.key !== undefined) await writeKey(message.provider, message.key);
    cache.clear();
    return { settings: await setSettings(message.settings || {}) };
  },
  async recoverLegacyAI(_message, sender) { optionsOnly(sender); cache.clear(); return recoverLegacyAI(); },
  async lookup(message) {
    const input = selected(message);
    const result = input.lang.split("-")[0] === "en" ? await lookupChinese(input.text) : null;
    return { ...(result || { kind: "missing", meaning: "本机英汉词库未收录，可查看英文词典或主动查询 AI。" }),
      saved: await store.isSaved(input.text, input.lang) };
  },
  async englishLookup(message) {
    const input = selected(message);
    return cache.resolve("wiki:" + input.lang + ":" + input.text.toLowerCase(), () => lookupEnglish(input.text, input.lang));
  },
  async aiExplain(message) {
    const input = selected(message);
    const settings = await getSettings();
    const provider = settings.llmProvider;
    const key = await readKey(provider);
    const model = settings[provider + "Model"];
    if (chrome.permissions && !await chrome.permissions.contains({ origins: [provider === "gemini" ?
      "https://generativelanguage.googleapis.com/*" : "https://api.anthropic.com/*"] })) throw new Error("请在完整设置中允许 AI 服务域名访问");
    return cache.resolve(JSON.stringify([provider, model, settings.nativeLang, input]), () => explain({ ...input, provider, key, model, nativeLang: settings.nativeLang }));
  },
  vocabList: async () => ({ items: await store.list() }),
  async vocabToggle(message) { const result = await store.toggle(message.item); attemptSync(); return result; },
  async vocabRemove(message) { const result = await store.remove(message.id); attemptSync(); return result; },
  syncStatus: () => sync.status(),
  syncConfigure(message, sender) { optionsOnly(sender); return sync.configure(message); },
  syncDisconnect(_message, sender) { optionsOnly(sender); return sync.disconnect(); },
  syncNow(_message, sender) { optionsOnly(sender); return sync.run(); },
  syncArchive(_message, sender) { optionsOnly(sender); return sync.archive(); },
  async vocabBackup(_message, sender) { optionsOnly(sender); return { backup: await store.backup() }; },
  async vocabLegacyBackup(_message, sender) { optionsOnly(sender); return { backup: await store.legacyBackup() }; },
  async vocabRestore(message, sender) { optionsOnly(sender); const result = await store.restore(message.backup); attemptSync(); return result; },
  async clearCache(_message, sender) { optionsOnly(sender); return { cleared: cache.clear() }; },
  async openOptions(message) {
    if (["ai", "sync"].includes(message.section)) await chrome.tabs.create({ url: optionsURL + "#" + message.section });
    else await chrome.runtime.openOptionsPage();
    return { ok: true };
  }
};

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !Object.hasOwn(routes, message?.type)) return false;
  Promise.resolve().then(() => routes[message.type](message, sender)).then(reply, error => reply({ error: error.message || "操作失败" }));
  return true;
});
void chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});
// Content scripts receive a notification, never the storage event's credential values.
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area !== "local" || (!changes.sunnyPreferences && !changes.vocab) || !chrome.tabs) return;
  void chrome.tabs.query({ url: ["https://*.youtube.com/*"] }).then(tabs => Promise.allSettled(
    tabs.filter(tab => Number.isInteger(tab.id)).map(tab => chrome.tabs.sendMessage(tab.id, { type: "sunnyStateChanged" }))
  )).catch(() => {});
});
const alarm = "sunny-vocabulary-sync";
async function wake() {
  if (chrome.alarms && !await chrome.alarms.get(alarm)) await chrome.alarms.create(alarm, { periodInMinutes: 5 });
  attemptSync();
}
chrome.runtime.onStartup.addListener(() => { void wake().catch(() => {}); });
chrome.runtime.onInstalled.addListener(() => { void wake().catch(() => {}); });
chrome.alarms?.onAlarm.addListener(event => { if (event.name === alarm) attemptSync(); });
void wake().catch(() => {});
