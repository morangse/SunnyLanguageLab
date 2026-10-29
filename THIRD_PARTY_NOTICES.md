# 第三方材料

## ECDICT

离线英汉数据来自 [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT)，固定提交 `ab22ad36302cafc6349a050e2b60894855208055`，使用 MIT 许可。原始许可随包保存在 `extension/src/ipad/data/ECDICT-LICENSE.txt`。本项目生成子集与词形索引，来源和源文件校验值见同目录 `source.json`，生成脚本为 `scripts/build_chinese_dictionary.py`。

## Wiktionary

用户主动查询在线英文词义时，从 [English Wiktionary](https://en.wiktionary.org/) 获取内容。词卡保留对应来源页与 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 标识，内容许可独立于应用 MIT 许可。

## 开发依赖与平台

Worker 开发依赖由 `server/package-lock.json` 锁定，各自保留许可。Apple SDK、GitHub Actions、Cloudflare 与 AI 服务遵循各自平台规则；SDK、签名材料、API 凭据不进入本源码快照。

## 项目代码

v0.6 重写字幕、页面桥接、查词缓存、在线词典适配、AI 请求、设置、交互与图标，保留本项目此前独立编写的生词同步模块与服务。此快照不包含旧运行代码或旧 ZIP，见 [重写范围](docs/maintainers/rewrite.md)。
