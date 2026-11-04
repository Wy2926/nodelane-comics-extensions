# 插件与 App 契约

插件定义 `DefaultExtension extends MProvider`，产物由 App 的 QuickJS 执行。Node/npm 仅用于开发，不是手机运行时。上游参考为 [Mangayomi JavaScript 指南](https://github.com/kodjodevf/mangayomi-extensions/blob/6004f1f8d1a56f882dadb734ce26f50c626a3850/CONTRIBUTING-JS.md)；原仓库已归档，不能据此承诺站点持续可用。

| 接口 | 返回／约束 |
| --- | --- |
| `getPopular(page)`、`getLatestUpdates(page)`、`search(query,page,filters)` | 页码从 1 开始，`{list:[{name,link,imageUrl}],hasNextPage}`；列表只返回轻量候选 |
| `getDetail(url)` | `{name,link,imageUrl,description,author,genre,status,chapters}`；章节保留稳定 URL，可带 scanlator 与毫秒时间字符串 |
| `getPageList(url)` | URL 或 `{url,headers,imageProcessing?}` 数组，严格保留页序及重复图片页槽；只传清单 |
| `getHeaders()`、`getFilterList()`、`getSourcePreferences()` | 复用 App 图片头、筛选和来源偏好，无需专用页面 |

清单的 `nodelane` 字段为第 1 版分发协议，包含 `repositoryId`、`slug`、`sha256`、`size`、`requestHosts`、`requires`、`capabilities`、`license`。App 持久保存已安装版本的元数据。`appMinVerReq` 控制基础版本，`requires` 控制额外主机能力；不兼容更新保留旧版。`NodeLane.capabilities` 是 App 提供的只读能力列表。

来源 `id` 是永久身份，`baseUrl` 是源站，`sourceCodeUrl` 是相对仓库索引的产物地址，三者不能混用。来源名称不是所有权依据。配置的官方入口可迁移已有官方来源；第三方相同 ID 冲突必须拒绝。

## HTTP 与验证

统一通过 `Client` 请求。NodeLane 包的请求桥核对精确 HTTPS 主机、每次跳转和请求／响应预算，未知跳转不会自动放行。当前文本请求最多 4 MiB，请求体 1 MiB，等待与流空闲超时 30 秒，最多 4 次跳转；插件本身还应限制分页和重试。现有 JS 桥保留上游其他能力，这些限制不是对任意恶意第三方代码的完整沙箱保证。

CF 由 App 识别 `cf-mitigated: challenge` 并调用设备 WebView；Cookie 和 UA 留设备端。插件不复制浏览器会话或自动解题。Comix 的 `captcha_required` 独立处理，提示用户在来源网页完成后重试；只有明确 `key_retired` 才刷新公开协议材料一次。静态仓库仅分发代码。

## 图片还原

需要 `image.tile-shuffle.v1` 的插件声明该能力，并在打乱页返回：

```json
{"url":"https://图片主机/页面","headers":{"Referer":""},"imageProcessing":{"type":"tile-shuffle-v1","algorithm":3,"seedMasks":{"03632":58414,"02900":117532}}}
```

App 在原始图片响应中读取 `X-Scramble-Algo/Grid/Seed/Hash`，只接受已知算法 3，按 xorshift32／Fisher-Yates 置换恢复图块，保留网格外边缘像素。站点种子掩码由插件提供，公共图片层不按域名分支。未知协议明确失败。普通页不带 `imageProcessing`。

每张待处理图片最多 12 MiB、800 万像素、256 块、单帧；阅读器处理队列最多 4 项，后台同时处理 1 张，离线下载在既有有限 worker 中处理。图片不经过 JS Base64 桥，也不预先解码整章。缓存键包含处理参数，还原成功后才缓存或保存下载文件，翻译读取同一份还原后的原图。解析／解码与耗电尚未做真机性能测量。

新图片能力需要 App 发版；站点选择器、签名材料布局与已支持算法的参数调整可只更新插件。未实现的浏览器会话请求能力保持明确失败，不复制浏览器扩展运行时。
