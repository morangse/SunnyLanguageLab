import { skin } from "./skin.js";
import { cueIndex, tokenize } from "./subtitles.js";
import { loadWordRanks, vocabularyTier } from "./word-levels.js";

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
    this.pointerKind = "mouse"; this.hoverPlaying = false; this.drag = null;
    this.host = el("div"); this.host.id = "sunny-study-surface";
    this.host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000";
    this.root = this.host.attachShadow({ mode: "closed" });
    this.root.innerHTML = `<style>${skin}</style><div class="inline" hidden><div class="inline-line original"></div><div class="inline-line translated"></div></div>
      <button type="button" class="launcher" data-action="expand" aria-expanded="false" aria-label="打开 Sunny 学习面板" title="Sunny · 字幕、生词、AI 与同步（T）">☀</button>
      <aside class="panel" data-expanded="false" aria-label="Sunny 语言练习"><header class="head"><span class="mark" aria-hidden="true">☀</span><div class="identity"><b class="brand">SUNNY / STUDY</b><span class="status" role="status">等待字幕</span></div><button type="button" data-action="options" aria-label="打开完整设置">设置 ↗</button><button type="button" data-action="collapse" aria-label="收起学习面板">×</button></header>
      <p class="notice" role="status" hidden></p><nav class="tabs" aria-label="学习面板"><button type="button" data-action="tab" data-tab="subtitles" aria-selected="true">字幕</button><button type="button" data-action="tab" data-tab="vocabulary" aria-selected="false">生词</button><button type="button" data-action="tab" data-tab="practice" aria-selected="false">练习</button></nav><div class="body"><section class="page"></section><section class="lexicon" hidden aria-label="查词"></section></div>
      <footer class="transport" aria-label="逐句播放"><button type="button" data-action="previous">← 上句</button><button type="button" data-action="replay">↻ 重播</button><button type="button" class="play" data-action="play">播放</button><button type="button" data-action="next">下句 →</button></footer></aside>`;
    this.$ = selector => this.root.querySelector(selector);
    // A lookup card is independent of the transcript, so querying a subtitle never opens a large panel.
    this.root.append(this.$(".lexicon"));
    this.$(".tabs").append(button("AI / 同步", "tab", { "data-tab": "settings", "aria-selected": "false" }));
    this.click = event => { const target = event.target.closest("button"); if (target && !(target.dataset.action === "word" && Date.now() < this.suppressClickUntil)) void this.action(target).catch(error => this.notice(error.message)); };
    this.root.addEventListener("click", this.click);
    this.root.addEventListener("pointerdown", event => {
      this.pointerKind = event.pointerType || "mouse";
      const word = event.target.closest(".word");
      if (word && this.pointerKind === "mouse" && event.button === 0 && !this.phraseMode) {
        event.preventDefault(); this.drag = { cue: Number(word.dataset.cue), start: Number(word.dataset.word), end: Number(word.dataset.word), target: word };
      }
    });
    this.root.addEventListener("pointerover", event => {
      if (event.pointerType !== "mouse") return;
      const word = event.target.closest(".word"), line = event.target.closest(".inline-line");
      if (this.drag && word && Number(word.dataset.cue) === this.drag.cue) {
        this.drag.end = Number(word.dataset.word); this.paintDrag();
      }
      if (line && !line.contains(event.relatedTarget) && this.settings.hoverPause && !this.video.paused) { this.hoverPlaying = true; this.video.pause(); }
      if (event.target.closest(".reveal")) void this.action(event.target.closest(".reveal"));
    });
    this.root.addEventListener("pointerout", event => {
      const line = event.target.closest(".inline-line");
      if (event.pointerType === "mouse" && line && !line.contains(event.relatedTarget)) {
        if (this.hoverPlaying && !this.card && !this.drag && !this.settings.autoPause) void this.video.play().catch(() => {});
        this.hoverPlaying = false;
      }
    });
    this.pointerUp = event => {
      const drag = this.drag; this.drag = null;
      if (!drag) return;
      if (event.type !== "pointercancel" && drag.start !== drag.end) {
        this.suppressClickUntil = Date.now() + 500;
        const text = tokenize(this.cues[drag.cue].text).slice(Math.min(drag.start, drag.end), Math.max(drag.start, drag.end) + 1).map(token => token.text).join("");
        void this.query(text, drag.cue, drag.target).catch(error => this.notice(error.message));
      }
      this.root.querySelectorAll(".drag-selected").forEach(node => node.classList.remove("drag-selected"));
    };
    document.addEventListener("pointerup", this.pointerUp); document.addEventListener("pointercancel", this.pointerUp);
    this.seeking = () => { this.nativeVisible = false; this.originalVisible = false; this.current = -1; this.lastTime = this.video.currentTime; this.closeCard(); this.phrase = null; this.tick(true); };
    this.video.addEventListener("seeking", this.seeking);
    this.keydown = event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT|IFRAME/.test(this.root.activeElement?.tagName) || this.root.activeElement?.isContentEditable || event.composedPath().some(node => /INPUT|TEXTAREA|SELECT|IFRAME/.test(node?.tagName) || node?.isContentEditable)) return;
      this.hoverPlaying = false;
      const actions = { a: "previous", s: "replay", d: "next", t: "expand", g: "options", Escape: "close-card" };
      const action = actions[event.key] || actions[event.key.toLowerCase()];
      if (action) { event.preventDefault(); void this.action(button("", action)).catch(error => this.notice(error.message)); }
      else if (["q", "e"].includes(event.key.toLowerCase())) { event.preventDefault(); void this.preference(event.key.toLowerCase() === "q" ? "autoPause" : "blurNative"); }
      else if (event.key.toLowerCase() === "h") { event.preventDefault(); void this.preference("vocabHighlight"); }
    };
    document.addEventListener("keydown", this.keydown);
    this.root.addEventListener("change", event => { const key = event.target.dataset.setting; if (key) void this.preference(key, event.target.type === "checkbox" ? event.target.checked : event.target.value); });
    this.$(".body").addEventListener("wheel", () => { this.follow = false; }, { passive: true });
    this.$(".body").addEventListener("touchmove", () => { this.follow = false; }, { passive: true });
    document.body.append(this.host);
    this.timer = setInterval(() => this.tick(), 120);
    this.render(); void this.refreshSaved();
    void loadWordRanks().then(ranks => { if (!this.host.isConnected) return; this.ranks = ranks; if (this.tab !== "settings") this.render(); this.renderInline(); }).catch(() => this.notice("词频标记数据读取失败，刷新页面可重试；查词仍可使用。"));
  }
  paintDrag() {
    this.root.querySelectorAll(".word").forEach(node => node.classList.toggle("drag-selected", Number(node.dataset.cue) === this.drag.cue && Number(node.dataset.word) >= Math.min(this.drag.start, this.drag.end) && Number(node.dataset.word) <= Math.max(this.drag.start, this.drag.end)));
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
    this.$(".panel").dataset.expanded = String(open);
    this.$(".launcher").setAttribute("aria-expanded", String(open));
    this.$(".launcher").setAttribute("aria-label", open ? "收起 Sunny 学习面板" : "打开 Sunny 学习面板");
    if (open) this.render(); else { this.closeCard(); this.$(".launcher").focus({ preventScroll: true }); }
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
      const tier = vocabularyTier(token.text, this.settings, this.ranks);
      if (tier) { target.dataset.tier = tier; target.dataset.mark = this.settings.vocabStyle; target.title = ["", "常用进阶词", "中阶词", "高阶词", "低频词"][tier] + " · 词频参考"; }
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
    layer.dataset.backdrop = this.settings.subtitleBackdrop;
  }
  render() {
    this.$(".panel").dataset.tab = this.tab;
    const page = this.$(".page"); page.replaceChildren();
    this.root.querySelectorAll(".tabs button").forEach(node => node.setAttribute("aria-selected", String(node.dataset.tab === this.tab)));
    if (this.tab === "settings") {
      page.append(el("h2", "AI 与跨设备同步"), el("p", "配置保存在插件自己的设置页，字幕网页读不到密钥。", { class: "tip" }));
      const links = el("div", undefined, { class: "tools" });
      links.append(button("AI 接入", "configure", { "data-section": "ai" }), button("同步 / Obsidian", "configure", { "data-section": "sync" }), button("完整设置 ↗", "options")); page.append(links);
      const frame = el("iframe", undefined, { class: "settings-frame", title: "Sunny AI 与同步设置" });
      const base = globalThis.chrome?.runtime?.getURL ? chrome.runtime.getURL("src/options/options.html") : new URL("../options/options.html", import.meta.url).href;
      frame.src = base + "?embedded=1#" + (this.configSection || "ai"); page.append(frame); return;
    }
    if (this.tab === "practice") {
      page.append(el("h2", "按自己的节奏"), el("p", "电脑可拖选短语、悬停暂停；触屏可点按首尾词。", { class: "tip" }));
      for (const [key, label] of [["enabled", "启用 Sunny 字幕"], ["blurNative", "先隐藏中文"], ["blurLearn", "先隐藏原文"], ["autoPause", "每句结束暂停"], ["hoverPause", "鼠标悬停字幕时暂停"], ["vocabHighlight", "按词汇量分级标记（H）"]]) {
        const row = el("div", undefined, { class: "setting" }), labelNode = el("label");
        const input = el("input", undefined, { type: "checkbox", "data-setting": key }); input.checked = this.settings[key];
        labelNode.append(input, el("span", label)); row.append(labelNode); page.append(row);
      }
      for (const [key, label, choices] of [["vocabLevel", "我的词汇量基准", [["2500", "2500 词"], ["4500", "4500 词"], ["6500", "6500 词"], ["9000", "9000 词"], ["all", "全部等级"]]], ["vocabStyle", "单词标记", [["underline", "彩色下划线"], ["pill", "柔和底色"], ["text", "彩色文字"]]], ["fontScale", "字幕大小", [["0.8", "稍小"], ["1", "标准"], ["1.25", "稍大"], ["1.5", "大号"]]], ["subtitleBackdrop", "字幕背景", [["soft", "轻薄暗底"], ["none", "透明 / 文字描边"], ["solid", "深色底板"]]]]) {
        const row = el("label", label, { class: "setting" }), select = el("select", undefined, { "data-setting": key });
        for (const [value, text] of choices) select.append(el("option", text, { value })); select.value = String(this.settings[key]); row.append(select); page.append(row);
      }
      page.append(el("p", "绿 / 蓝 / 紫 / 红：常用进阶至低频词。金色：已收藏。等级依据 ECDICT 词频，仅作学习参考。", { class: "tip" }));
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
  async query(text, index, anchor) {
    this.hoverPlaying = false; this.video.pause(); this.closeCard();
    const cue = this.cues[index]; if (!cue) return;
    const generation = ++this.queryGeneration;
    this.card = { text, cue, meaning: "", saved: false };
    const card = this.$(".lexicon"); card.hidden = false;
    const rect = anchor?.getBoundingClientRect() || this.$(".inline").getBoundingClientRect();
    const desktop = this.pointerKind !== "touch" && matchMedia("(hover:hover) and (pointer:fine)").matches;
    card.dataset.desktop = String(desktop);
    if (desktop) { card.style.left = Math.max(8, Math.min(innerWidth - Math.min(360, innerWidth - 16) - 8, rect.left)) + "px"; card.style.top = Math.max(8, Math.min(innerHeight - Math.min(380, innerHeight - 16) - 8, rect.bottom + 8)) + "px"; }
    else { card.style.left = ""; card.style.top = ""; }
    const head = el("header", undefined, { class: "cardhead" }); head.append(el("h2", text), button("关闭", "close-card"));
    const meaning = el("p", "正在查询本机词库…", { class: "definition" }), context = el("p", cue.text, { class: "context" });
    const details = el("div", undefined, { class: "details" });
    const actions = el("div", undefined, { class: "cardactions" }); actions.append(button("收藏", "save"), button("发音", "speak"), button("英文词典", "english"), button("AI 解释", "ai"), button("AI 设置", "configure", { "data-section": "ai" }));
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
    if (action === "collapse") return this.setExpanded(false);
    if (action === "configure") { this.configSection = target.dataset.section === "sync" ? "sync" : "ai"; this.closeCard(); this.tab = "settings"; this.setExpanded(true); return; }
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
      return this.query(target.textContent, cue, target);
    }
    if (action === "phrase-confirm" && this.phrase?.complete) { const text = this.phraseText(), index = this.phrase.cue; this.phraseMode = false; this.phrase = null; this.render(); return this.query(text, index); }
    if (action === "save" && this.card) {
      const result = await this.send("vocabToggle", { item: { text: this.card.text, lang: this.settings.learnLang, meaning: this.card.meaning,
        sentence: this.card.cue.text, sentenceNative: this.card.cue.native || "", site: "youtube", title: this.metadata?.title || document.title,
        url: "https://www.youtube.com/watch?v=" + encodeURIComponent(this.metadata?.id || ""), time: Math.floor(this.card.cue.start) } });
      if (this.card) { this.card.saved = result.saved; target.textContent = result.saved ? "已收藏 · 移除" : "收藏"; }
      await this.refreshSaved(); this.renderInline(); if (this.tab === "subtitles") this.render(); return;
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
    if (!this.drag && (index !== this.current || force)) {
      if (index !== this.current) { this.nativeVisible = false; this.originalVisible = false; this.phrase = null; }
      this.current = index;
      if (this.follow && index >= 0 && (index < this.page || index >= this.page + 50)) this.page = Math.max(0, index - 10);
      if (this.tab === "subtitles") this.render(); this.renderInline();
    }
    this.$(".status").textContent = !this.settings.enabled ? "字幕已关闭 · 在练习页启用" : this.cues.length ? `${Math.max(0, index + 1)} / ${this.cues.length} 句 · 本机生词` : "等待字幕 · 可点重新读取";
    this.$(".panel").setAttribute("aria-disabled", String(!this.settings.enabled));
    this.$(".play").textContent = this.video.paused ? "播放" : "暂停";
    const rect = this.video.getBoundingClientRect(), layer = this.$(".inline"), panel = this.$(".panel").getBoundingClientRect();
    const launcher = this.$(".launcher");
    launcher.hidden = rect.width < 80 || rect.bottom < 44 || rect.top > innerHeight - 44;
    launcher.style.left = Math.max(8, Math.min(innerWidth - 56, rect.right - 56)) + "px";
    launcher.style.top = Math.max(8, Math.min(innerHeight - 56, rect.top + 12)) + "px";
    const card = this.$(".lexicon");
    if (!card.hidden && card.dataset.desktop === "true") {
      const box = card.getBoundingClientRect();
      card.style.left = Math.max(8, Math.min(innerWidth - box.width - 8, box.left)) + "px";
      card.style.top = Math.max(8, Math.min(innerHeight - box.height - 8, box.top)) + "px";
    }
    let width = rect.width - 16;
    if (this.$(".panel").dataset.expanded === "true" && innerWidth > 700 && panel.left > rect.left + 200 && panel.left < rect.right && panel.top < rect.bottom) width = Math.min(width, panel.left - rect.left - 20);
    layer.style.left = Math.max(8, rect.left + 8) + "px"; layer.style.width = Math.max(160, width) + "px";
    layer.style.bottom = Math.max(12, innerHeight - Math.min(innerHeight, rect.bottom) + 45) + "px";
    layer.style.setProperty("--caption-size", Math.min(28, Math.max(17, width / 35)) * this.settings.fontScale + "px");
    if (rect.width < 80 || rect.bottom < 0 || rect.top > innerHeight) layer.hidden = true;
    const fullscreen = document.fullscreenElement;
    const parent = fullscreen && fullscreen !== this.video ? fullscreen : document.body;
    if (this.host.parentNode !== parent) parent.append(this.host);
  }
  destroy() { clearInterval(this.timer); this.queryGeneration++; this.video.removeEventListener("seeking", this.seeking); document.removeEventListener("keydown", this.keydown); document.removeEventListener("pointerup", this.pointerUp); document.removeEventListener("pointercancel", this.pointerUp); this.host.remove(); }
}
