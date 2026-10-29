embeddedSection(); addEventListener("hashchange", embeddedSection);
const send = async (type, payload = {}) => {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response || response.error) throw new Error(response?.error || "扩展未响应，请重新打开设置");
  return response;
};
const $ = selector => document.querySelector(selector);
let settings, hasKeys;
async function initialize() {
  const state = await send("getState"); settings = state.settings; hasKeys = state.hasKeys;
  for (const field of $("#preferences").elements) {
    if (!(field.name in settings)) continue;
    if (field.type === "checkbox") field.checked = settings[field.name]; else field.value = settings[field.name];
  }
  $("#provider").value = settings.llmProvider; providerChanged();
  $("#vocab-count").textContent = `本机已收藏 ${state.vocabCount} 个词 / 表达。`;
}
function providerChanged() {
  const provider = $("#provider").value;
  $("#model").value = settings?.[provider + "Model"] || "";
  $("#api-key").value = ""; $("#api-key").placeholder = hasKeys?.[provider] ? "已保存；留空沿用，密钥不会回传到页面" : "填写此服务商的 API 密钥";
  $("#model").disabled = provider === "none"; $("#api-key").disabled = provider === "none";
}
$("#provider").addEventListener("change", providerChanged);
$("#preferences").addEventListener("submit", async event => {
  event.preventDefault(); const patch = {};
  for (const field of event.currentTarget.elements) if (field.name) patch[field.name] = field.type === "checkbox" ? field.checked : field.value;
  try { settings = (await send("preferencesPatch", { patch })).settings; $("#preferences-message").textContent = "已保存，视频面板会更新。"; }
  catch (error) { $("#preferences-message").textContent = error.message; }
});
$("#ai-form").addEventListener("submit", async event => {
  event.preventDefault();
  const provider = $("#provider").value, model = $("#model").value.trim(), key = $("#api-key").value.trim();
  const message = $("#ai-message");
  try {
    if (provider !== "none") {
      if (!model) throw new Error("请填写自己账户当前可用的模型 ID");
      const origin = provider === "gemini" ? "https://generativelanguage.googleapis.com/*" : "https://api.anthropic.com/*";
      if (chrome.permissions && !await chrome.permissions.request({ origins: [origin] })) throw new Error("未允许访问，AI 仍保持原配置");
    }
    const payload = { settings: { llmProvider: provider } };
    if (provider !== "none") { payload.settings[provider + "Model"] = model; if (key) { payload.provider = provider; payload.key = key; } }
    await send("saveConfig", payload); message.textContent = "已保存。需要解释时，在视频词卡中主动点 AI 解释。"; await initialize();
  } catch (error) { message.textContent = error.message; }
});
$("#forget-key").addEventListener("click", async () => {
  const provider = $("#provider").value;
  if (provider === "none") return;
  try { await send("saveConfig", { provider, key: "", settings: { llmProvider: "none" } }); $("#ai-message").textContent = "已移除本机密钥并关闭 AI。"; await initialize(); }
  catch (error) { $("#ai-message").textContent = error.message; }
});
$("#clear-cache").addEventListener("click", async () => {
  try { const result = await send("clearCache"); $("#cache-message").textContent = `清除了 ${result.cleared} 项会话缓存。`; }
  catch (error) { $("#cache-message").textContent = error.message; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.vocab) $("#vocab-count").textContent = `本机已收藏 ${changes.vocab.newValue?.length || 0} 个词 / 表达。`;
});
$("recover-ai").addEventListener("click", async () => {
  try {
    const result = await send("recoverLegacyAI"); await initialize();
    $("ai-message").textContent = result.recovered ? `恢复了 ${result.recovered} 个本机旧密钥。请核对模型并保存 AI 配置，确认服务访问权限。` : "未找到可恢复的旧密钥，或当前密钥已存在。可直接填写新配置。";
  } catch (error) { $("ai-message").textContent = error.message; }
});
void initialize().catch(error => { $("#preferences-message").textContent = error.message; });

// One trusted settings page serves the full tab and the optional in-video drawer.
function embeddedSection() {
  if (new URLSearchParams(location.search).get("embedded") !== "1") return;
  document.body.classList.add("embedded");
  const section = location.hash === "#sync" ? "sync" : "ai";
  document.body.dataset.section = section;
  document.querySelector("details").open = true;
}
