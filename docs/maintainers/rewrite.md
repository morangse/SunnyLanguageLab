# v0.6 独立重写记录

日期：2026-10-29。目标是根据已有功能要求重新实现客户端，并形成可以单独授权的公开快照；不是通过改名或删注释处理旧代码。

## 新写的部分

- `extension/src/content/subtitles.js`：字幕规范化、JSON3 / VTT / XML 读取、时间索引与译文对齐。
- `extension/src/page/youtube-bridge.js` 和 `content/youtube.js`：受限字幕通信、轨道选择与页面读取。
- `content/surface.js`、`skin.js`、`study.js`、`entry.js`：响应式面板、点按揭晓、短语选择、词卡、生词视图、播放控制与页面生命周期。
- `background/cache.js`、`network.js`、`wiktionary.js`、`llm.js`、`settings.js`、`service-worker.js`：缓存、在线内容、AI、偏好与受限消息路由。
- `options/` 与 `action/` 的页面、样式、脚本；图标 PNG 与 `sunny.svg`；新打包脚本与回归测试。

## 保留的本项目模块

此前为本项目独立编写的 `shared/sync-model.js`、`background/vocab-store.js`、`sync.js`、`chinese-dictionary.js`、`options/sync-ui.js`，以及 `server/` 和对应同步测试。它们保留已有数据协议，帮助导入旧生词。原始 AI 密钥不自动迁移；0.6.1 可由用户在可信设置页主动恢复同一安装中仍保留的旧密钥，不向字幕网页回传值。

## 有许可的数据

ECDICT 数据和许可保留，在线 Wiktionary 内容仍遵循内容许可。没有沿用旧词汇量分级表，也没有沿用旧图标。0.6.1 使用同一固定版本的 ECDICT BNC / FRQ 词频与显式词形关系重新生成标记数据，脚本为 `scripts/build_word_ranks.py`。

## 排除与核对

新目录从空目录建立，仅显式复制上述独立模块、词库与本项目文档。旧客户端、原始 ZIP、旧工作流和旧提交历史不进入公开快照。技术比较结果见 [源码检查记录](audit.md)。比较可以发现重复与来源线索，不能证明不存在任何常见语法或标准接口相似。

## 功能边界

聚焦普通 YouTube 视频，暂不包含 Netflix 或系统原生全屏面板。0.6.1 恢复词汇量标记，桌面和触屏采用不同的输入交互。构建与模拟通过不等于 Safari 真机全部可用；版本保持预览，实际范围见 [兼容性](../compatibility.md)。
