# SunnyLanguageLab ☀️

**给每一句话，多一点时间。**

把 YouTube 视频变成可反复练习的小段：双语字幕、逐句重播、跟读暂停、点词查中文和本机生词本。电脑支持鼠标拖选与悬停暂停；iPad、iPhone 支持点按查词与首尾词选短语。默认只显示视频角落的小太阳，点开才展开工具。

**v0.6.1 是独立重写的开源预览版，应用代码采用 MIT。** 旧版运行代码、图标与历史源码 ZIP 不包含在此版本中；离线词库和在线词典内容保留各自许可。见 [重写记录](docs/maintainers/rewrite.md) 和 [第三方说明](THIRD_PARTY_NOTICES.md)。

## 选择设备

| 设备 | 推荐方式 | 教程 | 验证范围 |
| --- | --- | --- | --- |
| Windows | 桌面 Chrome；Edge 可尝试 | [Windows](docs/install/windows.md) | 打包与自动化检查；完整真实浏览器使用待验收 |
| Mac | 优先 Chrome；Safari 为开发者路线 | [Mac](docs/install/macos.md) | 桌面包构建；Mac Safari 分发待完成 |
| iPad | Safari 网页 YouTube | [iPad](docs/install/ipad.md) | 响应式模拟；新版 Safari 真机待验收 |
| iPhone | Safari 网页 YouTube，实验支持 | [iPhone](docs/install/iphone.md) | 小屏竖横屏模拟；新版 Safari 真机待验收 |

目前没有 Chrome 商店、App Store 或 TestFlight 入口。桌面包解压加载；移动端 Safari 需要签名的宿主应用，未签名 IPA 无法直接安装。

## 每天练一小段

1. 打开有字幕的 YouTube 普通视频，选择学习语言与翻译语言。
2. 重播本句，或每句结束后暂停跟读。
3. 隐藏中文后悬停或点按揭晓；切句、跳转、重播后重新隐藏。
4. 点词查本机英汉词义；电脑拖选短语；触屏点首尾词，再确认。
5. 收藏有用的词和原句，导出 JSON，留给下次复习。

离线英汉数据随 **两个浏览器包** 提供：38,207 个词头，含词形共 66,793 个查询形式。在线英文释义与 AI 都由按钮主动触发；AI 默认关闭，需要自己的服务商密钥和可用模型。

生词先存在本机。可选部署自己的 Cloudflare Worker + D1 跨设备同步，再单向写入自己的 GitHub 仓库，供 Obsidian 使用；构建扩展不会替你部署云服务。

## 下载与安装

查看 [Releases](https://github.com/morangse/SunnyLanguageLab/releases) 是否已有发行包；没有发行包时，可以 [自行打包](docs/development.md) 或下载成功 Actions 的产物。不同文件用途见 [下载指南](docs/install/downloads.md)。

```sh
python scripts/build_variants.py
node --test tests/*.test.js
```

桌面 Chrome 加载 `dist/chrome/`。Safari 资源位于 `dist/safari/`，需要用 Xcode 转换、签名后安装。更新前先 [导出生词](docs/usage/backup.md)；同一安装保留旧数据时，可在 AI 设置恢复旧密钥；不同安装需要重新填写。

## 仓库结构

```text
extension/src/content/     新的响应式面板、字幕解析与页面生命周期
extension/src/page/        只传字幕元数据与字幕文本的页面桥接
extension/src/background/  本机词库、在线查询、受限消息路由与同步
extension/src/options/     设置、备份、AI 与可选同步
extension/src/ipad/data/   有明确许可的英汉数据（两端共用，保留原目录名）
extension/icons/           新绘制图标与 SVG 源文件
server/                   可选的个人 Cloudflare 服务
scripts/                  打包、来源检查、词库与图标生成
tests/                    集成测试与固定字幕的交互夹具
docs/                     四平台教程、FAQ、维护记录与社交文案
```

## 当前边界

主要目标是 YouTube 普通视频，视频必须有可读取字幕。本站自动翻译、页面接口与扩展权限可能影响结果；无字幕视频不会自动听写。Netflix、Shorts、直播、YouTube App、系统原生全屏与画中画不在此版本的支持范围。

词汇量分级标记已恢复：可选 2500 / 4500 / 6500 / 9000 / 全部等级，以及下划线、底色、彩字；依据有许可的 ECDICT 词频作学习参考。旧 Netflix 适配暂不提供。新版本的构建、模拟检查和真机验证范围分别记录在 [兼容性](docs/compatibility.md)，不承诺全平台均已实测。

## 数据与参与

没有开发者遥测。在线查询、AI 和个人同步会按你的操作把相应数据发给对应服务；AI、Cloudflare、GitHub Actions 和 Apple 分发可能涉及费用，见 [隐私说明](PRIVACY.md)。

[完整教程](docs/README.md) · [第一次练习](docs/usage/first-video.md) · [FAQ](docs/faq.md) · [贡献指南](CONTRIBUTING.md) · [安全反馈](SECURITY.md) · [更新记录](CHANGELOG.md) · [English](README.en.md)
