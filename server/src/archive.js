function markdownText(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/([\\`*_{}\[\]()#+.!|~-])/g, "\\$1").replace(/\r?\n/g, " ");
}
function sourceLink(record) {
  try {
    const url = new URL(record.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (/(^|\.)youtube\.com$/.test(url.hostname)) url.searchParams.set("t", String(record.time || 0));
    return "[打开原视频](<" + url.href.replace(/</g, "%3C").replace(/>/g, "%3E") + ">)";
  } catch (_) { return ""; }
}

export function buildArchive(records, revision) {
  const active = records.filter(r => !r.deleted).sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id));
  const lines = ["# SunnyLanguageLab 生词本", "", "> 此文件由 Sunny 自动归档。复习笔记请写在其他文件中，以免下次归档被覆盖。", "",
    "当前生词：" + active.length + "；已移除记录：" + (records.length - active.length) + "。", ""];
  for (const record of active) {
    lines.push("## " + markdownText(record.text), "", "- 语言：" + markdownText(record.lang),
      "- 释义：" + markdownText(record.meaning || "暂无释义"));
    if (record.sentence) lines.push("- 原句：" + markdownText(record.sentence));
    if (record.sentenceNative) lines.push("- 译文：" + markdownText(record.sentenceNative));
    if (record.title) lines.push("- 来源：" + markdownText(record.title));
    const link = sourceLink(record);
    if (link) lines.push("- 回看：" + link);
    lines.push("- 收藏：" + new Date(record.savedAt).toISOString().slice(0, 10), "");
  }
  lines.push("---", "", "词典来源：ECDICT 英汉词库（MIT）、Wiktionary（CC BY-SA 4.0）；AI 解释由用户选择的服务提供。原句与来源链接仅供个人学习。", "");
  return {
    "生词本.md": lines.join("\n"),
    "vocab.json": JSON.stringify({ app: "SunnyLanguageLab", schema: 1, revision, records }, null, 2) + "\n"
  };
}

export async function githubArchive(env, files, revision, fetcher = fetch) {
  const repo = String(env.ARCHIVE_REPO || "").trim();
  const branch = env.ARCHIVE_BRANCH || "main";
  const prefix = env.ARCHIVE_PREFIX || "SunnyLanguageLab";
  if (!repo || repo.startsWith("YOUR_") || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w./-]+$/.test(branch) || branch.includes("..") ||
      prefix.startsWith("/") || prefix.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("归档路径配置无效");
  }
  const api = "https://api.github.com/repos/" + repo;
  async function call(path, method = "GET", body) {
    const response = await fetcher(api + path, {
      method, redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { "Authorization": "Bearer " + env.GITHUB_TOKEN, "Accept": "application/vnd.github+json",
        "Content-Type": "application/json", "User-Agent": "SunnyLanguageLab-Archive/0.6", "X-GitHub-Api-Version": "2022-11-28" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      const error = new Error("GitHub 归档失败（" + response.status + "），请检查仓库授权或稍后重试");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }
  const tree = Object.entries(files).map(([name, content]) => ({ path: prefix + "/" + name, mode: "100644", type: "blob", content }));
  for (let attempt = 0; attempt < 3; attempt++) {
    const head = await call("/git/ref/heads/" + branch.split("/").map(encodeURIComponent).join("/"));
    const base = await call("/git/commits/" + head.object.sha);
    const nextTree = await call("/git/trees", "POST", { base_tree: base.tree.sha, tree });
    if (nextTree.sha === base.tree.sha) return;
    const commit = await call("/git/commits", "POST", { message: "Archive Sunny vocabulary (revision " + revision + ")",
      tree: nextTree.sha, parents: [head.object.sha] });
    try {
      await call("/git/refs/heads/" + branch.split("/").map(encodeURIComponent).join("/"), "PATCH", { sha: commit.sha, force: false });
      return;
    } catch (error) {
      // Rebase the two managed files on the new head; never force-push over Obsidian edits.
      if (![409, 422].includes(error.status) || attempt === 2) throw error;
    }
  }
}

export async function archiveStatus(db) {
  const row = await db.prepare("SELECT revision, archived_at, last_error FROM archive_state WHERE singleton = 1").first();
  return { revision: row.revision, at: row.archived_at, error: row.last_error };
}

export async function exportToGitHub(env, fetcher = fetch) {
  const db = env.DB.withSession ? env.DB.withSession("first-primary") : env.DB;
  if (!env.GITHUB_TOKEN) {
    await db.prepare("UPDATE archive_state SET last_error = ? WHERE singleton = 1").bind("尚未配置 GitHub 归档授权").run();
    return archiveStatus(db);
  }
  const lock = crypto.randomUUID();
  const now = Date.now();
  const acquired = await db.prepare("UPDATE archive_state SET lock_id = ?, lock_until = ? WHERE singleton = 1 AND lock_until < ?")
    .bind(lock, now + 600000, now).run();
  if (!acquired.meta.changes) return { ...await archiveStatus(db), busy: true };
  try {
    const snapshot = await db.batch([
      db.prepare("SELECT COALESCE(MAX(seq), 0) AS revision FROM vocabulary"),
      db.prepare("SELECT payload FROM vocabulary ORDER BY id LIMIT 10001"),
      db.prepare("SELECT revision FROM archive_state WHERE singleton = 1")
    ]);
    const revision = snapshot[0].results[0].revision;
    if (revision === snapshot[2].results[0].revision) {
      await db.prepare("UPDATE archive_state SET last_error = '' WHERE singleton = 1 AND lock_id = ?").bind(lock).run();
      return archiveStatus(db);
    }
    const records = snapshot[1].results.map(row => JSON.parse(row.payload));
    if (records.length > 10000) throw new Error("归档超过 10000 条，请先导出 JSON 备份并联系维护者扩容");
    const files = buildArchive(records, revision);
    if (new TextEncoder().encode(Object.values(files).join("")).length > 8000000) throw new Error("归档超过 8MB，请先导出 JSON 备份并联系维护者扩容");
    await githubArchive(env, files, revision, fetcher);
    await db.prepare("UPDATE archive_state SET revision = ?, archived_at = ?, last_error = '' WHERE singleton = 1 AND lock_id = ?")
      .bind(revision, Date.now(), lock).run();
    return archiveStatus(db);
  } catch (error) {
    const message = /^GitHub 归档失败|^归档/.test(error.message) ? error.message : "归档暂时失败，稍后会自动重试";
    await db.prepare("UPDATE archive_state SET last_error = ? WHERE singleton = 1 AND lock_id = ?").bind(message, lock).run();
    return archiveStatus(db);
  } finally {
    await db.prepare("UPDATE archive_state SET lock_id = '', lock_until = 0 WHERE singleton = 1 AND lock_id = ?").bind(lock).run();
  }
}
