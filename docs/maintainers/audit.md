# v0.6 源码与验证记录

2026-10-29。此快照从空目录建立，仅显式复制本项目独立模块、有许可词库与项目文档，其余客户端和图标重新实现。旧源码 ZIP、旧客户端及旧 Git 历史不进入公开快照。

## 技术比较

22 个新客户端代码 / 样式 / 页面 / SVG 文件与原型代码比较：无相同整文件，无命中连续 8 行且总长至少 240 字符的重复片段；4 个 PNG 图标均不同。明确保留的 5 个独立同步 / 数据模块另列，完整结果见 `source-audit.json`。该阈值检查有明确范围，不保证没有常见语法或接口相似。

## 验证

- 36 项 Node / SQLite 功能测试通过。
- 390×844、844×390、820×1180、1180×820、1440×900 五组屏幕尺寸，各 32 项交互检查通过。
- Chrome / Safari 两个包构建通过；Worker dry-run 通过，不代表已经部署。
- 本地 Markdown 链接与来源 / 许可检查通过。
- 常见 GitHub、Google、Anthropic 凭据和私钥块格式未命中；未发现维护者私人归档默认地址。扫描不是无敏感信息的保证。

0.6.1 的双浏览器包、Worker dry-run 与 iPhone / iPad 原生宿主应用已在[对应提交的 Actions](https://github.com/morangse/SunnyLanguageLab/actions/runs/40885159298)通过。未签名 IPA 已核对包含 0.6.1 Safari 扩展、离线词库与词频标记，设备声明包含 iPhone / iPad。真实 Safari 设备验证仍待完成，iPhone 继续标为实验支持，详见 [兼容性](../compatibility.md)。
