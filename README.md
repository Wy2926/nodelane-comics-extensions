# NodeLane 官方插件仓库

独立维护供 NodeLane Comics App 下载的 JavaScript 来源插件，公开仓库为 [Wy2926/nodelane-comics-extensions](https://github.com/Wy2926/nodelane-comics-extensions)。沿用 Mangayomi `MProvider` 接口，插件通过静态目录分发；App、浏览器插件和翻译后端都不是构建目录依赖。

| 来源 | 范围 | 源码 |
| --- | --- | --- |
| Comix | 热门、最新、搜索、完整章节目录、普通图片与已知图块还原参数 | [src/comix](src/comix/README.md) |
| S2READ | Madara AJAX 列表／搜索、静态完整目录与公开图片正文 | [src/s2read](src/s2read/README.md) |
| 瓜子漫画 | 热门／最新、搜索与五类筛选、完整目录及图片正文 | [src/guazimanhua](src/guazimanhua/README.md) |
| RIDI | 条漫热门／最新、漫画与条漫搜索、完整目录及已获权限的图片正文 | [src/ridibooks](src/ridibooks/README.md) |

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

## 开发导航

| 入口 | 用途 |
| --- | --- |
| [开发约定](AGENTS.md) | 代码边界、提交前清理与文档维护规则 |
| [维护与发布](docs/MAINTENANCE.md) | 新增插件、永久身份、构建、测试、更新与恢复 |
| [插件契约](docs/CONTRACT.md) | 接口、数据格式、能力声明与主机边界 |
| [来源与许可](THIRD_PARTY.md) | 迁移来源、固定提交、摘要和第三方声明 |
| [仓库分配表](repository.json) | 永久仓库身份与来源 ID，删除站点仍保留分配 |
| [构建与发布脚本](scripts/catalog.mjs) | 可复现构建、不可覆盖的版本产物与索引更新 |
| [App 仓库](https://github.com/Wy2926/node-comics-app) | QuickJS、阅读器、下载与图片处理主机 |

代码采用 [GPL-3.0-only](LICENSE)。站点内容不随仓库分发。开发测试依赖的许可与运行时插件分开记录。
