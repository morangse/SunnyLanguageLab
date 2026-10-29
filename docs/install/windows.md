# Windows 安装教程

推荐先使用桌面 Chrome。Edge 可尝试同一包，尚未完成所有 Windows / Edge 版本的实机验收。学校或公司的管理策略可能禁止自行安装扩展。

## Chrome

1. 下载 Chrome 版本 ZIP，解压到长期保留的文件夹，例如 `Documents/SunnyLanguageLab/chrome`。打开后应直接看到 `manifest.json`、`src`、`icons`。
2. 在 Chrome 地址栏输入 `chrome://extensions`，打开右上角「开发者模式」。
3. 点「加载已解压的扩展程序」，选择含 `manifest.json` 的文件夹。不要选择 ZIP 或外层产物目录。
4. 在浏览器扩展菜单中找到 SunnyLanguageLab，可固定到工具栏。
5. 新开或刷新 YouTube 视频，确认原视频有英文字幕，再打开 Sunny，设置学习语言为英文、翻译语言为中文。
6. 按 [第一次练习](../usage/first-video.md) 完成重播、查词、收藏和备份。

## Edge

在地址栏输入 `edge://extensions`，打开「开发人员模式」，点「加载解压缩的扩展」，选择同一个 Chrome 版本目录。后续练习方式相同。遇到问题反馈 Edge 版本与报错，不要反复卸载。

## 更新与卸载

先在完整设置页导出 JSON 生词备份。关闭正在播放的视频，将新版本解压到原安装目录，在扩展管理页点「重新加载」，再刷新视频。保留目录和扩展身份有助于保留数据，仍应以导出的备份为准，见 [恢复指南](../usage/backup.md)。

卸载会清除本机扩展数据；确认备份可读后再移除扩展及目录。

## 常见问题

- 找不到 manifest：选错目录。向内打开，直到直接看到 `manifest.json`。
- 字幕没出现：刷新视频，检查扩展开关、站点权限和视频原始字幕。
- 中文词义没出现：v0.6 两端均含本机英汉词库；未收录词可主动查英文词典或 AI。确认安装的是新包并尝试常见词。
- 生词没同步：本机收藏不等于已部署云同步，见 [可选同步](../usage/cloud-sync.md)。

安装机制参考 [Chrome 官方说明](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) 与 [Edge 官方说明](https://learn.microsoft.com/microsoft-edge/extensions-chromium/getting-started/extension-sideloading)。
