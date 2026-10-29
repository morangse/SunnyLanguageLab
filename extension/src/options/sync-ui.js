const $ = id => document.getElementById(id);
async function send(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response || response.error && typeof response.enabled !== "boolean") throw new Error(response?.error || "插件未响应，请重新打开设置");
  return response;
}
function date(value) { return value ? new Date(value).toLocaleString() : "尚未完成"; }
function download(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let editing = false;
async function refresh() {
  const state = await send("syncStatus");
  if (!editing) $("sync-endpoint").value = state.endpoint || "";
  $("sync-token").placeholder = state.hasToken ? "已保存；留空沿用当前口令" : "输入个人同步口令";
  $("sync-summary").textContent = state.enabled ?
    "已连接 · 本机 " + state.count + " 个生词 · 待同步 " + state.pending + " 条操作" : "未连接 · 生词保存在本机";
  $("sync-history").textContent = "上次同步：" + date(state.lastSync) + "；上次归档：" + date(state.archive?.at);
  $("sync-error").textContent = state.error || state.archive?.error || "";
  $("sync-now").disabled = !state.enabled;
  $("sync-archive").disabled = !state.enabled;
  $("sync-disconnect").disabled = !state.hasToken;
}
async function action(button, fn) {
  const message = $("sync-message");
  button.disabled = true; message.textContent = "正在处理…";
  try { message.textContent = await fn() || "已完成"; }
  catch (error) { message.textContent = error.message || "操作失败，请稍后重试"; }
  finally { button.disabled = false; await refresh().catch(() => {}); }
}
$("sync-endpoint").addEventListener("input", () => { editing = true; });
$("sync-connect").addEventListener("click", event => action(event.currentTarget, async () => {
  const connected = await send("syncConfigure", { enabled: true, endpoint: $("sync-endpoint").value, token: $("sync-token").value });
  $("sync-token").value = ""; editing = false;
  const result = await send("syncNow");
  return result.error || (connected.enabled ? "已连接，生词将在联网时自动同步" : "已保存");
}));
$("sync-now").addEventListener("click", event => action(event.currentTarget, async () => {
  const result = await send("syncNow");
  return result.error || (result.pending ? "还有待同步记录，将继续自动重试" : "生词已同步");
}));
$("sync-archive").addEventListener("click", event => action(event.currentTarget, async () => {
  const result = await send("syncArchive");
  return result.archive?.busy ? "正在归档，请稍后查看状态" : "已归档到你的 GitHub 仓库，可同步到 Obsidian";
}));
$("sync-disconnect").addEventListener("click", event => action(event.currentTarget, async () => {
  await send("syncDisconnect"); $("sync-token").value = ""; return "已断开，本机生词已保留";
}));
$("vocab-backup").addEventListener("click", event => action(event.currentTarget, async () => {
  download((await send("vocabBackup")).backup, "Sunny-vocabulary-backup.json"); return "JSON 备份已导出";
}));
$("vocab-legacy-backup").addEventListener("click", event => action(event.currentTarget, async () => {
  const { backup } = await send("vocabLegacyBackup");
  if (!backup) return "未发现 v0.4 原始生词；可使用「备份 JSON」";
  download(backup, "Sunny-v0.4-original-vocabulary.json"); return "v0.4 原始备份已导出";
}));
$("vocab-restore").addEventListener("click", () => $("vocab-import-file").click());
$("vocab-import-file").addEventListener("change", event => action($("vocab-restore"), async () => {
  const file = event.target.files[0];
  if (!file) return "未选择文件";
  try {
    if (file.size > 10000000) throw new Error("备份文件超过 10MB，请分批导入");
    const result = await send("vocabRestore", { backup: JSON.parse(await file.text()) });
    return "已补充 " + result.added + " 个生词，原有生词已保留";
  } finally { event.target.value = ""; }
}));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.sunnyV05) void refresh().catch(() => {});
});
window.addEventListener("focus", () => { void send("syncNow").then(refresh).catch(() => {}); });
void send("syncNow").then(refresh).catch(error => { $("sync-error").textContent = error.message; });
