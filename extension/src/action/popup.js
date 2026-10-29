const send = async (type, payload = {}) => {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response || response.error) throw new Error(response?.error || "请重新打开扩展");
  return response;
};
document.getElementById("options").addEventListener("click", () => { void send("openOptions"); });
document.getElementById("enabled").addEventListener("change", async event => {
  try { await send("preferencesPatch", { patch: { enabled: event.target.checked } }); document.getElementById("status").textContent = "设置已更新"; }
  catch (error) { document.getElementById("status").textContent = error.message; }
});
void send("getState").then(state => {
  document.getElementById("enabled").checked = state.settings.enabled;
  document.getElementById("status").textContent = `本机收藏 ${state.vocabCount} 个词 / 表达`;
}).catch(error => { document.getElementById("status").textContent = error.message; });
