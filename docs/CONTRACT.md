# 插件与 App 契约

插件负责把一个网站转换成作品列表、作品详情、完整章节目录和有序图片清单。App 负责页面、书架、阅读进度、下载、图片处理及翻译；插件不管理这些数据，也不接入官方账号、计费或翻译供应商。

本文对应正在联调的 NodeLane App，不能仅凭 `appMinVerReq: "0.9.9"` 推断原版 Mangayomi 已有 NodeLane 新能力。接口来源为 [Mangayomi JavaScript 指南](https://github.com/kodjodevf/mangayomi-extensions/blob/6004f1f8d1a56f882dadb734ce26f50c626a3850/CONTRIBUTING-JS.md)，该仓库已归档；实际行为以配套 App 代码和运行验证为准。

## 一个漫画插件需要实现什么

源码编写 `class SourceExtension extends MProvider`，在清单中填写 `entryClass`。构建器按 `files` 顺序合并代码并导出 `DefaultExtension`，App 再创建实例；`this.source` 可读取主机注入的来源元数据。构造器只准备客户端和有限缓存，不发起请求；网络方法返回 Promise。手机执行环境是 QuickJS，没有 Node 模块、文件系统或完整浏览器 `window/document`，Node/npm 只用于开发。

| 接口 | 实现要求 | 输入与结果 |
| --- | --- | --- |
| `get supportsLatest()` | 显式声明 | 返回布尔值；不支持最新时返回 `false`，同时从清单移除 `latest`。主机缺省为 `true`，不能靠省略关闭 |
| `getPopular(page)` | 必需 | 热门列表，页码从 1 开始，返回 `{list, hasNextPage}` |
| `search(query, page, filters)` | 必需 | 名称搜索与可选筛选，结果同热门；无匹配是成功空列表，验证／解析失败必须抛错 |
| `getDetail(url)` | 必需 | 输入作品 URL，返回元数据与完整 `chapters` 快照 |
| `getPageList(chapterUrl)` | 必需 | 返回有序图片 URL 或页面对象数组；只返回清单，不传图片字节 |
| `getLatestUpdates(page)` | 条件必需 | `supportsLatest === true` 时实现，结果同热门 |
| `getHeaders(url)` | 按站点需要 | 返回字符串头映射，如 `Referer`。App 当前传入 `baseUrl`；单页特殊请求头放在页面对象中。无需求返回 `{}` |
| `getFilterList()` | 可选 | 定义搜索筛选／排序控件；无需求返回 `[]` |
| `getSourcePreferences()` | 可选 | 定义持久化站点设置；无需求返回 `[]` |

清单声明和脚手架都不会替代实现。新来源保持 `enabled: false`，完成接口、真实站点范围核验及必要回归验证后再启用。新增、验证和发布命令统一见 [维护与发布](MAINTENANCE.md)。

### 返回数据

| 对象 | 字段与约束 |
| --- | --- |
| 列表结果 | `list` 为作品数组，`hasNextPage` 必须是布尔值；不能用当前页长度猜测站点不可靠的结束条件 |
| 列表作品 | `name`、`link`，可选 `imageUrl`；只交付轻量候选，不逐条请求详情或图片。缺少封面不应丢掉有效作品 |
| 作品详情 | `name`、`link`、`chapters`；可选 `imageUrl`、`description`、`author`、`artist`、`genre: string[]`、`status: number` |
| 状态 | `0` 连载、`1` 完结、`2` 休刊、`3` 取消、`4` 出版结束，`5` 或省略表示未知；传数字，不传状态文案 |
| 章节 | `name`、`url`；可选 `scanlator`、`dateUpload`。保留扫描组、不同上传、0 话、小数话和分段章节 |
| 普通页面 | 字符串 URL，或 `{url, headers?}`。列表位置就是页序，相同 URL 也可能代表不同页槽，不能去重 |
| 待还原页面 | 在页面对象增加 `imageProcessing`，且声明对应主机能力，见下方图片还原契约 |

例如，列表与图片方法分别返回：

```json
{"list":[{"name":"示例作品","link":"https://example.org/manga/sample/","imageUrl":"https://example.org/cover.jpg"}],"hasNextPage":false}
```

```json
[{"url":"https://cdn.example.org/page-1.jpg","headers":{"Referer":"https://example.org/"}},{"url":"https://cdn.example.org/page-2.jpg","headers":{"Referer":"https://example.org/"}}]
```

`getPageList` 当前不读取页面对象的 `fileName`；不能因为 Dart 模型存在该字段就依赖插件传入它。作品与章节 URL 使用经过验证的完整地址，保留有身份意义的路径和查询参数；不以标题或浮点章节号作为身份。

### 章节目录与日期

目录必须先验证作品归属，再按规范化后的完整章节 URL 去重；同名、同编号的不同 URL 不能合并。任一分页失败、总数变化或目录截断都应失败，不能返回半份成功目录。新图布局、动态目录或未知图片协议未适配时明确报错，不伪装成“没有章节”。

`dateUpload` 是 Unix 毫秒时间戳的字符串。日期语义影响已有章节的刷新：

| 返回值 | 配套 App 的处理 |
| --- | --- |
| 有效正整数毫秒字符串（不超过 `8640000000000000`） | 新建或更新该章上传时间 |
| `""` 或 `"0"` | 明确未知，清除旧日期；插件优先使用空字符串 |
| 省略、`null` 或非法字符串 | 未提供可靠更新，保留已有日期；新章节仍未知 |

不要把抓取时间填成上传时间。站点只给日历日期时保持其日期语义；相对时间使用同次响应的统一基准，覆盖月名、闰日和时区差异。来源升级后，已存章节需要刷新作品详情才会更新日期；读取列表不等于刷新整本目录。

## 可选的筛选、排序与设置

`getFilterList()` 返回描述，App 绘制控件并将选择后的数组传回 `search(query, page, filters)`。插件仍需把状态转换成站点参数；仅返回控件不会自动筛选数据。当前识别 `TextFilter`、`CheckBox`、`TriState`、`SelectFilter`、`SortFilter`、`GroupFilter`、`HeaderFilter`、`SeparatorFilter`，使用字段 `type_name` 区分。

例如一个下拉框的定义：

```json
[{"type":"status","name":"状态","type_name":"SelectFilter","state":0,"values":[{"name":"全部","value":"","type_name":"SelectOption"},{"name":"完结","value":"completed","type_name":"SelectOption"}]}]
```

`SelectFilter.state` 是选项索引；`SortFilter.state` 使用 `{index, ascending, type_name: "SortState"}`。站点请求应使用选项的协议值，不用展示名称拼参数。格式错误可能被主机回退为空筛选，必须通过实际 QuickJS／界面验证，不能只看 Node 构建成功。

`getSourcePreferences()` 返回 `{key, <控件类型>: {...}}` 数组。支持 `checkBoxPreference`、`switchPreferenceCompat`、`listPreference`、`multiSelectListPreference`、`editTextPreference`。例如：

```json
[{"key":"show_extra","switchPreferenceCompat":{"title":"显示番外","summary":"在目录中保留番外章节","value":true}}]
```

使用 `new SharedPreferences().get(key)` 读取控件值；`getString(key, defaultValue)`、`setString(key, value)` 提供本地字符串存取。存储按来源 ID 隔离，键要稳定。它不是密钥保险箱；源站会话交给 App，官方账号凭据和供应商密钥不得交给插件或网页。插件不能通过此接口增加任意 Flutter 页面。

## 清单、能力声明与更新

| 清单字段 | 开发者需要填写／保持的内容 |
| --- | --- |
| `slug`、`id` | 目录名与 `repository.json` 永久分配匹配；改名、换域名或更新不换 ID |
| `name`、`lang`、`iconUrl` | 展示名、语言、源站图标 HTTPS 地址；优先可匿名读取的 PNG，来源与权利说明记录在 `THIRD_PARTY.md` |
| `baseUrl`、`apiUrl` | 源站 HTTPS origin 与可选 API 入口；不是插件仓库地址 |
| `version`、`appMinVerReq` | `x.y.z` 版本；已发布内容变化须升版，不能覆盖同版本包 |
| `itemType`、`sourceCodeLanguage` | 本构建器只接受 `0`（漫画）与 `1`（JavaScript） |
| `files`、`entryClass` | 本站源码文件的合并顺序与入口类；运行时不下载公共代码或执行源站脚本 |
| `requestHosts` | `Client` 允许访问的精确域名，包含 `baseUrl` 主机；不支持通配符 |
| `capabilities` | 插件提供的功能，目前只接受 `popular/latest/search/details/pages` |
| `requires` | 插件依赖的额外主机能力，目前已注册 `image.tile-shuffle.v1` |
| `license`、`enabled` | 当前仓库分发代码为 `GPL-3.0-only`；未完成来源设 `enabled: false` |

`hasCloudflare`、`isNsfw`、`isFullData` 等兼容字段描述来源行为，不能代替验证或接口实现。两个现有来源都返回轻量列表，使用 `isFullData: false`。

必须区分三种“能力”：

- `capabilities` 是插件声明，构建器校验允许的名称；App 当前不会据此验证方法实现或自动生成筛选入口。
- `requires` 是安装兼容条件，App 缺少所需能力时拒绝更新并保留旧版。
- `NodeLane.capabilities` 是运行时只读主机能力列表；UI 是否显示“最新”仍由 `supportsLatest` 控制。

构建器生成 `sourceCodeUrl` 和 `nodelane` 第 1 版分发元数据：仓库身份、slug、SHA-256、字节数、请求主机、能力及许可。包上限 1 MiB；App 核对同源下载地址、大小、摘要和兼容性，初始化成功才持久化，失败保留旧代码及来源关系。来源名称不是所有权依据，第三方相同 ID 冲突必须拒绝。

图标属于安装元数据。当前目录刷新仅为已安装来源标记新版本；完成插件更新后，新的图标地址才保存并显示。正式托管、签名索引与恢复流程见 [维护与发布](MAINTENANCE.md)，SHA-256 本身不证明发布者身份。

## App 提供哪些运行能力

| 能力 | 当前入口与边界 |
| --- | --- |
| HTTP 文本请求 | `new Client(options)`；`get(url, headers)`、`head(url, headers)`、`post(url, headers, body)`，响应包含 `statusCode`、`headers`、文本 `body`，JSON 需自行解析 |
| HTML 解析 | `new Document(html)`、CSS `select/selectFirst`、文本／属性读取等 DOM 桥；它不执行网页 JavaScript，不能依赖完整浏览器 DOM |
| 本地设置 | `SharedPreferences`，按来源隔离；定义设置控件和实际使用设置是插件的两项工作 |
| 辅助计算 | 现有日期、解包、加密等桥接函数；只依赖已经在真实 QuickJS 验证过的接口，不把 Node 测试环境等同手机 |
| 网页执行入口 | 上游保留 `evaluateJavascriptViaWebview(url, headers, scripts, time)`；依赖设备 WebView 服务，尚未作为 NodeLane 有版本的通用浏览器会话能力验收，两个来源未使用 |
| 图片读取与处理 | 原生阅读器／下载器消费页面清单及声明参数；插件不传整章 Base64，也不自行启动解码队列 |

已知主机缺口：JS `Client.put/delete/patch` 当前都发送 `http_post`，尽管 Dart 侧有对应处理器。两个现有插件不依赖这些方法。使用新动词前必须修复主机桥并验证实际请求方法，不能把方法名存在当作功能已支持。

### 请求预算与来源验证

NodeLane 包的 `Client` 请求桥要求 HTTPS、443 端口、无 URL 用户凭据及精确声明主机，每次跳转重新核对。文本响应最多 4 MiB、请求体 1 MiB、等待响应及流空闲超时各 30 秒，最多 4 次跳转。GET／HEAD 可以在约束内跳转，POST 遇到跳转直接失败。插件还必须自行限制分页、并发、重试和缓存生命周期。

这些限制覆盖官方 `Client` 路径，不是对任意第三方 JavaScript 的完整沙箱保证，也不会自动限制原生图片请求的主机。插件返回图片前仍需验证图片协议、地址与作品／章节归属；只接受已经核实的 CDN，不按猜测改写未知域名。

### CF、站点验证码与错误

CF 由 App 的请求栈识别 `cf-mitigated: challenge` 并接入设备 WebView，Cookie 和 UA 留设备端。`hasCloudflare: true` 不表示自动通过验证；插件不会解验证码，也不能承诺每个站点都能复用会话。Comix 的 `captcha_required` 是另一个站点验证流程，需要用户在设备网页完成后重试；只有明确 `key_retired` 才刷新公开协议材料一次。

错误必须区分验证、限流、网络、地址格式、作品归属、目录完整性、源站空正文及未知图片协议，不能全部标为“页面结构变化”。目前通过抛出 Error 传播，S2READ 另带 `[S2:类型]`；尚无跨站点统一错误对象协议。日志只保留可公开定位信息，不记录 Cookie、令牌、签名图片地址或完整私密响应。

## 图片还原契约

需要 `image.tile-shuffle.v1` 的插件在 `requires` 声明，并在打乱页返回：

```json
{"url":"https://images.example.org/page.jpg","headers":{"Referer":""},"imageProcessing":{"type":"tile-shuffle-v1","algorithm":3,"seedMasks":{"03632":58414,"02900":117532}}}
```

App 在原始图片响应中读取 `X-Scramble-Algo/Grid/Seed/Hash`，只接受已知算法 3，按 xorshift32／Fisher-Yates 置换恢复图块，保留网格外边缘像素。站点种子掩码由插件提供，公共图片层不按域名分支。未知协议明确失败，普通页不带 `imageProcessing`。

每张待处理图片最多 12 MiB、800 万像素、256 块、单帧；阅读器处理队列最多 4 项，后台同时处理 1 张，离线下载在既有有限 worker 中处理。缓存键包含处理参数，还原成功后才缓存或保存文件，翻译读取同一份还原后的原图。真机解码耗时、峰值内存和耗电尚未测量。

站点选择器、URL 变体、日期、签名材料布局、筛选参数及已支持图片算法的参数调整可只发布插件。新增原生图片算法、网络桥、浏览器会话能力或新数据字段需要 App 配合，新增能力应有版本并由 `requires` 约束兼容性。

## 两个插件的现状与下一步

| 能力 | Comix | S2READ |
| --- | --- | --- |
| 热门／最新／搜索分页 | 已实现 | 已实现 |
| 详情、完整目录、章节日期 | 已实现，保留上传／扫描组 | 已实现，支持路径变体及绝对／相对日期 |
| 图片清单 | 普通页及已知图块还原参数 | 普通图片、已核实 CDN 与旧 HTTP 地址规范化 |
| 筛选／排序、站点偏好 | 都返回空定义，未实现 | 都返回空定义，未实现 |
| 站点账号／付费操作 | 未实现 | 未实现 |
| 设备内验证与真实阅读 | 模拟器目录可用；章节仍遇到 `captcha_required`，真实图片显示未完成验收 | 模拟器已验证图片、翻章、恢复位置；部分旧 CDN 连接失败，真实 CF 未验收 |

两站都已有 Node 和实际 App QuickJS 样本；这些结果不等于站点当前所有作品可读。真机、Android、真实 CF 和性能分别验收，Android 当前暂缓。详细站点范围只维护在 [Comix](../src/comix/README.md) 与 [S2READ](../src/s2read/README.md)，不在本文重复测试流水。

建议按以下顺序补齐，未列为必需的功能按实际站点需求实施：

1. **完成真实阅读与恢复验收。** 优先打通 Comix 设备内站点验证后的章节读取，核实还原图片；S2READ 区分“解析成功”和“旧 CDN 不可达”，不能用猜测图片地址掩盖源站故障。
2. **增加有用的站内筛选／排序。** 对照网站确有的题材、状态、排序参数，先补 `getFilterList` 与 `search` 联动；只有确需持久化的选项才加偏好。此类改动通常只更新插件，无需新框架。
3. **修复主机 HTTP 动词映射。** 在新增需要 PUT／DELETE／PATCH 的来源前完成桥接修复与实际请求方法回归；目前两个来源不受影响。
4. **完成正式分发。** 配置 HTTPS 托管、签名索引、App 验签与密钥轮换；沿用现有测试／正式渠道及不可变版本，不把本地测试源称为正式上线。
5. **按证据扩展契约。** 多站点确有需求后再统一错误分类，或增加有版本的浏览器／图片能力。App 保留小说 `getHtmlContent/cleanHtmlContent` 和动画 `getVideoList` 接口，但本仓库构建器当前不发布这些类型，扩展时需补清单、样本和界面验收。

## 实现核对入口

仓库内查看 [构建校验](../scripts/catalog.mjs)、[脚手架](../scripts/new-source.mjs)、[跨 App 契约样本](../test/fixtures/contracts.json)。配套 [App 仓库](https://github.com/Wy2926/node-comics-app) 中重点核对以下路径；它们是参考入口，不是本仓库构建时的目录依赖：

- `lib/eval/javascript/service.dart`、`http.dart`、`dom_selector.dart`、`preferences.dart`、`utils.dart`：运行接口及桥接。
- `lib/eval/model/m_manga.dart`、`m_chapter.dart`、`filter.dart`、`source_preference.dart`，以及 `lib/models/page.dart`：实际反序列化字段。
- `lib/services/source_package.dart`、`source_catalog_config.dart`、`fetch_sources_list.dart`：包、主机能力与安装更新。
- `lib/modules/manga/detail/providers/update_manga_detail_providers.dart`：章节身份、已有日期和阅读状态的更新规则。
- `lib/services/source_images/`：图片处理、限制与缓存；配套 App 的 `docs/SOURCE_PLUGINS.md` 记录主机验证入口。
