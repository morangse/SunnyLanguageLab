import test from "node:test";
import assert from "node:assert/strict";
import { database, record } from "./helpers.js";
import { synchronize } from "../server/src/index.js";
import { buildArchive, githubArchive, exportToGitHub, archiveStatus } from "../server/src/archive.js";

test("archive escapes source text, suppresses unsafe URLs and excludes deleted terms from Markdown", () => {
  const files = buildArchive([
    record("<script>alert(1)</script>", 1, undefined, { sentence: "[[embedded]] ![x](javascript:evil)", url: "javascript:alert(1)" }),
    record("deleted", 2, undefined, { deleted: true })
  ], 2);
  assert.ok(!files["生词本.md"].includes("<script>"));
  assert.ok(!files["生词本.md"].includes("## deleted"));
  assert.ok(!files["生词本.md"].includes("[打开原视频](<javascript:"));
  assert.ok(files["生词本.md"].includes("\\[\\[embedded\\]\\]"));
  const data = JSON.parse(files["vocab.json"]);
  assert.equal(data.records.length, 2);
  assert.equal(data.records[1].deleted, true);
});

test("GitHub archive atomically updates only two managed files and rebases a branch race without force", async () => {
  const calls = [];
  let updates = 0;
  const fetcher = async (url, options) => {
    const body = options.body && JSON.parse(options.body);
    calls.push({ url, method: options.method, body });
    if (url.includes("/git/ref/heads/")) return Response.json({ object: { sha: updates ? "new-head" : "old-head" } });
    if (url.includes("/git/commits/") && options.method === "GET") return Response.json({ tree: { sha: "base-tree" } });
    if (url.endsWith("/git/trees")) return Response.json({ sha: "next-tree" });
    if (url.endsWith("/git/commits")) return Response.json({ sha: "commit" });
    if (url.includes("/git/refs/heads/")) {
      updates++;
      return updates === 1 ? Response.json({ message: "non-fast-forward" }, { status: 422 }) : Response.json({});
    }
    throw new Error("unexpected URL");
  };
  await githubArchive({ GITHUB_TOKEN: "secret", ARCHIVE_REPO: "example-user/vocabulary-archive" }, buildArchive([record("hello")], 1), 1, fetcher);
  assert.equal(updates, 2);
  assert.deepEqual(calls.filter(c => c.url.endsWith("/git/trees"))[0].body.tree.map(t => t.path), [
    "SunnyLanguageLab/生词本.md", "SunnyLanguageLab/vocab.json"]);
  assert.ok(calls.filter(c => c.method === "PATCH").every(c => c.body.force === false));
  assert.deepEqual(calls.filter(c => c.url.endsWith("/git/commits")).at(-1).body.parents, ["new-head"]);
});

test("archive retries after failure, saves revision only after success, and skips unchanged data", async () => {
  const db = database();
  try {
    await synchronize(db, { schema: 1, cursor: 0, records: [record("archive")] });
    const env = { DB: db, GITHUB_TOKEN: "secret", ARCHIVE_REPO: "example-user/vocabulary-archive" };
    let calls = 0;
    const failed = await exportToGitHub(env, async () => { calls++; return Response.json({}, { status: 403 }); });
    assert.equal(failed.revision, 0);
    assert.match(failed.error, /403/);
    const fetcher = async (url, options) => {
      calls++;
      if (url.includes("/git/ref/heads/")) return Response.json({ object: { sha: "head" } });
      if (url.includes("/git/commits/") && options.method === "GET") return Response.json({ tree: { sha: "base" } });
      return Response.json({ sha: "new" });
    };
    const result = await exportToGitHub(env, fetcher);
    assert.ok(result.revision > 0);
    assert.ok(result.at > 0);
    assert.equal(result.error, "");
    const before = calls;
    await exportToGitHub(env, fetcher);
    assert.equal(calls, before);
  } finally { db.close(); }
});

test("overlapping cron/manual archives respect a database lease", async () => {
  const db = database();
  try {
    await synchronize(db, { schema: 1, cursor: 0, records: [record("lock")] });
    await db.prepare("UPDATE archive_state SET lock_id = ?, lock_until = ? WHERE singleton = 1").bind("other", Date.now() + 60000).run();
    const result = await exportToGitHub({ DB: db, GITHUB_TOKEN: "secret", ARCHIVE_REPO: "example-user/vocabulary-archive" }, async () => { throw new Error("must not call GitHub"); });
    assert.equal(result.busy, true);
    assert.equal((await archiveStatus(db)).revision, 0);
  } finally { db.close(); }
});

test("archive requires an explicitly configured repository before contacting GitHub", async () => {
  for (const repo of [undefined, "YOUR_GITHUB_USERNAME/YOUR_VOCAB_REPO"]) {
    let contacted = false;
    await assert.rejects(githubArchive({ GITHUB_TOKEN: "secret", ARCHIVE_REPO: repo }, {}, 1,
      async () => { contacted = true; return Response.json({}); }), /配置无效/);
    assert.equal(contacted, false);
  }
});
