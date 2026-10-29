# Mac 安装教程

## 推荐：桌面 Chrome

1. 下载 Chrome 版 ZIP，解压到固定位置，例如 `Documents/SunnyLanguageLab/chrome`，目录内直接包含 `manifest.json`。
2. 打开 Chrome 的 `chrome://extensions`，启用「开发者模式」。
3. 点「加载已解压的扩展程序」，选择该目录。无需 IPA、Xcode 或 Apple 签名。
4. 刷新 YouTube 普通视频，允许站点访问，按 [第一次练习](../usage/first-video.md) 设置英文与中文。
5. 更新前导出生词，覆盖原目录并重新加载，再刷新视频。

Mac Edge 可尝试同一 Chrome 包，在 `edge://extensions` 加载解压后的目录。构建成功不代表所有 macOS 与浏览器组合都已实测。

## 进阶：Safari 开发者路线

当前没有已签名、公证并供普通用户直接安装的 Mac Safari 应用；iOS IPA 也不能当作 Mac 安装包。本路线适合能使用 Xcode 的开发者，Mac Safari 的触控版交互仍需验收。

1. 安装与 macOS 兼容的完整 Xcode，启动一次完成组件安装。
2. 下载源码，在根目录运行 `python3 scripts/build_variants.py`，获得 `dist/safari/`。
3. 检查转换工具：`xcrun --find safari-web-extension-packager`。若当前 Xcode 只有旧工具，改用 `safari-web-extension-converter`。
4. 将资源转换为 macOS 项目，例如：

```sh
xcrun safari-web-extension-packager ./dist/safari --project-location ./generated-mac --app-name SunnyLanguageLab --bundle-identifier com.example.sunnylanguagelab --swift --macos-only --copy-resources
```

5. 在 Xcode 打开项目，选择 macOS 宿主应用 Scheme 和自己的开发团队，处理签名提示并运行。
6. 在 Safari 设置 → 扩展启用 SunnyLanguageLab，允许 YouTube 访问。测试未签名扩展时，遵循当前 Safari 的开发者设置要求。
7. 用带字幕的视频验收面板、查词、重播和备份。排查步骤见 [Apple 官方运行说明](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)。

示例标识用于新安装；已有安装更新时不要随意换标识或签名。公开分发 Mac 应用还需完成签名、公证与发行验证，iOS 工作流不会完成这些工作。

[Apple 打包说明](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari) · [Chrome 本地安装说明](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
