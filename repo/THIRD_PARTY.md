# 插件来源与许可

NodeLane 的 `src/` 与生成的 `repo/packages/` 衍生作品以 **GPL-3.0-only** 分发，全文见 [LICENSE](LICENSE)。移植代码保留原作者、许可及声明；其中 Apache-2.0 原始部分的许可原文随源码和包提供。应用自身的 Apache-2.0 基线与插件分开。仓库文件服务同时提供 LICENSE、THIRD_PARTY 和每个版本的对应源码／重建脚本。本仓库从 node-comics-app 工作区的 extensions 目录迁出，原插件 ID 与协议来源保留；该目录当时尚未提交，因此不虚构迁出提交号。

## 复用的协议实现

来源：[Wy2926/node-comics](https://github.com/Wy2926/node-comics)，提交 `af3df6ee75276ba1970ba0a7dc22488d54712e18`。归属 NodeLane Comics 项目及贡献者，许可证 GPL-3.0-only。从 `apps/extension/src/sources/sites/comix/` 迁入以下两文件：去掉 TypeScript 类型、模块导入／导出，将应用专用异常改为普通 Error；不依赖同级仓库运行或构建。

| 原文件 | 原始 SHA-256 | 本地文件 |
| --- | --- | --- |
| `protocol.ts` | `2110cc88e33a89cfa537853e04a4152cf08b6aa7850eb0d932f2f30dafc94da6` | `src/comix/protocol.js` |
| `protocol-source.ts` | `290c35a646d2e0242a91f5103e88417cb30989b263107e8acef3a6787ea6a621` | `src/comix/protocol-source.js` |
| `LICENSE` | `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986` | `LICENSE` |

瓜子漫画适配参考并改写同一提交的 `apps/extension/src/sources/sites/guazimanhua/` 协议检查：用 `MProvider` 和 App DOM 桥实现作品绑定、结构化数据交叉核验与完整正文读取，增加分页筛选适配，不引入浏览器运行时。原代码归 NodeLane Comics 项目及贡献者，GPL-3.0-only。

| 原文件 | 原始 SHA-256 | 本地适配 |
| --- | --- | --- |
| `definition.ts` | `a24672fbfad16727b58b9529d135707627e876ee7992d05f81178100461a7b09` | `src/guazimanhua/parser.js` 的地址与归属标记 |
| `network.ts` | `cc4f4b3f64f51adff262847c5949b9b2322c11e09b4e4039b41c44f26bbc99fa` | `src/guazimanhua/parser.js` 的目录与正文核验 |
| `search.ts` | `75a7505a8f403abce183863268b3b7a5b363c91ae8e93d202dcad60c32c9bcaf` | `src/guazimanhua/parser.js` 的列表与分页核验 |

## 接口参考

### Read Comics Online 移植

来自 [Keiyoushi/extensions-source](https://github.com/keiyoushi/extensions-source/blob/b647c92fd14801fda23e866d5a7da7d5fdd7ec92/src/en/readcomicsonline/src/eu/kanade/tachiyomi/extension/en/readcomicsonline/ReadComicsOnline.kt)，固定提交 `b647c92fd14801fda23e866d5a7da7d5fdd7ec92`。上游项目版权为 2015 Javier Tomás 及贡献者，Apache-2.0。

| 原文件 | SHA-256 | 使用方式 |
| --- | --- | --- |
| `src/en/readcomicsonline/.../ReadComicsOnline.kt` | `99e590957d8d157254b785a7349b9e8410b5f88cb428777c7dcb3295694e99bc` | 移植新版 HTML 选择器、列表／搜索地址、目录与图片解析到 `src/readcomicsonline/` |
| `src/en/readcomicsonline/build.gradle.kts` | `73bb6d220d9602238a43489f6718eea3d0d57f714ce43fafad55646289a9ddaf` | 核对语言、域名和内容标记，不复制构建体系 |
| `LICENSE` | `b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1` | 全文保存在 `parser.js` 注释中，随单文件插件及逐版本源码分发 |

NodeLane 改用 `MProvider`／DOM 桥，依据站点表单补齐筛选，并增加请求限制、身份／页数核验、日期校验和错误分类；这些修改按 GPL-3.0-only 分发。未打包或依赖上游 APK、JVM、MMRCMS 运行库。Mangayomi 同一站点的 Dart 配置也已检索，其旧 MMRCMS 主题未用于本次实现。

### Raw Otaku 移植

来自同一 Keiyoushi 固定提交的 [RawOtaku](https://github.com/keiyoushi/extensions-source/blob/b647c92fd14801fda23e866d5a7da7d5fdd7ec92/src/ja/rawotaku/src/eu/kanade/tachiyomi/extension/ja/rawotaku/RawOtaku.kt) 和 [MangaReader](https://github.com/keiyoushi/extensions-source/blob/b647c92fd14801fda23e866d5a7da7d5fdd7ec92/lib-multisrc/mangareader/src/eu/kanade/tachiyomi/multisrc/mangareader/MangaReader.kt)，版权归 2015 Javier Tomás 及贡献者，Apache-2.0。

| 原文件 | SHA-256 | 使用方式 |
| --- | --- | --- |
| `src/ja/rawotaku/.../RawOtaku.kt` | `8c6b8c21baf781cc1d4b4ea3b12a499e80f8cf0f80a949b76a9005ddc02c199c` | 列表／搜索路径、正文 JSON、Referer 行为 |
| `src/ja/rawotaku/.../RawOtakuFilters.kt` | `ce70b295ff6cac240bd561b457107b63ba86d1f3100767de5346025edf2ceb74` | 按当前网站表单重核筛选参数与选项 |
| `lib-multisrc/mangareader/.../MangaReader.kt` | `5bf2726e14b7f4b6aba77989b0b15de9c7028ff39d302549cfd3f313a3b545b7` | 列表、详情、目录与图片选择器 |
| `src/ja/rawotaku/build.gradle.kts` | `56a3aee0a09c3fde4857bd160028410cfc2d450e0be330728c9f1d918ae729c4` | 语言、域名及 MIXED 内容标记 |
| `LICENSE` | `b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1` | 原文保存在 `src/rawotaku/parser.js`，随插件及对应源码分发 |

NodeLane 改写为 `MProvider`／DOM 桥，校验页面身份、目录归属、图片顺序与地址格式；从当前章节菜单解析 ID，避开源站过期模板字段。修改按 GPL-3.0-only 分发，不依赖上游 APK 或 JVM。Mangayomi 同一固定提交的完整代码树与索引中未找到该站实现。

### Manga18fx 移植

来自 [Keiyoushi Manga18fx](https://github.com/keiyoushi/extensions-source/blob/48b291828458a32c97c3b167be453258c1bd5a86/src/all/manga18fx/src/eu/kanade/tachiyomi/extension/all/manga18fx/Manga18fx.kt) 和 [YiiMadara](https://github.com/keiyoushi/extensions-source/blob/48b291828458a32c97c3b167be453258c1bd5a86/lib-multisrc/yiimadara/src/eu/kanade/tachiyomi/multisrc/yiimadara/YiiMadara.kt)，固定提交 `48b291828458a32c97c3b167be453258c1bd5a86`。上游项目版权为 2015 Javier Tomás 及贡献者，Apache-2.0。

| 原文件 | SHA-256 | 使用方式 |
| --- | --- | --- |
| `src/all/manga18fx/.../Manga18fx.kt` | `a482d3b51243d28af11c31e0e5185fa7368ca6b603b0a9d38f5d9ec075bc5017` | 站点地址、搜索撇号处理、语言范围 |
| `lib-multisrc/yiimadara/.../YiiMadara.kt` | `ef470b8fd075ef9384dbbe2b74b6af412c0bb7ba6b804addb068c617fe569a3b` | 列表、详情、章节和图片协议 |
| `lib-multisrc/yiimadara/.../Filters.kt` | `2bc3c8fd9ffae049ee2f18d3ea5a2ad67c3bdc07a7660d34e135b471a4de9d1b` | 筛选参数与优先级，选项以当前网站核实结果为准 |
| `src/all/manga18fx/build.gradle.kts` | `bbd2b04de204902d75e3ede516291679892c207731fc0eefd8fa2044a3fff8da` | YiiMadara 主题与 NSFW 标记 |
| `LICENSE` | `b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1` | 原文保存在 `src/manga18fx/parser.js`，随插件及对应源码分发 |

NodeLane 改写为 `MProvider`／DOM 桥，补充页面身份、分页条件、目录归属、日期、图片顺序与地址解析，以及有界请求与分类错误。修改按 GPL-3.0-only 分发，不依赖 APK 或 JVM。Mangayomi 固定提交 `6004f1f8…` 的完整代码树与索引未发现同站实现。

### Asura Scans 移植

来自 [Keiyoushi AsuraScans](https://github.com/keiyoushi/extensions-source/blob/48b291828458a32c97c3b167be453258c1bd5a86/src/en/asurascans/src/eu/kanade/tachiyomi/extension/en/asurascans/AsuraScans.kt)，固定提交 `48b291828458a32c97c3b167be453258c1bd5a86`。原版权为 2015 Javier Tomás 及贡献者，Apache-2.0。

| 原文件 | SHA-256 | 使用方式 |
| --- | --- | --- |
| `AsuraScans.kt` | `8023dce2cd760da8d1a3322fe97ef30d06e2c42139bb93c85bb75accb7c81044` | 移植 API 列表、Astro 详情及章节解析 |
| `Dto.kt` | `aed70708ccfbc56d4a7f95396ce8c52145ebcaf02576668a17e24138c6d61cd8` | 作品、章节、日期与锁定状态字段 |
| `Filters.kt` | `94cad321726b6dd9d3036c80dab5c7cc85d2ad4f4211b14c7b00bd54917221f3` | 排序、类型、状态、题材和创作者参数 |
| `build.gradle.kts` | `7712a6a351dca67d7f5eea66ceaa7f0f5527d093118a92a7e0ab2134ff8152f2` | 核对域名、语言与 SAFE 标记 |
| `LICENSE` | `b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1` | 全文保存在 parser.js 注释，随插件包分发 |

NodeLane 改写为 MProvider／DOM 桥，使用稳定作品地址、完整目录计数、公开日期和图片清单；不隐藏付费章节，不迁入 Android 图片拦截器或账号令牌读取。NodeLane 修改以 GPL-3.0-only 分发。当前抽查的免费正文均为普通图片；遇到上游历史分块图片声明明确提示尚未支持，不输出错乱图片。

另检索 Mangayomi 固定提交 `6004f1f8d1a56f882dadb734ce26f50c626a3850` 的 `javascript/manga/src/en/asurascans.js`（SHA-256 `25fe2a577a10e3babb5a628e04f6e8da01e6da217456643916c240162f5de2c4`）；其 asuracomic.net 列表实测跳转到新站首页，旧 Next.js 选择器不适用，未复制该实现。

### 包子漫画移植

来自 [Keiyoushi Baozi](https://github.com/keiyoushi/extensions-source/blob/48b291828458a32c97c3b167be453258c1bd5a86/src/zh/baozimanhua/src/eu/kanade/tachiyomi/extension/zh/baozimanhua/Baozi.kt)，固定提交 `48b291828458a32c97c3b167be453258c1bd5a86`。原版权为 2015 Javier Tomás 及贡献者，Apache-2.0。

| 原文件 | SHA-256 | 使用方式 |
| --- | --- | --- |
| `Baozi.kt` | `98db7bc326d311b29c91c53df72e49b774272ec1c37a434d8675cad244f0a12e` | 分类、搜索、详情与目录选择器 |
| `Dto.kt` | `483ab19e65ff8bd1b29c2b41d420d00c4d6b55bdd7acf7952fb66b3dad29bb87` | 作品与分类字段 |
| `Filters.kt` | `9f374a5553eb8da1c81d9ff6d8d82e8c479058424f5d1bf07614e54a485a9c54` | 地区、状态、题材、首字母参数；选项按当前主站核对 |
| `build.gradle.kts` | `0ab95a8c06f5b36d77ab9b8a44ed490d172dc33c11771882081912da3fe5ce4d` | 语言、镜像和 SAFE 标记 |
| `LICENSE` | `b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1` | 全文保存在 src/baozimh/parser.js，随插件包分发 |

NodeLane 改写为 MProvider／DOM 桥，按当前主站 AMP API 的 `next` 分页，使用实际跳转到 `cn.twbzmg.com` 的公开阅读器，串行合并一话全部分页，保留页位及目录日期语义。原 appcn／appgb 入口在本机被 CF 封禁；未迁入其图片裁切、替换图片和 Gatekeeper 自动解题拦截器，验证交由 App 网页会话。NodeLane 修改按 GPL-3.0-only 分发。

Mangayomi 固定提交 `6004f1f8d1a56f882dadb734ce26f50c626a3850` 的完整代码树未检出包子漫画同站实现。网站 HTML、脚本及漫画图片不随仓库分发。

当前图片选线协议另依据公开阅读器的 [page_runtime_v5.js?v=2025102603](https://cn.twbzmg.com/s/page_runtime_v5.js?v=2025102603)（SHA-256 `a46ce039ac9204122e622667eeceddf1035534d7a561dac051719a5a3dfe4325`）：地区节点和探测资源来自 `REQ_DOMAINS`／`REQ_FILES`；NodeLane 独立实现 HEAD 选线与域名映射，不复制、执行或打包网站脚本。此映射用于绕开故障节点，其他图片域名照常保留。

### 主机接口与协议资料

- [Mangayomi JavaScript 插件指南](https://github.com/kodjodevf/mangayomi-extensions/blob/6004f1f8d1a56f882dadb734ce26f50c626a3850/CONTRIBUTING-JS.md)：`MProvider`、`Client`、分页、详情及图片返回格式。SHA-256 `fb9e59455c55d5a4cf1077a9e8251b9e19463eb62e1bd78eb39d40adfd12d146`。
- 同一提交的 [Mangafire 插件](https://github.com/kodjodevf/mangayomi-extensions/blob/6004f1f8d1a56f882dadb734ce26f50c626a3850/javascript/manga/src/all/mangafire.js)，版本 `0.1.25`，Apache-2.0，SHA-256 `95c4ea61a17359f0be2cf5bb3c2d7f4de20713e9d0bfa4aea6e3b3f51df4c6e6`。仅参考契约与调用流程，没有复制其站点实现。
- [Comix](https://comix.to/) 的公开页面与 `apicore-tnxabt-CdoUI3T4.js`，SHA-256 `de90ece63f639c5bf6cac594de67ad1634b6fc08e0a36994988dea9109e9a05c`。源站脚本未声明开源许可，只在设备端作为协议数据解析，不打包、执行或分发下载的脚本。

没有打包第三方字体、模型、封面或站点图标。图标只引用下方源站地址；测试夹具使用合成数据，不得提交源站 Cookie、验证码、会话或签名图片地址。

## 站点图标引用

图标来自站点 favicon 或上游仓库保存的站点图标。只将 URL 写入 `iconUrl`，图片文件不进入源码或发布包；权利归各站点及相应权利人，不纳入本仓库 GPL 代码授权。摘要标识已核验的响应，源站后续可能更新内容。

| 站点 | 源站图标／当前资源版本 | 尺寸 | SHA-256 |
| --- | --- | --- | --- |
| [Comix](https://comix.to/) | [35595e3de3c99889c1bd2c56f3e3714fc0c457.png](https://comix.to/assets/uploads/35595e3de3c99889c1bd2c56f3e3714fc0c457.png) | 512 × 512 | `9d692cb5b15b7bc220a96bdb9a60ecb8bb33e3651e85b9c4754ce09fb443a002` |
| [S2READ](https://s2read.com/) | [cropped-Thiet-ke-chua-co-ten-5-192x192.png](https://s2read.com/wp-content/uploads/2026/08/cropped-Thiet-ke-chua-co-ten-5-192x192.png) | 192 × 192 | `20820eb9042beea3295424906b07e63232eca63418c81be16b4b9bb9831646a1` |
| [瓜子漫画](https://www.guazimanhua.com/) | [favicon.ico](https://www.guazimanhua.com/favicon.ico)（ICO） | 16 × 16、32 × 32 | `ddf19896c48eaaec5ff0d295ca97e0b24587f8fe2304b076a570d5ffc6a4bb3c` |
| [RIDI](https://ridibooks.com/) | [favicon-192x192.01frp6098zlb2.png](https://static.ridicdn.net/books-frontend/p/b28d6b/_next/static/media/favicon-192x192.01frp6098zlb2.png) | 192 × 192 | `932024489ab08a057c597da156a62c63ce652a122ab07cf22a676309c7f0d2fc` |
| [Read Comics Online](https://readcomicsonline.ru/) | [Mangayomi 固定提交中的 icon.png](https://raw.githubusercontent.com/kodjodevf/mangayomi-extensions/6004f1f8d1a56f882dadb734ce26f50c626a3850/dart/manga/multisrc/mmrcms/src/en/readcomicsonline/icon.png) | 96 × 96 | `38f9bad0d71e2561eb3d386d523a77990a86aeb4c61c2bd0000102d49de34a11` |
| [Raw Otaku](https://rawotaku.com/) | [favicon.png](https://rawotaku.com/theme/mangareader/images/favicon.png) | 180 × 180 | `aafb004739c79e8aa70aa762d1fb19069bc25b4b260e6bc4364174581b141412` |
| [Manga18fx](https://manga18fx.com/) | [favicon-160x160.jpg](https://manga18fx.com/images/favicon-160x160.jpg) | 160 × 160 | `b0a3018a46cdc4c0903059b4e9b740ef037f61b479af72c33c163a44fda79f3e` |
| [Asura Scans](https://asurascans.com/) | [logo.webp](https://asurascans.com/images/logo.webp) | — | — |
| [包子漫画](https://cn.baozimh.com/) | [Keiyoushi 固定提交中的 ic_launcher.png](https://raw.githubusercontent.com/keiyoushi/extensions-source/48b291828458a32c97c3b167be453258c1bd5a86/src/zh/baozimanhua/res/mipmap-xxxhdpi/ic_launcher.png) | 192 × 192 | `06d3e6ae8fd1e49673cfac258c15e149b1c402c0c844ae3abce36333fa33f8d7` |

Read Comics Online 源站 favicon 受 CF 验证影响，故引用上游已公开的图标地址。包子漫画的 static-tw 图标域名同样被 CF 拦截，使用 Keiyoushi 固定版本中的站点图标。

## 来源卡片资料依据

卡片描述网站覆盖范围，以下资料只作为分类与收费声明的依据，不改变阅读权限或插件现有内容过滤。

| 来源 | 核对依据 |
| --- | --- |
| Comix | 站点公开免费目录及 Keiyoushi 固定提交的 `src/en/comix`：MIXED 内容标记，类型／题材含漫画、条漫、同人和改编 |
| S2READ | [站点题材目录](https://s2read.com/manga-genre/smut/)：Manga／Manhua／Manhwa、Webtoon、Doujinshi、Adaptation、Adult；公开正文免费 |
| 瓜子漫画 | [分类页面](https://www.guazimanhua.com/category.php) 的地区与漫画类型；[会员说明](https://www.guazimanhua.com/member.php) 为去广告服务，免费阅读能力不变 |
| RIDI | [官方条漫目录](https://ridibooks.com/webtoon/romance) 的免费／付费、19+ 内容及漫画／条漫分类；已购权限由网站决定 |
| Read Comics Online | [搜索分类](https://readcomicsonline.ru/advanced-search) 及公开目录／阅读器：欧美页漫、原创与改编、免费阅读；上游当前内容标记 SAFE，不作为全年龄认证 |
| Raw Otaku | [首页](https://rawotaku.com/) 的免费阅读声明、[分类](https://rawotaku.com/filter/) 的成人类别、公开日本页漫与改编作品目录；上游标记 MIXED |
| Manga18fx | [首页](https://manga18fx.com/) 的免费阅读声明、Manhwa／Manhua 分类、Mature／Uncensored 题材及公开条漫正文；上述 `48b29182…` 提交明确标记 NSFW，原创／改编保持未知 |
| Asura Scans | [浏览目录](https://asurascans.com/browse) 的 Manhwa／Manhua 分类、公开条漫和关联小说；免费与锁定章节并存。上游 `48b29182…` 提交标记 SAFE |
| 包子漫画 | [分类](https://cn.baozimh.com/classify) 的国漫／日本／韩国／欧美选项、公开页漫与条漫、小说改编和 C103 同人搜索结果；抽查正文免费，上游标记 SAFE |

本节其他 Keiyoushi 引用固定到上述 `b647c92f…` 提交。成人标记依据网站整体目录，不代表插件会扩展现有的非成人筛选。

## 新实现的协议参考

- Comix 图片还原参数依据同一 `node-comics` 提交中的 `images.ts`，SHA-256 `3a7eedd0c9a8fbf1a14e67f89285d71f71dfc2e40d60fa3ce67e66ce0ad92113`。本插件仅声明已知算法与种子掩码，通用像素置换由 App 独立实现，不复制浏览器 Canvas／Blob 运行时。
- S2READ 依据 [s2read.com](https://s2read.com/) 当前原始响应与同一提交的 `sites/s2manga/README.md`（SHA-256 `ceaaf52a083fec840cb29fc18cac59f42bf813d8a3a338d3c341d77a82667ced`）及 `shared/madara/search.ts`（SHA-256 `3676260b1908a7d30a020d04ead94c6ff1715d43671dde9801ce160cdebb81fb`）核对协议，独立实现 Mangayomi DOM 适配器，未复制共享引擎代码。网站 HTML 和图片未进入发布包。
- RIDI 依据 [官方站点](https://ridibooks.com/) 的公开 HTML、只读 GraphQL 和阅读器响应独立实现。参考官方前端版本 `b28d6b` 的 [目录查询](https://static.ridicdn.net/books-frontend/p/b28d6b/_next/static/chunks/03ezojnr9-n3s.js)（SHA-256 `40a28b9fa5eb0480ff2ae336a63a711bdb9d12fa552c88365d040d485cf7946b`）、[搜索查询](https://static.ridicdn.net/books-frontend/p/b28d6b/_next/static/chunks/0vui-y-2njyvl.js)（`e9d9bd7300436063ced97a7ac4bca2e40fe7cc282b6118406a2a600384271895`），以及阅读器版本 `e8fef6` 的 [index-CErQqw3J.js](https://static.ridicdn.net/web-viewer/p/e8fef6/assets/index-CErQqw3J.js)（`0292a67b41233bed5475fc99ba984f40155ec92e6971016835e5b1de9365fce1`）。官方脚本未声明开源许可，仅核对字段、请求路径与权限语义，不复制、执行或分发下载的脚本，不处理 DRM 或购买流程。站点内容与签名地址不进入仓库。

## 开发依赖

[LinkeDOM](https://github.com/WebReflection/linkedom) 0.18.12，ISC，仅供 Node 测试和开发 HTTP 检查中的 DOM 模拟；不打包到插件或 App。精确包版本、来源与 npm SHA-512 integrity 摘要见 `package-lock.json`，完整许可在安装包 `node_modules/linkedom/LICENSE`。传递依赖同样由锁文件固定并保留各自许可。
