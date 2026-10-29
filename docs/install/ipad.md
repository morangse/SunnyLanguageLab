# iPad 安装与使用教程

场景是 **Safari 网页中的 YouTube 普通视频**，YouTube App 不会加载扩展。新版本仍待 Safari 真机验收，尚未承诺最低可用 iPadOS 版本。

## 准备

- 一台可访问 YouTube 的 iPad，并知道系统版本。
- 一个正确签名、允许安装到本机的 SunnyLanguageLab Safari 宿主应用；或能运行 Xcode 的 Mac 和自己的 Apple 开发签名环境。
- 旧用户先从完整设置页 [导出生词](../usage/backup.md)。

目前只有源码和未签名 IPA，没有 App Store / TestFlight 入口。未签名 IPA 不能通过点开文件安装。签名方式各有设备、证书和有效期限制，本项目不提供共享证书或签名服务。

## Xcode 安装路线

在 Mac 下载源码，运行 `python3 scripts/build_variants.py`，再创建 iOS 项目：

```sh
xcrun safari-web-extension-packager ./dist/safari --project-location ./generated-ios --app-name SunnyLanguageLab --bundle-identifier com.example.sunnylanguagelab --swift --ios-only --copy-resources
```

若 Xcode 只有旧转换工具，将命令中的工具名换为 `safari-web-extension-converter`。打开生成项目，选择 iOS 宿主应用 Scheme，连接 iPad；在应用与扩展两个目标的 Signing & Capabilities 中选择自己的 Team，确保标识、签名与嵌入扩展一致。按 Xcode 提示处理设备信任、所需的开发者模式并运行。

开发者也可给 Actions 的未签名 IPA 重新签名后安装，但必须具备自己的可用签名方式。重签可能改变应用身份，更新前务必导出数据。没有 Mac 且没有签名环境时，目前没有面向普通用户的一步安装路径。

## Safari 中启用

1. 安装后先打开 SunnyLanguageLab 宿主应用一次。
2. 在系统设置中搜索 Safari → 扩展，启用 Sunny。较新系统通常在「设置 → App → Safari」，旧系统可能直接在「设置 → Safari」。
3. 用 Safari 打开 YouTube，在地址栏页面菜单 / 扩展入口找到 Sunny，允许访问当前站点。页面跳到 App 时返回 Safari，必要时尝试请求桌面网站。
4. 打开有英文字幕的普通视频，确认 YouTube 原始字幕可见，再打开 Sunny 面板。
5. 需要在线词典、AI 或同步时，再允许相应服务域名访问；离线词典不要求部署云同步。

## 触控练习

竖屏面板在底部，横屏使用侧边面板。点「字幕」展开，点时间回到该句；底部有上一句、重播、播放 / 暂停和下一句。

隐藏中文后点「轻点显示中文」揭晓当前句，换句、跳转或重播后重新隐藏。点英文词查词；点「选短语」，先点首词，再点同一句中的末词，最后点「查短语」。取消后可继续滚动，无需拖选或鼠标悬停。

Safari 版内置 38,207 个英汉词头，含词形共 66,793 个查询形式；并非所有词都收录。系统原生视频全屏会离开网页层，无法覆盖学习面板，请在网页内播放。

## 一分钟验收

显示原文 → 揭晓中文 → 重播确认重新隐藏 → 查一个常见词 → 收藏 → 导出 JSON。再转横屏，确认面板不挡住全部字幕。出现问题记录机型、系统、视频链接与操作步骤，见 [反馈指南](../../CONTRIBUTING.md)。

[Apple 运行说明](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension) · [FAQ](../faq.md)
