import { skin } from "./skin.js";
import { cueIndex, tokenize } from "./subtitles.js";

const formatTime = time => Math.floor(time / 60) + ":" + String(Math.floor(time % 60)).padStart(2, "0");
function el(tag, text, attributes = {}) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
function button(text, action, attributes = {}) { return el("button", text, { type: "button", "data-action": action, ...attributes }); }

export class StudySurface {
  constructor({ video, send, settings, onPreferences = () => {} }) {
    this.video = video; this.send = send; this.settings = settings; this.onPreferences = onPreferences;
    this.cues = []; this.current = -1; this.page = 0; this.follow = true; this.tab = "subtitles";
    this.nativeVisible = false; this.originalVisible = false; this.phrase = null; this.phraseMode = false;
    this.saved = new Set(); this.queryGeneration = 0; this.lastTime = 0; this.card = null;
    this.host = el("div"); this.host.id = "sunny-study-surface";
    this.host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000";
    this.root = this.host.attachShadow({ mode: "closed" });
    this.root.innerHTML = `<style>${skin}</style><div class="inline" hidden><div class="inline-line original"></div><div class="inline-line translated"></div></div>
      <aside class="panel" data-expanded="false" aria-label="Sunny 语言练习"><header class="head"><span class="mark" aria-hidden="true">☀</span><div class="identity"><b class="brand">SUNNY / STUDY</b><span class="status" role="status">等待字幕</span></div><button type="button" data-action="expand" aria-expanded="false">字幕</button><button type="button" data-action="options" aria-label="打开完整设置">设置</button></header>
      <p class="notice" role="status" hidden></p><nav class="tabs" aria-label="学习面板"><button type="button" data-action="tab" data-tab="subtitles" aria-selected="true">字幕</button><button type="button" data-action="tab" data-tab="vocabulary" aria-selected="false">生词</button><button type="button" data-action="tab" data-tab="practice" aria-selected="false">练习</button></nav><div class="body"><section class="page"></section><section class="lexicon" hidden aria-label="查词"></section></div>
      <footer class="transport" aria-label="逐句播放"><button type="button" data-action="previous">← 上句</button><button type="button" data-action="replay">↻ 重播</button><button type="button" class="play" data-action="play">播放</button><button type="button" data-action="next">下句 →</button></footer></aside>`;
    this.$ = selector => this.root.querySelector(selector);
    this.click = event => { const target = event.target.closest("button"); if (target) void this.action(target).catch(error => this.notice(error.message)); };
    this.root.addEventListener("click", this.click);
    this.seeking = () => { this.nativeVisible = false; this.originalVisible = false; this.current = -1; this.lastTime = this.video.currentTime; this.closeCard(); this.phrase = null; this.tick(true); };
    this.video.addEventListener("seeking", this.seeking);
    this.keydown = event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      const actions = { a: "previous", s: "replay", d: "next", t: "expand", g: "options", Escape: "close-card" };
      const action = actions[event.key] || actions[event.key.toLowerCase()];
      if (action) { event.preventDefault(); void this.action(button("", action)).catch(error => this.notice(error.message)); }
      else if (["q", "e"].includes(event.key.toLowerCase())) { event.preventDefault(); void this.preference(event.key.toLowerCase() === "q" ? "autoPause" : "blurNative"); }
    };
    document.addEventListener("keydown", this.keydown);
    this.root.addEventListener("change", event => { const key = event.target.dataset.setting; if (key) void this.preference(key, event.target.type === "checkbox" ? event.target.checked : event.target.value); });
    this.$(".body").addEventListener("wheel", () => { this.follow = false; }, { passive: true });
    this.$(".body").addEventListener("touchmove", () => { this.follow = false; }, { passive: true });
    document.body.append(this.host);
    this.timer = setInterval(() => this.tick(), 120);
    this.render(); void this.refreshSaved();
  }
  notice(text = "") { this.$(".notice").textContent = text; this.$(".notice").hidden = !text; }
  setCues(cues, metadata = {}) {
    this.cues = cues; this.metadata = metadata; this.current = -1; this.page = 0; this.follow = true;
    this.nativeVisible = false; this.originalVisible = false; this.phrase = null; this.closeCard();
    this.notice(metadata.warning || ""); this.tick(true);
  }
  async refreshSaved() {
    try { this.items = (await this.send("vocabList")).items; this.saved = new Set(this.items.map(item => item.text.toLowerCase()));
      if (this.tab === "vocabulary") this.render(); } catch (_) { /* Available again on next interaction. */ }
  }
  setExpanded(open) {
    this.$(".panel").dataset.expanded = String(open); this.$('[data-action="expand"]').textContent = open ? "收起" : "字幕";
    this.$('[data-action="expand"]').setAttribute("aria-expanded", String(open)); if (open) this.render();
  }
  closeCard() { this.queryGeneration++; this.card = null; this.$(".lexicon").hidden = true; this.$(".lexicon").replaceChildren(); }
  async preference(key, value) {
    const next = value === undefined ? !this.settings[key] : value;
    const response = await this.send("preferencesPatch", { patch: { [key]: next } });
    this.settings = response.settings; this.nativeVisible = false; this.originalVisible = false; this.phrase = null;
    this.render(); this.renderInline(); this.onPreferences(key);
  }
  words(cue, index) {
    const fragment = document.createDocumentFragment();
    tokenize(cue.text).forEach((token, word) => {
      if (!token.word) { fragment.append(document.createTextNode(token.text)); return; }
      const target = button(token.text, "word", { "data-cue": index, "data-word": word }); target.className = "word";
      target.classList.toggle("saved", this.saved.has(token.text.toLowerCase()));
      if (this.phrase?.cue === index && word >= Math.min(this.phrase.start, this.phrase.end) && word <= Math.max(this.phrase.start, this.phrase.end)) target.classList.add("selected");
      fragment.append(target);
    });
    return fragment;
  }
  appendLine(target, cue, index, native) {
    target.replaceChildren();
    if (native && !cue.native) return;
    const hidden = native ? this.settings.blurNative && !(this.nativeVisible && index === this.current) : this.settings.blurLearn && !(this.originalVisible && index === this.current);
    if (hidden) { const reveal = button(native ? "轻点显示中文" : "轻点显示原文", native ? "reveal-native" : "reveal-original", { "data-cue": index }); reveal.className = "reveal"; target.append(reveal); }
    else if (native) { const text = el("span", cue.native, { class: "native-text" }); target.append(text); }
    else target.append(this.words(cue, index));
  }
  renderInline() {
    const cue = this.cues[this.current]; const layer = this.$(".inline");
    layer.hidden = !cue || !this.settings.enabled;
    if (cue) { this.appendLine(this.$(".inline .original"), cue, this.current, false); this.appendLine(this.$(".inline .translated"), cue, this.current, true); this.$(".inline .translated").hidden = !cue.native; }
  }
  render() {
    const page = this.$(".page"); page.replaceChildren();
    this.root.querySelectorAll(".tabs button").forEach(node => node.setAttribute("aria-selected", String(node.dataset.tab === this.tab)));
    if (this.tab === "practice") {
      page.append(el("h2", "按自己的节奏"), el("p", "每个操作都可以点按完成。", { class: "tip" }));
      for (const [key, label] of [["enabled", "启用 Sunny 字幕"], ["blurNative", "先隐藏中文"], ["blurLearn", "先隐藏原文"], ["autoPause", "每句结束暂停"]]) {
        const row = el("div", undefined, { class: "setting" }), labelNode = el("label");
        const input = el("input", undefined, { type: "checkbox", "data-setting": key }); input.checked = this.settings[key];
        labelNode.append(input, el("span", label)); row.append(labelNode); page.append(row);
      }
      page.append(button("完整设置、语言与备份 ↗", "options"), button("重新读取视频字幕", "reload"));
      return;
    }
    if (this.tab === "vocabulary") {
      page.append(el("h2", "留下值得复习的词"), el("p", "本机保存；完整设置可导出 JSON。", { class: "tip" }));
      const rows = this.items || [];
      if (!rows.length) page.append(el("p", "点一个字幕单词，然后收藏。", { class: "empty" }));
      for (const item of rows.slice(0, 100)) {
        const row = el("article", undefined, { class: "term" }); row.append(el("strong", item.text), el("p", item.meaning), el("p", item.sentence, { class: "muted" }));
        row.append(button("移除", "remove", { "data-id": item.id }));
        try { const url = new URL(item.url); if (url.protocol === "https:" && /(^|\.)youtube\.com$/.test(url.hostname)) { url.searchParams.set("t", String(item.time)); row.append(el("a", " 视频来源 ↗", { href: url.href, target: "_blank", rel: "noopener noreferrer" })); } } catch (_) { /* A legacy item can have no URL. */ }
        page.append(row);
      }
      if (rows.length > 100) page.append(el("p", "此处展示最近 100 条，完整设置中可导出全部记录。", { class: "muted" }));
      return;
    }
    const tools = el("div", undefined, { class: "tools" });
    tools.append(button("选短语", "phrase", { "aria-pressed": String(this.phraseMode) }), button("回到当前句", "follow"), button("重新读取", "reload"));
    page.append(tools, el("p", "点词查中文 · 点时间回看 · 点首尾词选短语", { class: "tip" }));
    if (!this.cues.length) page.append(el("p", "打开有字幕的 YouTube 普通视频，再点重新读取。", { class: "empty" }));
    const list = el("div", undefined, { class: "transcript", role: "list" });
    this.cues.slice(this.page, this.page + 60).forEach((cue, offset) => {
      const index = this.page + offset; const row = el("article", undefined, { class: "cue" + (index === this.current ? " current" : ""), "data-row": index, role: "listitem" });
      row.append(button(formatTime(cue.start), "seek", { "data-cue": index, class: "time", "aria-label": "回看 " + formatTime(cue.start) }));
      const original = el("div", undefined, { class: "original" }), translated = el("div", undefined, { class: "translated" });
      this.appendLine(original, cue, index, false); this.appendLine(translated, cue, index, true); row.append(original, translated); list.append(row);
    }); page.append(list);
    if (this.cues.length > 60) {
      const paginator = el("div", undefined, { class: "paginator" }); paginator.append(button("更早的字幕", "page-prev"), button("后面的字幕", "page-next"));
      paginator.children[0].disabled = this.page === 0; paginator.children[1].disabled = this.page + 60 >= this.cues.length; page.append(paginator);
    }
    if (this.phraseMode) {
      const bar = el("div", undefined, { class: "phrase" }); bar.append(el("span", this.phraseText() || "先点首词，再点末词"), button("查短语", "phrase-confirm"), button("取消", "phrase-cancel"));
      bar.children[1].disabled = !this.phrase?.complete; page.append(bar);
    }
  }
  phraseText() {
    if (!this.phrase) return "";
    return tokenize(this.cues[this.phrase.cue].text).slice(Math.min(this.phrase.start, this.phrase.end), Math.max(this.phrase.start, this.phrase.end) + 1).map(row => row.text).join("");
  }
  async query(text, index) {
    this.video.pause(); this.closeCard(); this.setExpanded(true);
    const cue = this.cues[index]; if (!cue) return;
    const generation = ++this.queryGeneration;
    this.card = { text, cue, meaning: "", saved: false };
    const card = this.$(".lexicon"); card.hidden = false;
    const head = el("header", undefined, { class: "cardhead" }); head.append(el("h2", text), button("关闭", "close-card"));
    const meaning = el("p", "正在查询本机词库…", { class: "definition" }), context = el("p", cue.text, { class: "context" });
    const details = el("div", undefined, { class: "details" });
    const actions = el("div", undefined, { class: "cardactions" }); actions.append(button("收藏", "save"), button("发音", "speak"), button("英文词典", "english"), button("AI 解释", "ai"));
    const error = el("p", "", { class: "error", role: "status" }); card.append(head, meaning, context, actions, details, error);
    try {
      const result = await this.send("lookup", { text, lang: this.settings.learnLang });
      if (generation !== this.queryGeneration) return;
      this.card.meaning = result.kind === "bilingual" ? result.meaning : ""; this.card.saved = result.saved;
      meaning.textContent = result.meaning; actions.children[0].textContent = result.saved ? "已收藏 · 移除" : "收藏";
      if (result.source) details.append(el("p", "词义：ECDICT · MIT · 本机查询", { class: "source" }));
    } catch (failure) { if (generation === this.queryGeneration) meaning.textContent = failure.message; }
  }
  async extraLookup(kind) {
    if (!this.card) return;
    const generation = this.queryGeneration, card = this.card;
    this.$(".lexicon .error").textContent = "正在查询…";
    const result = await this.send(kind === "ai" ? "aiExplain" : "englishLookup", { text: card.text, sentence: card.cue.text, lang: this.settings.learnLang });
    if (generation !== this.queryGeneration) return;
    this.$(".lexicon .error").textContent = "";
    const details = this.$(".lexicon .details"); details.replaceChildren();
    if (kind === "ai") { details.append(el("p", result.text, { class: "definition" }), el("p", "AI · " + result.model, { class: "source" })); if (!card.meaning) card.meaning = result.text.slice(0, 4000); }
    else {
      for (const row of result.entries) details.append(el("p", row.part + " · " + row.text, { class: "definition" }));
      if (!result.entries.length) details.append(el("p", result.message || "没有找到对应释义"));
      details.append(el("a", "Wiktionary 来源 · CC BY-SA 4.0 ↗", { href: result.url, target: "_blank", rel: "noopener noreferrer", class: "source" }));
      if (!card.meaning && result.entries.length) card.meaning = result.entries.map(row => row.text).join("; ");
    }
  }
  async action(target) {
    const action = target.dataset.action;
    if (action === "expand") return this.setExpanded(this.$(".panel").dataset.expanded !== "true");
    if (action === "options") return this.send("openOptions");
    if (action === "reload") { this.notice("正在读取字幕…"); return this.onReload?.(); }
    if (action === "tab") { this.closeCard(); this.tab = target.dataset.tab; if (this.tab === "vocabulary") await this.refreshSaved(); this.render(); return; }
    if (action === "close-card") return this.closeCard();
    if (action === "play") { if (this.video.paused) await this.video.play(); else this.video.pause(); this.tick(); return; }
    if (["previous", "next", "replay", "seek"].includes(action)) {
      const at = this.current >= 0 ? this.current : Math.max(0, this.cues.findIndex(cue => cue.start >= this.video.currentTime));
      const index = action === "seek" ? Number(target.dataset.cue) : action === "previous" ? at - 1 : action === "next" ? at + 1 : at;
      if (!this.cues.length) return;
      const cue = this.cues[Math.max(0, Math.min(this.cues.length - 1, index))];
      this.nativeVisible = false; this.originalVisible = false; this.closeCard(); this.phrase = null;
      this.video.currentTime = cue.start + 0.01; this.current = -1; this.lastTime = this.video.currentTime; await this.video.play(); this.tick(true); return;
    }
    if (action.startsWith("reveal-")) {
      const index = Number(target.dataset.cue);
      if (index !== this.current) { this.notice("先点时间回到这一句，再揭晓字幕。"); return; }
      if (action === "reveal-native") this.nativeVisible = true; else this.originalVisible = true;
      this.render(); this.renderInline(); return;
    }
    if (action === "follow") { this.follow = true; this.page = Math.max(0, this.current - 10); this.render(); this.$(".cue.current")?.scrollIntoView({ block: "nearest" }); return; }
    if (action === "page-prev" || action === "page-next") { this.follow = false; this.page = Math.max(0, Math.min(Math.max(0, this.cues.length - 60), this.page + (action === "page-next" ? 50 : -50))); this.render(); return; }
    if (action === "phrase" || action === "phrase-cancel") { this.phraseMode = action === "phrase" ? !this.phraseMode : false; this.phrase = null; this.render(); return; }
    if (action === "word") {
      const cue = Number(target.dataset.cue), word = Number(target.dataset.word);
      if (this.phraseMode) {
        if (!this.phrase || this.phrase.cue !== cue || this.phrase.complete) this.phrase = { cue, start: word, end: word, complete: false };
        else { this.phrase.end = word; this.phrase.complete = true; }
        this.render(); this.renderInline(); return;
      }
      return this.query(target.textContent, cue);
    }
    if (action === "phrase-confirm" && this.phrase?.complete) { const text = this.phraseText(), index = this.phrase.cue; this.phraseMode = false; this.phrase = null; this.render(); return this.query(text, index); }
    if (action === "save" && this.card) {
      const result = await this.send("vocabToggle", { item: { text: this.card.text, lang: this.settings.learnLang, meaning: this.card.meaning,
        sentence: this.card.cue.text, sentenceNative: this.card.cue.native || "", site: "youtube", title: this.metadata?.title || document.title,
        url: "https://www.youtube.com/watch?v=" + encodeURIComponent(this.metadata?.id || ""), time: Math.floor(this.card.cue.start) } });
      if (this.card) { this.card.saved = result.saved; target.textContent = result.saved ? "已收藏 · 移除" : "收藏"; }
      await this.refreshSaved(); return;
    }
    if (action === "remove") { await this.send("vocabRemove", { id: target.dataset.id }); return this.refreshSaved(); }
    if (["english", "ai"].includes(action)) { try { await this.extraLookup(action); } catch (error) { if (this.card) this.$(".lexicon .error").textContent = error.message; } return; }
    if (action === "speak" && this.card) {
      if (!window.speechSynthesis) throw new Error("此浏览器暂不支持发音");
      const utterance = new SpeechSynthesisUtterance(this.card.text); utterance.lang = this.settings.learnLang; utterance.rate = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(utterance);
    }
  }
  tick(force = false) {
    if (!this.host.isConnected) return;
    const time = this.video.currentTime || 0, index = cueIndex(this.cues, time), prior = this.current;
    if (this.settings.autoPause && !this.video.paused && prior >= 0 && index !== prior && this.cues[prior] &&
        this.lastTime < this.cues[prior].end && time >= this.cues[prior].end && time - this.lastTime < 0.7) this.video.pause();
    this.lastTime = time;
    if (index !== this.current || force) {
      if (index !== this.current) { this.nativeVisible = false; this.originalVisible = false; this.phrase = null; }
      this.current = index;
      if (this.follow && index >= 0 && (index < this.page || index >= this.page + 50)) this.page = Math.max(0, index - 10);
      if (this.tab === "subtitles") this.render(); this.renderInline();
    }
    this.$(".status").textContent = !this.settings.enabled ? "字幕已关闭 · 在练习页启用" : this.cues.length ? `${Math.max(0, index + 1)} / ${this.cues.length} 句 · 本机生词` : "等待字幕 · 可点重新读取";
    this.$(".panel").setAttribute("aria-disabled", String(!this.settings.enabled));
    this.$(".play").textContent = this.video.paused ? "播放" : "暂停";
    const rect = this.video.getBoundingClientRect(), layer = this.$(".inline"), panel = this.$(".panel").getBoundingClientRect();
    let width = rect.width - 16;
    if (innerWidth > 700 && panel.left > rect.left + 200 && panel.left < rect.right && panel.top < rect.bottom) width = Math.min(width, panel.left - rect.left - 20);
    layer.style.left = Math.max(8, rect.left + 8) + "px"; layer.style.width = Math.max(160, width) + "px";
    layer.style.bottom = Math.max(12, innerHeight - Math.min(innerHeight, rect.bottom) + 45) + "px";
    layer.style.setProperty("--caption-size", Math.min(28, Math.max(17, width / 35)) * this.settings.fontScale + "px");
    if (rect.width < 80 || rect.bottom < 0 || rect.top > innerHeight) layer.hidden = true;
    const fullscreen = document.fullscreenElement;
    const parent = fullscreen && fullscreen !== this.video ? fullscreen : document.body;
    if (this.host.parentNode !== parent) parent.append(this.host);
  }
  destroy() { clearInterval(this.timer); this.queryGeneration++; this.video.removeEventListener("seeking", this.seeking); document.removeEventListener("keydown", this.keydown); this.host.remove(); }
}
