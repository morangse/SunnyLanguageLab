// Sunny 0.6 settings. Only explicitly supported fields enter durable preferences.
export const DEFAULTS = Object.freeze({
  enabled: true, learnLang: "en", nativeLang: "zh", blurNative: false,
  blurLearn: false, autoPause: false, fontScale: 1, llmProvider: "none",
  geminiModel: "", anthropicModel: "", showSidebar: false,
  vocabHighlight: true, vocabLevel: "4500", vocabStyle: "underline", hoverPause: true,
  subtitleBackdrop: "soft"
});
const bools = new Set(["enabled", "blurNative", "blurLearn", "autoPause", "showSidebar", "vocabHighlight", "hoverPause"]);
export function preferences(input = {}) {
  const result = { ...DEFAULTS };
  for (const key of bools) if (typeof input[key] === "boolean") result[key] = input[key];
  for (const key of ["learnLang", "nativeLang"]) {
    if (/^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/.test(input[key] || "")) result[key] = input[key];
  }
  result.fontScale = Math.max(0.8, Math.min(1.5, Number(input.fontScale) || 1));
  if (["2500", "4500", "6500", "9000", "all"].includes(String(input.vocabLevel))) result.vocabLevel = String(input.vocabLevel);
  if (["pill", "text", "underline"].includes(input.vocabStyle)) result.vocabStyle = input.vocabStyle;
  if (["soft", "none", "solid"].includes(input.subtitleBackdrop)) result.subtitleBackdrop = input.subtitleBackdrop;
  if (["none", "gemini", "anthropic"].includes(input.llmProvider)) result.llmProvider = input.llmProvider;
  for (const key of ["geminiModel", "anthropicModel"]) {
    if (/^[a-zA-Z0-9._:-]{0,120}$/.test(input[key] || "")) result[key] = input[key] || "";
  }
  return result;
}
export async function getSettings(storage = chrome.storage.local, previous = globalThis.chrome?.storage?.sync) {
  const values = await storage.get(["sunnyPreferences", "settings"]);
  if (values.sunnyPreferences || values.settings) return preferences(values.sunnyPreferences || values.settings);
  const legacy = await previous?.get("settings").catch(() => ({}));
  return preferences(legacy?.settings);
}
export async function setSettings(patch, storage = chrome.storage.local) {
  const next = preferences({ ...await getSettings(storage), ...patch });
  await storage.set({ sunnyPreferences: next });
  return next;
}
export const keyName = provider => ({ gemini: "sunnyGeminiKey", anthropic: "sunnyAnthropicKey" })[provider];
export async function readKey(provider, storage = chrome.storage.local) {
  const key = keyName(provider);
  if (!key) return "";
  return String((await storage.get(key))[key] || "");
}
export async function writeKey(provider, value, storage = chrome.storage.local) {
  const key = keyName(provider);
  if (!key) throw new Error("不支持的 AI 服务商");
  if (typeof value !== "string" || value.length > 4096) throw new Error("密钥格式无效");
  await storage.set({ [key]: value.trim() });
}

export async function recoverLegacyAI(storage = chrome.storage.local, previous = globalThis.chrome?.storage?.sync) {
  const old = (await previous?.get("settings").catch(() => ({})))?.settings || {};
  const patch = {}; let recovered = 0;
  for (const provider of ["gemini", "anthropic"]) {
    const legacyName = provider === "gemini" ? "geminiApiKey" : "anthropicApiKey";
    const values = await storage.get([legacyName, keyName(provider)]);
    if (!values[keyName(provider)] && typeof values[legacyName] === "string" && values[legacyName].trim()) {
      await writeKey(provider, values[legacyName], storage); recovered++;
    }
    if (old[provider + "Model"]) patch[provider + "Model"] = old[provider + "Model"];
  }
  if (["gemini", "anthropic"].includes(old.llmProvider)) patch.llmProvider = old.llmProvider;
  const settings = preferences({ ...await getSettings(storage, previous), ...patch });
  await storage.set({ sunnyPreferences: settings });
  return { settings, recovered }; // Credential values never leave background storage.
}
