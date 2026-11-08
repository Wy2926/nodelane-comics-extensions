# Raw Otaku

站点：[rawotaku.com](https://rawotaku.com/)。插件 ID `86001007`，最低 App 版本 `0.1.0`。支持热门、最新、关键词搜索、类型／状态／语言／排序筛选、作品详情、完整章节目录和图片正文。站点含成人分类，公开正文免费；卡片按已核实的日本页漫、原创／改编标记。

## 协议与边界

- 列表使用 `/filter/`，关键词使用 `/?q=`。关键词搜索时网站不应用筛选；当前表单没有题材选项，不沿用上游已失效的题材列表。分页保留原查询条件，同一作品按规范 URL 去重。
- 详情从静态语言目录读取全部章节；同名、特别篇、小数章均保留，仅按规范 URL 去重。核对作品、语言、章节 ID、目录与响应完整性；源站没有独立总数，不能证明无标记的服务端漏章。源站未给出章节上传时间，返回未知日期。
- 阅读页模板的 `data-reading-id` 与实际章节不一致。每次从当前语言菜单按完整章节 URL 找到 ID，再请求 `/json/chapter?mode=vertical&id=…`。保留图片顺序及重复页位，不执行网页脚本。正文使用上游的图片自身 URL 作为 Referer。
- 列表、详情各一次请求，正文两次请求；每次超时 25 秒、连接超时 10 秒，不自动重试或缓存章节 ID。限制单次响应 4 MiB、列表 100 项、目录 10,000 章、正文 2,000 页。CF 验证、封禁、限流和结构错误分别报错；验证交给 App 的来源网页与主机网络能力。
- 图片范围仅覆盖实测的 `mgoimg.view47.com`、`sv1.freeimgmg.online`，及 `f002.backblazeb2.com/file/WCMS-Images/MangaOnline/`。新增主机需核实后适配。

## 来源与验证

优先移植 [Keiyoushi RawOtaku](https://github.com/keiyoushi/extensions-source/blob/b647c92fd14801fda23e866d5a7da7d5fdd7ec92/src/ja/rawotaku/src/eu/kanade/tachiyomi/extension/ja/rawotaku/RawOtaku.kt) 与 MangaReader 协议，再适配当前页面。Mangayomi 固定提交 `6004f1f8…` 的完整代码树和索引未发现同站实现。原实现 Apache-2.0；NodeLane 修改按 GPL-3.0-only 分发，原许可全文在 `parser.js`，文件摘要见 [THIRD_PARTY](../../THIRD_PARTY.md)。

合成样本覆盖筛选、分页、重复作品／章节、缺封面、空搜索、归属变化、模板 ID 错误、图片页序、失败与重试；通过 Node 与 App QuickJS／原生 DOM 契约检查。真实匿名 HTTP 已检查多页列表、日文搜索、筛选、多作品目录／正文，以及《ワンピース》的完整目录和首章首末图片。iOS 模拟器已验证本地来源卡片、热门、搜索、原生筛选、《ONE PIECE学園》完整目录、首章首末图片及切后台恢复原页。未验证真实 CF 挑战、Android 和真机。

在本仓库运行：

```sh
npm run check
npm run test:app -- /绝对路径/nodelane-comics-app
node scripts/verify-rawotaku.mjs
```

真实检查仅输出数量和状态摘要，不保存站点响应、图片地址或会话。
