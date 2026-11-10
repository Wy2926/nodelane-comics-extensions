# 插件与 App 契约

本契约描述 NodeLane 目录分发及 JavaScript 漫画接口。原版 Keiyoushi APK 由既有 Mihon 兼容桥运行，不执行下述 JS 接口；其请求、解析和图片处理保留在原扩展中。App 管理界面、书架、阅读进度、下载和翻译。

## 原版 APK 与同来源升级

保留 `id` 与仓库身份，提升 `version`，设置 `sourceCodeLanguage: 2`、`sourceCodeUrl: packages/<slug>/<version>.apk`，包大小与摘要仍按同一分发规则校验。`additionalParams` 为 JSON 字符串，其中 `mihonSourceId` 必须是上游原始 64 位 ID 的字符串；不以该值替换本地数据库 ID。APK 原样分发并保留原许可，NodeLane 分发版本独立于上游 APK 版本。

原生来源使用上游返回的内部路径和桥元数据，不转换成旧 JS 插件的完整网址。Comix 本次不承担旧自研版数据兼容，不新增 App 映射或迁移逻辑；来源 ID 不变本身不保证旧章节网址可用。Android 与 iOS 的兼容性分别验收。

## 运行与接口

App 在 QuickJS 中实例化 `DefaultExtension extends MProvider`，通过 `this.source` 注入来源元数据。运行时不提供 Node 模块或完整浏览器环境；构造器只初始化本地状态，网络方法返回 Promise。

| 接口 | 要求 | 返回值 |
| --- | --- | --- |
| `get supportsLatest()` | 显式声明 | 布尔值；不支持最新时返回 `false`，主机缺省为 `true` |
| `getPopular(page)` | 必需 | 列表结果，页码从 1 开始 |
| `search(query, page, filters)` | 必需 | 列表结果；插件将筛选状态转换为站点请求参数 |
| `getDetail(url)` | 必需 | 作品详情与完整章节目录 |
| `getPageList(chapterUrl)` | 必需 | 按阅读顺序排列的页面数组 |
| `getLatestUpdates(page)` | 支持最新时必需 | 列表结果 |
| `getHeaders(url)` | 按需 | 字符串请求头映射，默认 `{}`；App 传入来源 `baseUrl` |
| `getFilterList()` | 可选 | 筛选定义数组，默认 `[]` |
| `getSourcePreferences()` | 可选 | 来源设置定义数组，默认 `[]` |

## 数据格式

| 对象 | 字段 |
| --- | --- |
| 列表结果 | `{list: 作品[], hasNextPage: boolean}` |
| 列表作品 | 必需 `name`、`link`；可选 `imageUrl` |
| 作品详情 | 必需 `name`、`link`、`chapters: 章节[]`；可选 `imageUrl`、`description`、`author`、`artist`、`genre: string[]`、`status: number` |
| 章节 | 必需 `name`、`url`；可选 `scanlator`、`dateUpload`，均为字符串 |
| 页面 | URL 字符串，或 `{url: string, headers?: Record<string,string>, imageProcessing?: object}` |

`status`：`0` 连载、`1` 完结、`2` 休刊、`3` 取消、`4` 出版结束，`5` 或省略表示未知。

作品和章节使用经过验证的完整 URL，保留有身份意义的路径和查询参数。章节先验证作品归属，再按规范化后的完整 URL 去重；同名或同编号的不同 URL 不能合并。目录分页必须全部成功后才返回，部分失败不能交付半份目录。页面数组保留原始顺序及重复 URL 的页槽，只传清单，不传图片字节。

章节名称保留源站语义，特殊章和独立编号不能为消除缺章提示而删除或改号。App 的编号间隙统计仅作提示，不参与章节身份、目录去重或刷新成败判断，也不替代插件对源站分页、总数和作品归属的校验。

`dateUpload` 使用 Unix 毫秒时间戳字符串，不使用抓取时间代替上传时间。App 刷新章节时按以下语义处理：

| 值 | 处理 |
| --- | --- |
| 正整数毫秒字符串，且不超过 `8640000000000000` | 新建或更新上传日期 |
| `""` 或 `"0"` | 明确未知，清除旧日期；推荐空字符串 |
| 省略、`null` 或非法字符串 | 保留已有日期，新章节保持未知 |

## 筛选与来源设置

`getFilterList()` 使用 `type_name` 区分 `TextFilter`、`CheckBox`、`TriState`、`SelectFilter`、`SortFilter`、`GroupFilter`、`HeaderFilter`、`SeparatorFilter`。App 绘制控件，将选择后的定义数组传回 `search`；插件负责应用这些状态。

`SelectFilter` 的 `state` 是选项索引，`values` 为 `{name, value, type_name: "SelectOption"}` 数组；`SortFilter.state` 为 `{index, ascending, type_name: "SortState"}`。字段 `type` 可作为插件自己的筛选标识，展示名称不应充当协议值。

`getSourcePreferences()` 返回 `{key, <控件类型>: {...}}` 数组。控件类型为 `checkBoxPreference`、`switchPreferenceCompat`、`listPreference`、`multiSelectListPreference`、`editTextPreference`。设置按来源 ID 隔离，`key` 保持稳定：

- `new SharedPreferences().get(key)`：读取设置控件值。
- `getString(key, defaultValue)`、`setString(key, value)`：读取或保存本地字符串。

设置存储不承担凭据保管，插件不得接收官方账号凭据或供应商密钥。

## 分发元数据与兼容性

