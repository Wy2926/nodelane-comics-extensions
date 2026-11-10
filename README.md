# NodeLane 官方插件仓库

独立维护供 NodeLane Comics App 下载的来源目录，公开仓库为 [Wy2926/nodelane-comics-extensions](https://github.com/Wy2926/nodelane-comics-extensions)。Comix 直接分发 Keiyoushi 原版 APK，其余现有 JavaScript 插件沿用 Mangayomi `MProvider` 接口；App、浏览器插件和翻译后端都不是构建目录依赖。

| 来源 | 范围 | 源码 |
| --- | --- | --- |
| Comix | 同一来源 ID 升版，直接使用 Keiyoushi 原版 APK 与 App 既有兼容桥 | [src/comix](src/comix/README.md) |
| S2READ | Madara AJAX 列表／搜索、静态完整目录与公开图片正文 | [src/s2read](src/s2read/README.md) |
| 瓜子漫画 | 热门／最新、搜索与五类筛选、完整目录及图片正文 | [src/guazimanhua](src/guazimanhua/README.md) |
| RIDI | 条漫热门／最新、漫画与条漫搜索、完整目录及已获权限的图片正文 | [src/ridibooks](src/ridibooks/README.md) |
| Read Comics Online | 热门／最新、搜索与三类筛选、完整目录、上传日期及图片正文 | [src/readcomicsonline](src/readcomicsonline/README.md) |
| Raw Otaku | 热门／最新、搜索与四类筛选、完整目录及图片正文 | [src/rawotaku](src/rawotaku/README.md) |
| Manga18fx | 热门／最新、搜索与题材／原文／排序筛选、完整目录、上传日期及图片正文 | [src/manga18fx](src/manga18fx/README.md) |
| Asura Scans | 热门／最新、搜索与组合筛选、完整目录、日期及免费正文；保留付费章节标识 | [src/asurascans](src/asurascans/README.md) |
| 包子漫画 | 分类热门、最新上架、搜索与四类筛选、完整目录及整话分页正文 | [src/baozimh](src/baozimh/README.md) |

## 本地运行

Node.js 22+。初次安装开发依赖后检查、生成本地测试目录并启动服务：

```sh
npm ci
npm run check
npm run release -- testing
npm run serve
```

正式入口为 `https://comics-extensions.nodelane.net/stable/index.json`，测试渠道为同域名下的 `/testing/index.json`。`main` 分支通过检查后，GitHub Actions 自动部署到 Pages；只有显式执行 `npm run release -- stable` 更新的版本进入正式目录。域名与 HTTPS 状态见 GitHub 仓库 Settings → Pages。

上述本地命令生成开发目录 `http://127.0.0.1:8787/index.json`；App 通过 `NODELANE_CATALOG_URL` 显式切换本地地址。

真实 iPhone 使用同一局域网的开发机地址：`HOST=0.0.0.0 npm run serve`，并在 App 启动时指定 `--dart-define=NODELANE_CATALOG_URL=http://开发机IP:8787/index.json`。

NodeLane 代码采用 [GPL-3.0-only](LICENSE)，原版 Keiyoushi APK 保留 Apache-2.0，不重新标注为 GPL；见 [第三方声明](THIRD_PARTY.md)。站点内容不随仓库分发。
