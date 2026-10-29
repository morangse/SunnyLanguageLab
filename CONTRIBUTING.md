# 参与贡献

欢迎提交教程改进、问题复现与兼容性报告。应用代码使用 MIT；提交的代码或图片应有明确来源，不要移除词库许可。

Bug 报告请带版本、设备、系统、浏览器、视频链接和操作步骤。字幕问题说明发生在画面还是列表，移动端注明横竖屏。不要提交密钥、同步口令、证书或私人词库；安全问题见 [SECURITY.md](SECURITY.md)。

改动说明用户遇到的问题与改后行为，按影响验证：

```sh
node --test tests/*.test.js
python scripts/build_variants.py
python scripts/check_docs.py
python scripts/check_release_ready.py
```

修改 UI 后检查触控和桌面布局，记录是真机还是模拟。修改 Worker 后验证 dry-run，不能将构建通过写成服务已部署。新增资料说明来源，AI 辅助也应核对引用。只提交源码，不包含本机依赖、缓存、凭据、签名或学习记录。
