// Page-world bridge: exposes only subtitle metadata and caption text, never extension storage.
(() => {
  const flag = "__sunnyCaptionBridge06";
  if (window[flag]) return;
  window[flag] = true;
  const channel = "sunny-captions-06";
  let active = 0;
  function snapshot() {
    const id = new URL(location.href).searchParams.get("v") || "";
    let player;
    try { player = document.getElementById("movie_player")?.getPlayerResponse?.(); } catch (_) { /* Player is not ready. */ }
    const initial = window.ytInitialPlayerResponse;
    const data = player?.videoDetails?.videoId === id ? player : initial?.videoDetails?.videoId === id ? initial : null;
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return { id, title: String(data?.videoDetails?.title || document.title).slice(0, 1000),
      tracks: tracks.slice(0, 40).map(track => ({ url: track.baseUrl, language: track.languageCode, automatic: track.kind === "asr",
        name: track.name?.simpleText || track.name?.runs?.map(row => row.text).join("") || track.languageCode })) };
  }
  addEventListener("message", async event => {
    const message = event.data;
    if (event.source !== window || message?.channel !== channel || message.direction !== "request" ||
        !/^[a-z0-9-]{8,64}$/.test(message.id || "")) return;
    if (!["snapshot", "captions"].includes(message.action) || active >= 3) return;
    active++;
    try {
      const info = snapshot();
      let value = info;
      if (message.action === "captions") {
        const track = info.tracks.find(track => track.url === message.url);
        if (!track) throw new Error("字幕轨道已变化，请重新加载字幕");
        const url = new URL(track.url);
        if (url.protocol !== "https:" || !/(^|\.)youtube\.com$/.test(url.hostname) || url.pathname !== "/api/timedtext") throw new Error("字幕地址无效");
        url.searchParams.set("fmt", "json3");
        if (message.translate) {
          if (!/^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/.test(message.translate)) throw new Error("翻译语言无效");
          url.searchParams.set("tlang", message.translate);
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 18000);
        try {
          const response = await fetch(url.href, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
          if (!response.ok) throw new Error("字幕请求失败 " + response.status);
          const reader = response.body.getReader(), chunks = [];
          let size = 0;
          while (true) { const row = await reader.read(); if (row.done) break; size += row.value.length;
            if (size > 4000000) { await reader.cancel(); throw new Error("字幕文件过大"); } chunks.push(row.value); }
          const buffer = new Uint8Array(size); let offset = 0;
          for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
          value = new TextDecoder().decode(buffer);
        } finally { clearTimeout(timer); }
      }
      postMessage({ channel, direction: "response", id: message.id, value }, location.origin);
    } catch (error) { postMessage({ channel, direction: "response", id: message.id, error: error.message || "字幕读取失败" }, location.origin); }
    finally { active--; }
  });
})();
