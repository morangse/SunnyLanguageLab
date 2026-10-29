# 社交媒体介绍

发布前确认仓库链接可公开访问，发行包已存在时再附下载链接。0.6 为预览版，移动端仍需签名，iPhone 为实验支持，不写成所有平台一键安装或全平台真机验证。

## GitHub About

视频英语练习：双语字幕、逐句重播、离线英汉查词与本机生词本，响应式适配电脑和 iPhone / iPad Safari，可自建同步。MIT。

## 小红书 / 朋友圈

标题：看 YouTube 学英语，我想把查词和复习放在同一个页面

我把自己的视频英语学习工具 SunnyLanguageLab 重写并开源了 ☀️

看一段视频时，可以对照双语字幕、反复听同一句、点词查中文，把生词和原句一起留下来。iPad 不适合到处悬停和拖选，所以做成了点按：点一下看中文，查短语先点首尾词，再确认。

电脑优先用 Chrome；手机和平板用 Safari 网页中的 YouTube。两个包都有本机英汉词库，基础练习不要求 AI；想同步可以自己部署 Cloudflare，再归档到 GitHub / Obsidian。

这是 v0.6 预览版，应用代码采用 MIT。iPhone 仍是实验支持，移动端需要签名安装，暂时没有 App Store / TestFlight 入口。我把四个平台教程、备份方法和已知限制一起整理了，欢迎带设备和系统信息反馈问题。

项目与教程：https://github.com/morangse/SunnyLanguageLab

#英语学习 #YouTube学英语 #iPad学习 #开源项目

## 技术社区

标题：SunnyLanguageLab 0.6：MIT 开源的视频字幕练习工具，重写响应式触控交互

这次按功能需求重新实现了字幕、页面通信、查词、AI、交互与设置，使用新的图标，并把旧原型源码和历史留在公开快照之外。保留本项目独立编写的本机生词队列、个人 Worker / D1 同步与有许可词库。

主要面向网页 YouTube 普通视频：双语字幕、逐句重播、点按揭晓、离线英汉查词、本机生词与 JSON 备份。可选单向归档到自己的 GitHub 仓库供 Obsidian 使用。AI 默认关闭，由用户自备密钥与模型。

当前版本仍为预览，Safari 真机验收继续进行；iPhone 为实验支持，未签名 IPA 需要自行签名。Netflix、Shorts 与原生全屏面板不在本版支持范围。

源码、MIT 许可与四平台教程：https://github.com/morangse/SunnyLanguageLab
