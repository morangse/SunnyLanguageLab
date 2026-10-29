(() => {
  if (globalThis.__sunnyStudy06) return;
  globalThis.__sunnyStudy06 = true;
  const bridge = document.createElement("script");
  bridge.src = chrome.runtime.getURL("src/page/youtube-bridge.js");
  bridge.onload = () => bridge.remove(); bridge.onerror = () => bridge.remove();
  (document.head || document.documentElement).append(bridge);
  import(chrome.runtime.getURL("src/content/study.js")).catch(error => console.warn("Sunny 加载失败，请刷新页面", error));
})();