| 字段 | 契约 |
| --- | --- |
| `id` | 永久来源身份，改名、换域名和版本更新保持不变 |
| `name`、`lang`、`iconUrl` | 名称、语言代码、图标 URL |
| `baseUrl`、`apiUrl` | 源站 HTTPS origin 与可选 API 入口 |
| `version`、`appMinVerReq` | 插件版本与最低 App 版本，格式为 `x.y.z` |
| `itemType`、`sourceCodeLanguage` | `0`（漫画）；`1`（JavaScript）或 `2`（Mihon APK） |
| `sourceCodeUrl` | 插件包地址，相对地址按目录索引解析；必须与索引同源 |
| `catalogMetadata` | 可选的来源卡片资料，独立于包校验及执行参数，结构见下文 |
| `isNsfw` | 可选布尔值；`true` 展示 18+ 并参与成人来源过滤，缺失不表示全年龄认证 |
| `nodelane` | `schema: 1`，以及 `repositoryId`、`slug`、`sha256`、`size`、`requestHosts`、`capabilities`、`requires`、`license` |

`capabilities` 声明插件功能：`popular/latest/search/details/pages`，应与实现一致；它不会自动实现方法或控制 UI。`requires` 声明额外主机能力，App 通过只读 `NodeLane.capabilities` 提供可用能力；缺少依赖时拒绝安装或更新。基础版本号不能替代能力检查。

App 核对仓库与来源身份、下载地址、兼容性、包大小及 SHA-256；包上限 1 MiB，初始化成功才保存，失败保留已安装版本及关联数据。正式与本地目录均为 JSON 来源数组；正式目录通过 HTTPS 分发，插件摘要用于内容完整性检查。新增主机能力需使用有版本的能力名；站点解析规则和已有能力的参数变化由插件更新。

### 来源卡片资料

目录行的 `catalogMetadata` 使用 `schema: 1`，与 `nodelane` 并列：

| 字段 | 类型与值 |
| --- | --- |
| `regions` | 数组：`jp` 日漫、`kr` 韩漫、`cn` 国漫、`hk_tw` 港台漫画、`western` 欧美漫画、`other` 其他地区 |
| `formats` | 数组：`page` 页漫、`vertical` 条漫、`strip` 短篇条格 |
| `creations` | 数组：`original` 原创、`fan` 同人、`adaptation` 改编 |
| `pricing` | `unknown` 未标注、`free` 免费、`partial` 免费与付费内容并存、`paid` 付费 |

三个分类维度可多选，描述网站覆盖范围，不承诺每部作品都具备这些属性；地区不表示服务器位置或阅读语言，语言继续读取 `lang`。收费模式由目录维护者声明，只控制卡片显示，不包含价格、订阅方案、广告、登录或用户购买状态，不控制阅读权限。成人标记独立使用顶层 `isNsfw`，不放入分类数组。

App 将缺失资料、未知收费枚举和不支持的版本视为未标注，不推断免费；未知分类保留但不显示。官方维护目录只发布已核实的当前枚举。资料随来源备份，可在插件版本不变时刷新；更新不能覆盖安装代码、常用、阅读状态或被迟到旧目录覆盖，不要求新增主机能力。

## 请求、解析与错误

| 主机入口 | 契约 |
| --- | --- |
| `Client` | 可用方法为 `get(url, headers)`、`head(url, headers)`、`post(url, headers, body)`；响应含 `statusCode`、`headers`、文本 `body`，JSON 由插件解析 |
| `Document(html)` | 提供 CSS `select/selectFirst`、文本与属性读取等解析接口，不执行网页脚本 |
| 设备 WebView | App 处理 CF 验证入口及设备端 Cookie／UA；插件报告验证需求，不自动解题 |

`Client` 仅允许 HTTPS、443 端口、无 URL 用户凭据及 `requestHosts` 中的精确主机，不支持通配符。最多 4 次跳转，每次重新校验；GET／HEAD 可跳转，POST 遇到跳转失败。请求体上限 1 MiB，文本响应上限 4 MiB，等待响应及流空闲超时各 30 秒。插件自行限制分页、并发、重试和缓存生命周期。

上述请求限制不等于完整 JavaScript 沙箱，也不自动约束原生图片请求。封面与正文图片接受源站页面或接口返回的有效 HTTP(S) 地址，不使用固定 CDN 域名、存储桶或路径模板作为准入条件；相对地址按源站解析，查询参数与页位保留。章节归属由页面身份、阅读导航或接口中的作品／章节数据确认，不从图片 CDN 路径猜测。

成功空结果与失败必须区分。失败通过抛出 `Error` 传播，说明验证、限流、网络、归属、目录完整性或图片协议等原因；不以空列表掩盖失败。验证由用户在设备端完成后重试，`hasCloudflare` 不保证验证通过。错误和日志不得包含 Cookie、令牌、签名图片地址或私密响应。

## 图片处理

普通页省略 `imageProcessing`。需要图块还原时，在 `requires` 声明 `image.tile-shuffle.v1`，并提供以下 `imageProcessing` 对象：

```json
{"type":"tile-shuffle-v1","algorithm":3,"seedMasks":{}}
```

`seedMasks` 是响应标识到无符号 32 位整数掩码的映射，最多 8 项；键为 1–32 位小写十六进制字符串。App 读取图片响应的 `X-Scramble-Algo/Grid/Seed/Hash`，按算法 3（xorshift32／Fisher-Yates）还原图块并保留网格外边缘像素；未知协议明确失败。

处理上限为每张 12 MiB、800 万像素、256 块、单帧。App 负责有限队列与解码，缓存键包含处理参数，成功后才缓存或保存；阅读、下载和翻译共用还原后的原图。新增图片算法需要 App 提供对应能力，插件只声明参数。
