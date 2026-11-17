# 插件维护与分发

新增或修复网站使用 [nodelane-source-adapter 技能](../.agents/skills/nodelane-source-adapter/SKILL.md)。接口与数据格式只在 [CONTRACT.md](CONTRACT.md) 定义；本站支持范围和验证边界放 `src/<slug>/README.md`。

## 目录与检查

| 位置 | 用途 |
| --- | --- |
| `src/<slug>/` | 站点实现或原版 APK、manifest、站点说明；APK 自带原始 LICENSE |
| `repository.json` | 永久仓库身份与来源 ID 分配，删除来源也保留分配记录 |
| `test/` | 行为回归和合成／脱敏契约样本 |
| `.build/` | 可重建的包与摘要索引，不是发布目录 |
| `repo/` | 渠道索引、不可变包、对应源码与许可；`registry.json` 记录已发布 ID |

```sh
npm ci
npm run check
# JS 与明确选择的 App 联调；APK 需单独通过 Mihon 桥验收：
npm run test:app -- --app /绝对路径/nodelane-comics-app
```

`build`、`check` 和 `test:app` 的本地 `.build/` 包含 `enabled: false` 的待验收来源，以便验证；`release` 先检查全部来源，再仅构建和发布已启用来源。`check` 不依赖 App 或真实站点。`test:app` 通过所选 App 的 Flutter 工具执行通用 QuickJS 契约与网页桥测试，输入为本仓库 `.build/` 和 `test/fixtures/`；可用 `FLUTTER` 指定 SDK。App 普通 CI 不读取插件仓库。

## 本地目录与发布

```sh
npm run release -- testing
npm run serve
# 目标平台验收后，且本次任务已授权正式发布时：
npm run release -- stable
```

`release` 构建并测试所有启用来源，写入本地 `repo/`。`testing` 同时更新开发用的根索引；`stable` 只更新正式索引。两渠道独立，但包与源码归档共用。它会重新构建，不自动复用测试包；推广前核对版本与摘要和已验收包一致，并检查整个目录差异，避免顺带发布其他来源。

本地服务仅暴露 `repo/`，默认地址 `http://127.0.0.1:8787/index.json`。App 以 `--dart-define=NODELANE_CATALOG_URL=目录地址` 切换；真机联调使用 `HOST=0.0.0.0 npm run serve` 和开发机局域网 IP。正式／测试入口为 `https://comics-extensions.nodelane.net/{stable,testing}/index.json`，远程目录使用 HTTPS，不代理源站或接收设备 Cookie。

发布前整批校验版本、身份和摘要；同版本包不可覆盖。仅 `catalogMetadata`、`isNsfw` 可在不改包版本的情况下更新，首次源码归档保持不变。包、源码及许可先写入，渠道索引最后原子替换；失败可重试，不删除已写入的不可变文件。若遗留 `repo/.publish-lock`，确认原进程结束后再移除锁。

提交、推送与发布按本次授权执行。推送 `main` 会触发现有 GitHub Actions，检查后将 `npm run pages` 生成的 `.pages/` 部署到 Pages；PR 只检查。提交发布内容时带齐源码、`repo/` 产物和许可，并检查 `git diff -- repo/stable/index.json repo/testing/index.json`。只改文档不需要运行 `release` 或改变目录。

## 恢复与迁移

恢复已安装的坏版本需用**更高版本**重新发布归档实现，不能降低索引版本：

```sh
npm run rollback -- <slug> <归档版本> <高于当前渠道的版本> testing
```

该命令验证归档可重现性并保留其他来源，不改变工作区源码；恢复后同步工作区版本，避免后续发布降版。归档内 `rebuild.mjs` 可单独重建 JS；APK 只还原原始二进制，不代表重新编译上游源码。历史包、对应源码和许可证继续保留。

更换托管保留域名、路径、仓库身份、来源 ID、slug 与已有文件，包地址与目录同源且不重定向。换域名须同步 App 官方地址并保留旧入口兼容期。App 安装失败保留旧版本与关联数据；具体安装行为见 [App 来源文档](https://github.com/Wy2926/node-comics-app/blob/main/docs/SOURCE_PLUGINS.md)。
