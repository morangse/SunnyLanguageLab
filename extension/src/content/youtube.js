import { parseCaptions, pairCues } from "./subtitles.js";

export function bridgeRequest(action, extra = {}, timeout = 22000) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const finish = () => { clearTimeout(timer); window.removeEventListener("message", receive); };
    function receive(event) {
      const reply = event.data;
      if (event.source !== window || reply?.channel !== "sunny-captions-06" || reply.direction !== "response" || reply.id !== id) return;
      finish(); if (reply.error) reject(new Error(reply.error)); else resolve(reply.value);
    }
    const timer = setTimeout(() => { finish(); reject(new Error("页面没有返回字幕，请刷新并确认原视频有字幕")); }, timeout);
    window.addEventListener("message", receive);
    window.postMessage({ channel: "sunny-captions-06", direction: "request", id, action, ...extra }, location.origin);
  });
}
const base = language => String(language || "").toLowerCase().split("-")[0];
export function pickTrack(tracks, language) {
  return tracks.find(track => track.language === language && !track.automatic) ||
    tracks.find(track => base(track.language) === base(language) && !track.automatic) ||
    tracks.find(track => base(track.language) === base(language));
}
export async function readYouTube(settings, request = bridgeRequest) {
  const info = await request("snapshot");
  if (!info.id) throw new Error("请打开 YouTube 普通视频，暂不支持 Shorts 或直播");
  const track = pickTrack(info.tracks, settings.learnLang);
  if (!track) throw new Error("未找到所选语言字幕；请打开视频字幕，或在设置中更换学习语言");
  const source = parseCaptions(await request("captions", { url: track.url }));
  if (!source.length) throw new Error("视频返回空字幕；请刷新、检查原始字幕，或尝试桌面网站");
  let translated = [], warning = "";
  if (base(settings.nativeLang) !== base(settings.learnLang)) {
    try {
      const nativeTrack = pickTrack(info.tracks, settings.nativeLang);
      translated = parseCaptions(await request("captions", nativeTrack ? { url: nativeTrack.url } :
        { url: track.url, translate: settings.nativeLang === "zh" ? "zh-Hans" : settings.nativeLang }));
      if (!translated.length) warning = "本站没有返回译文，原文仍可练习。";
    } catch (_) { warning = "译文暂时无法读取，原文仍可练习。"; }
  }
  return { id: info.id, title: info.title, cues: pairCues(source, translated), warning };
}
