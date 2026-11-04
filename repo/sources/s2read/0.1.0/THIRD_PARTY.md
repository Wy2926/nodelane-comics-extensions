# 插件来源与许可

`src/` 与生成的 `repo/packages/` 以 **GPL-3.0-only** 分发，全文见 [LICENSE](LICENSE)。应用上游的 Apache-2.0 声明保持不变；不要将这些插件文件标记为 Apache-2.0。仓库文件服务同时提供 LICENSE、THIRD_PARTY 和每个版本的对应源码／重建脚本。本仓库从 node-comics-app 工作区的 extensions 目录迁出，原插件 ID 与协议来源保留；该目录当时尚未提交，因此不虚构迁出提交号。

## 复用的协议实现

来源：[Wy2926/node-comics](https://github.com/Wy2926/node-comics)，提交 `af3df6ee75276ba1970ba0a7dc22488d54712e18`。归属 NodeLane Comics 项目及贡献者，许可证 GPL-3.0-only。从 `apps/extension/src/sources/sites/comix/` 迁入以下两文件：去掉 TypeScript 类型、模块导入／导出，将应用专用异常改为普通 Error；不依赖同级仓库运行或构建。

| 原文件 | 原始 SHA-256 | 本地文件 |
| --- | --- | --- |
| `protocol.ts` | `2110cc88e33a89cfa537853e04a4152cf08b6aa7850eb0d932f2f30dafc94da6` | `src/comix/protocol.js` |
| `protocol-source.ts` | `290c35a646d2e0242a91f5103e88417cb30989b263107e8acef3a6787ea6a621` | `src/comix/protocol-source.js` |
| `LICENSE` | `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986` | `LICENSE` |

## 接口参考

- [Mangayomi JavaScript 插件指南](https://github.com/kodjodevf/mangayomi-extensions/blob/6004f1f8d1a56f882dadb734ce26f50c626a3850/CONTRIBUTING-JS.md)：`MProvider`、`Client`、分页、详情及图片返回格式。SHA-256 `fb9e59455c55d5a4cf1077a9e8251b9e19463eb62e1bd78eb39d40adfd12d146`。
- 同一提交的 [Mangafire 插件](https://github.com/kodjodevf/mangayomi-extensions/blob/6004f1f8d1a56f882dadb734ce26f50c626a3850/javascript/manga/src/all/mangafire.js)，版本 `0.1.25`，Apache-2.0，SHA-256 `95c4ea61a17359f0be2cf5bb3c2d7f4de20713e9d0bfa4aea6e3b3f51df4c6e6`。仅参考契约与调用流程，没有复制其站点实现。
- [Comix](https://comix.to/) 的公开页面与 `apicore-tnxabt-CdoUI3T4.js`，SHA-256 `de90ece63f639c5bf6cac594de67ad1634b6fc08e0a36994988dea9109e9a05c`。源站脚本未声明开源许可，只在设备端作为协议数据解析，不打包、执行或分发下载的脚本。

没有引入第三方字体、模型、封面或站点图标。测试夹具使用合成数据；不得提交源站 Cookie、验证码、会话或签名图片地址。

## 新实现的协议参考

- Comix 图片还原参数依据同一 `node-comics` 提交中的 `images.ts`，SHA-256 `3a7eedd0c9a8fbf1a14e67f89285d71f71dfc2e40d60fa3ce67e66ce0ad92113`。本插件仅声明已知算法与种子掩码，通用像素置换由 App 独立实现，不复制浏览器 Canvas／Blob 运行时。
- S2READ 依据 [s2read.com](https://s2read.com/) 当前原始响应与同一提交的 `sites/s2manga/README.md`（SHA-256 `ceaaf52a083fec840cb29fc18cac59f42bf813d8a3a338d3c341d77a82667ced`）及 `shared/madara/search.ts`（SHA-256 `3676260b1908a7d30a020d04ead94c6ff1715d43671dde9801ce160cdebb81fb`）核对协议，独立实现 Mangayomi DOM 适配器，未复制共享引擎代码。网站 HTML 和图片未进入发布包。

## 开发依赖

[LinkeDOM](https://github.com/WebReflection/linkedom) 0.18.12，ISC，仅供 Node 测试和开发 HTTP 检查中的 DOM 模拟；不打包到插件或 App。精确包版本、来源与 npm SHA-512 integrity 摘要见 `package-lock.json`，完整许可在安装包 `node_modules/linkedom/LICENSE`。传递依赖同样由锁文件固定并保留各自许可。
