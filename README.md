# NodeLane 官方插件仓库

供 NodeLane Comics App 下载的来源目录，可独立构建、检查和运行。

## 本地运行

Node.js 22+。初次安装开发依赖后检查、生成本地测试目录并启动服务：

```sh
npm ci
npm run check
npm run release -- testing
npm run serve
```

本地目录为 `http://127.0.0.1:8787/index.json`，App 通过 `--dart-define=NODELANE_CATALOG_URL=目录地址` 切换。真机访问时，将环境变量 `HOST` 设为 `0.0.0.0` 后启动服务，并使用开发机的局域网 IP。

在线目录：[正式渠道](https://comics-extensions.nodelane.net/stable/index.json) · [测试渠道](https://comics-extensions.nodelane.net/testing/index.json)。维护、验证与发布方式见 [维护文档](docs/MAINTENANCE.md)，接口见 [App 契约](docs/CONTRACT.md)。

NodeLane 代码采用 [GPL-3.0-only](LICENSE)，原版 Keiyoushi APK 保留 Apache-2.0，不重新标注为 GPL；见 [第三方声明](THIRD_PARTY.md)。站点内容不随仓库分发。
