# Comix

NodeLane 版本 0.3.0，来源 ID 仍为 `86001001`。直接分发 Keiyoushi Comix 1.6.63 原版 APK，通过 App 已有 Mihon 扩展桥执行，不转换、不改写、不重新签名。

`manifest.json` 的 `sourceCodeLanguage: 2` 选择原生运行时，`additionalParams.mihonSourceId` 保留上游 ID `7537715367149829912`。上游下载地址、源码提交、文件大小和 SHA-256 固定在 `upstream`；构建离线核对摘要后复制 APK，原始 Apache-2.0 许可随包归档。

按当前不需要兼容旧自研版数据的要求，直接采用上游作品／章节路径，不给 App 添加旧网址映射或迁移逻辑。旧测试书籍需从新来源重新打开；不主动删除设备中的旧数据。历史 JS 产物与对应源码仍保留在 `repo/sources/comix/`，不覆盖旧版本。

`npm run check` 验证原版字节一致性、目录身份、包校验、归档许可及恢复流程。其余 JS 来源继续通过 `npm run test:app -- /明确选择的App路径` 验证；该 QuickJS 测试不代表 Comix 原生验收。

MuMu Android 12 x86_64 现有调试 App 的原生桥已实测原版 1.6.63 的热门分页、最新、搜索、空结果、详情和完整目录。第二章首、中、末页图片已取得并抽查显示正常，第一章末页仍触发站点验证码。不能据此认定 Cloudflare 已解决，也不能替代目录内升级、App 阅读器整章／跨章／后台恢复验收。iOS 与 ARM 真机未验证。

来源和许可见 [THIRD_PARTY.md](../../THIRD_PARTY.md)，原许可全文见 [LICENSE](LICENSE)。
