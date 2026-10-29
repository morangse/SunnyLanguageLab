# SunnyLanguageLab

Give every sentence a little more time. Bilingual YouTube captions, sentence replay, tap-to-reveal translation, offline English-Chinese lookup and a local vocabulary notebook.

**v0.6.0 is an independently rewritten preview, licensed under MIT.** The old client, icons, source ZIPs and Git history are not part of this source snapshot. Licensed dictionary data and optional vocabulary sync are retained; see [provenance](docs/maintainers/rewrite.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

Install using [Windows](docs/install/windows.md), [macOS](docs/install/macos.md), [iPad](docs/install/ipad.md) or [iPhone](docs/install/iphone.md) instructions. Desktop Chrome loads an unpacked extension. Safari requires an app wrapper and appropriate signing; unsigned IPA files are not directly installable. iPhone support remains experimental. See [compatibility](docs/compatibility.md) for the distinction between builds, simulation and real devices.

```sh
python scripts/build_variants.py
node --test tests/*.test.js
```

Both packages include the offline dictionary. AI is optional and only runs after explicit action; use your own provider key and model. Personal sync uses a self-hosted Cloudflare Worker + D1 with one-way GitHub export. No cloud service is deployed by the build.

Only regular YouTube videos with readable captions are currently targeted. Netflix, Shorts, live streams, native mobile fullscreen and the YouTube app are outside this release's scope.

[中文](README.md) · [Documentation](docs/README.md) · [MIT](LICENSE) · [Privacy](PRIVACY.md)
