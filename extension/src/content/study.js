import { StudySurface } from "./surface.js";
import { readYouTube } from "./youtube.js";

const send = async (type, payload = {}) => {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response || response.error) throw new Error(response?.error || "扩展已更新，请刷新页面");
  return response;
};
let surface, video, identity = "", loadGeneration = 0;
async function load() {
  const target = surface; if (!target) return;
  const generation = ++loadGeneration;
  target.notice("正在读取字幕…");
  try {
    const result = await readYouTube(target.settings);
    if (generation === loadGeneration && target === surface) target.setCues(result.cues, result);
  } catch (error) { if (generation === loadGeneration && target === surface) { target.setCues([]); target.notice(error.message); } }
}
async function inspect() {
  const candidate = document.querySelector("video.html5-main-video") || document.querySelector("video");
  const nextID = new URL(location.href).searchParams.get("v") || "";
  if (!candidate || !nextID) { if (surface) { surface.destroy(); surface = null; video = null; identity = ""; loadGeneration++; } return; }
  if (surface && candidate === video && identity === nextID) return;
  const state = await send("getState");
  surface?.destroy(); video = candidate; identity = nextID;
  surface = new StudySurface({ video, send, settings: state.settings, onPreferences: key => { if (["learnLang", "nativeLang"].includes(key)) void load(); } });
  surface.onReload = load;
  if (state.settings.showSidebar) surface.setExpanded(true);
  void load();
}
let checking = false;
async function schedule() { if (checking) return; checking = true; try { await inspect(); } catch (_) { /* Retry when extension/page becomes available. */ } finally { checking = false; } }
setInterval(schedule, 1500);
document.addEventListener("yt-navigate-finish", () => { void schedule(); });
let refreshTimer;
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id || message?.type !== "sunnyStateChanged") return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    try {
      const target = surface; if (!target) return;
      const state = await send("getState"); if (target !== surface) return;
      const old = target.settings; target.settings = state.settings;
      if (old.blurNative !== target.settings.blurNative || old.blurLearn !== target.settings.blurLearn) {
        target.nativeVisible = false; target.originalVisible = false;
      }
      // Preserve unsaved form input in the extension-origin settings drawer.
      if (target.tab !== "settings") target.render();
      target.renderInline(); await target.refreshSaved();
      if (old.learnLang !== target.settings.learnLang || old.nativeLang !== target.settings.nativeLang) void load();
    } catch (_) { /* The next page wakeup retries after an extension update. */ }
  }, 100);
});
void schedule();
