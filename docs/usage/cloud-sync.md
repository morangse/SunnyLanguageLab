# 可选：跨设备同步与 Obsidian 归档

基础字幕练习、离线收藏和 JSON 备份无需部署服务。只有想在多台设备共用词库时才需要本篇。当前是**个人单用户服务**，不是面向公众的多用户网站。

数据路线：设备本地词库 ↔ 你自己的 Cloudflare Worker + D1 → 你自己的 GitHub 归档仓库 → 你现有的 Obsidian 同步方式。Obsidian 的编辑不会反向写回扩展。

## 准备

需要 Cloudflare 账户、Node.js 24、GitHub 账户和一个已初始化的词库仓库。建议词库仓库设为私有。代码仓库可以公开，但个人生词、上下文和视频链接未必适合公开。各服务额度和计费以账户页面为准。

本教程没有替你部署任何服务。不要把真实凭据提交到代码仓库或贴进公开 Issue。

## 1. 创建数据库

在源码 `server/` 目录运行：

```sh
npm ci
npx wrangler login
npx wrangler whoami
npx wrangler d1 create sunny-language-sync
```

登录在 Cloudflare 官方授权页完成。编辑 `wrangler.jsonc`：把数据库 ID 填入 `database_id`，替换占位符。多个账户时核对 `account_id`。

## 2. 指定自己的归档目标

编辑同一配置中的变量：

```json
{
  "ARCHIVE_REPO": "YOUR_GITHUB_USERNAME/YOUR_VOCAB_REPO",
  "ARCHIVE_BRANCH": "main",
  "ARCHIVE_PREFIX": "SunnyLanguageLab"
}
```

把仓库占位符换成自己的 `用户名/仓库名`。目标分支必须已经存在。`ARCHIVE_PREFIX` 是专用子目录，扩展只维护其中 `生词本.md` 和 `vocab.json`；复习笔记另建文件。代码不再包含维护者私人词库仓库的默认地址。

## 3. 设置口令并部署

```sh
npx wrangler d1 migrations apply DB --remote
node -e "console.log(crypto.randomBytes(32).toString('base64url'))"
npx wrangler secret put SYNC_TOKEN
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

生成的随机字符串作为个人同步口令，保存在自己的密码管理器，再输入 `SYNC_TOKEN` 提示。不要使用账户登录密码。

`GITHUB_TOKEN` 使用 GitHub fine-grained token，只选择自己的词库归档仓库，授予 Contents 读写权限并设置合理有效期。输入 Worker secret 提示，不能填写到浏览器扩展中。到期后替换 Worker secret。只需双向设备同步时可以暂不设置 GitHub token，归档会不可用。

部署得到 `https://你的服务.账户子域.workers.dev`。当前扩展只接受 HTTPS `workers.dev` 服务地址，不支持自定义域名。构建 ZIP 和工作流 dry-run 不会部署 Worker、创建账户或自动设置 secret。

## 4. 两端连接

1. 在每台设备完整设置页输入同一个 Worker 地址、同一个同步口令，点「保存并连接」。Safari 按提示允许服务域名访问。
2. 设备 A 收藏一个测试词并点「立即同步」；设备 B 也点同步，检查是否出现。
3. 删除测试词并再次同步，确认另一端也移除。需要恢复时主动重新收藏。
4. 点「立即归档到 Obsidian」，检查配置目录中是否出现两个自动文件。
5. Obsidian 继续用你已有方式读取该 GitHub 仓库；本项目没有安装或替换 Obsidian 同步插件。

## 时机、限制与恢复

收藏、删除后会尝试同步，浏览器启动及可运行的后台约每五分钟重试。Safari 休眠、后台被暂停或浏览器关闭会延迟，回设置页立即同步补齐。未上传的设备数据不会自行出现在云端。

Worker 每 15 分钟尝试归档，数据未变时不产生提交。归档失败不影响本机收藏或设备同步；先查设置页错误、GitHub token、目标仓库分支和路径。

单次上传最多 25 条，下载每页最多 200 条；初次迁移分批完成。同词并发修改按逻辑版本和设备标识得到稳定结果。自动归档上限为 10,000 条记录（含删除记录）、生成内容合计 8MB，超出会报错，不删除生词。

服务口令等同个人词库访问权限。要撤销旧设备，替换 Worker 的 `SYNC_TOKEN` 并更新保留设备。断开连接不会删除 D1、GitHub 文件或历史。需要清理云端时先备份，再由账户所有者处理。

## 官方参考

- [Cloudflare Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [D1 迁移](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cron 定时触发](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [GitHub fine-grained token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
