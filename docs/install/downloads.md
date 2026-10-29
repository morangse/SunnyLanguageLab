# 下载时应该选哪个文件

v0.6.0 为预览版，尚无商店安装入口。仓库公开、许可确认、发行完成后，普通用户从 [Releases](https://github.com/morangse/SunnyLanguageLab/releases) 选版本。当前若没有发行版，可参考 [源码构建](../development.md)。请勿在不明站点输入 Apple、GitHub 或 API 凭据。

| 文件 | 用途 |
| --- | --- |
| `SunnyLanguageLab-chrome-v0.6.0.zip` | Windows / Mac 桌面 Chrome；Edge 可尝试。解压后选择含 `manifest.json` 的文件夹 |
| `SunnyLanguageLab-safari-v0.6.0.zip` | Safari 源资源，需要 Xcode 转换为 Safari 应用，不能直接导入 Safari |
| `SunnyLanguageLab-iOS-v0.6.0-unsigned.ipa` | iPhone / iPad 的 Safari 宿主应用构建。未签名，需要适合设备的签名，不能直接安装 |
| GitHub 自动提供的 `Source code` | 源码快照，需要自己打包，不是桌面安装包 |

Actions 会先给一个外层 ZIP，例如 `SunnyLanguageLab-WebExtensions.zip`。解开后，再选择里面的 Chrome / Safari 包。IPA 产物外层 ZIP 也需要先解压，避免把外层目录误选为扩展目录。

下载 Actions 产物通常需要登录 GitHub，产物有保留期限；发行包和构建记录是不同页面，不要把过期 Actions 链接当作长期下载地址。

[Windows](windows.md) · [Mac](macos.md) · [iPad](ipad.md) · [iPhone](iphone.md) · [更新前备份](../usage/backup.md)
