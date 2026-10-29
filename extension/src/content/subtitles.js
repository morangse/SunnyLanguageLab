// Subtitle transformations are independent of browser and site state.
function clean(text) {
  return String(text || "").replace(/\u200b/g, "").replace(/[\t\r ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
export function normalizeCues(rows) {
  const ordered = rows.filter(row => Number.isFinite(row.start) && row.start >= 0 && row.text)
    .map(row => ({ start: row.start, end: Math.max(row.start + 0.08, Number(row.end) || row.start + 4), text: clean(row.text) }))
    .filter(row => row.text).sort((a, b) => a.start - b.start);
  const result = [];
  for (const row of ordered) {
    const last = result.at(-1);
    if (last && last.start === row.start) {
      if (!last.text.includes(row.text)) last.text += "\n" + row.text;
      last.end = Math.max(last.end, row.end);
    } else result.push(row);
  }
  return result.map((row, index) => ({ ...row, end: Math.min(row.end, result[index + 1]?.start ?? row.end) }));
}
export function parseJSON3(input) {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  if (!Array.isArray(data?.events)) throw new Error("字幕格式不是 JSON3");
  return normalizeCues(data.events.filter(event => Array.isArray(event.segs)).map(event => ({
    start: Number(event.tStartMs) / 1000,
    end: (Number(event.tStartMs) + (Number(event.dDurationMs) || 4000)) / 1000,
    text: event.segs.map(segment => segment.utf8 || "").join("")
  })));
}
function seconds(timestamp) {
  return timestamp.replace(",", ".").split(":").reduce((value, part) => value * 60 + Number(part), 0);
}
export function parseVTT(body) {
  const rows = [];
  for (const block of String(body).replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const at = lines.findIndex(line => /\d\d:\d\d.*-->/.test(line));
    if (at < 0) continue;
    const match = lines[at].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/);
    if (!match) continue;
    rows.push({ start: seconds(match[1]), end: seconds(match[2]), text: lines.slice(at + 1).join("\n").replace(/<[^>]*>/g, "") });
  }
  return normalizeCues(rows);
}
export function parseCaptions(body) {
  if (typeof body === "object" || String(body).trim().startsWith("{")) return parseJSON3(body);
  if (/^\s*WEBVTT/.test(body)) return parseVTT(body);
  if (typeof DOMParser === "undefined") throw new Error("字幕格式暂不支持");
  const xml = new DOMParser().parseFromString(body, "text/xml");
  if (xml.querySelector("parsererror")) throw new Error("字幕数据无法解析");
  return normalizeCues([...xml.querySelectorAll("text, p")].map(node => {
    const start = Number(node.getAttribute("start") ?? Number(node.getAttribute("t")) / 1000);
    return { start, end: start + (Number(node.getAttribute("dur") ?? Number(node.getAttribute("d")) / 1000) || 4), text: node.textContent };
  }));
}
export function cueIndex(cues, time) {
  let low = 0, high = cues.length - 1, found = -1;
  while (low <= high) { const mid = (low + high) >> 1; if (cues[mid].start <= time) { found = mid; low = mid + 1; } else high = mid - 1; }
  return found >= 0 && time < cues[found].end ? found : -1;
}
export function pairCues(source, translated) {
  let first = 0;
  return source.map(cue => {
    while (first < translated.length && translated[first].end <= cue.start) first++;
    const matches = [];
    for (let index = first; index < translated.length && translated[index].start < cue.end; index++) {
      if (translated[index].end > cue.start) matches.push(translated[index]);
    }
    return { ...cue, native: [...new Set(matches.map(row => row.text))].join(" ") };
  });
}
export function tokenize(text) {
  return String(text).split(/([\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*)/u).filter(Boolean)
    .map(text => ({ text, word: /\p{L}/u.test(text) }));
}
