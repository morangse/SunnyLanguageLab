# 开发与打包

使用 Python 3 和 Node.js 24，根目录没有前端依赖。Worker 依赖单独安装；只有重新生成图标才需要 Pillow。

```sh
node --test tests/*.test.js
python scripts/build_variants.py
python scripts/check_docs.py
python scripts/check_release_ready.py
python scripts/package_source.py
```

`dist/chrome/` 和 `dist/safari/` 使用同一新客户端。两端均含词库，Chrome 额外申请 `unlimitedStorage`。Safari 资源需要 Xcode 转换、签名后安装，见 [iPad](install/ipad.md) / [Mac](install/macos.md)。

```sh
cd server
npm ci
npx wrangler deploy --dry-run
```

这只构建 Worker，不会登录、创建数据库或部署。真实部署见 [个人同步](usage/cloud-sync.md)。

## 交互模拟

根目录运行 `python -m http.server 8767 --bind 127.0.0.1`，打开 `http://127.0.0.1:8767/tests/fixtures/study.html`。加载同目录 `study-checks.js` 后调用 `runStudyChecks()`，验证字幕隐藏、重播、桌面拖选与悬停、触屏短语、查词、收藏、小图标收起和设置入口（32 项）。真实 Safari 和 YouTube 要另行测试。

## 源码与资源

入口是 `content/entry.js`，响应式面板为 `surface.js` / `skin.js`。页面桥接只传字幕数据，不传扩展存储；动态内容使用文本节点，不将远端词典或 AI 内容直接作为 HTML。

词库生成脚本固定 ECDICT 来源并随包保留许可；`python scripts/build_word_ranks.py --csv <固定源文件>` 从同一 CSV 重建词频标记；图标由 `scripts/generate_icons.py` 从原创几何形状生成，SVG 源位于 `extension/icons/sunny.svg`。不要将旧 ZIP 或旧客户端重新复制进公开版本。

## Actions

PR / 源码推送运行 Linux 测试、Worker dry-run、文档与语法检查、双包和源码快照打包。手动运行、版本标签或包含 `[build-ios]` 的提交额外构建未签名 iPhone / iPad 应用。版本标签只生成草稿预发行版；源码许可完整与真机验证是不同事项。
