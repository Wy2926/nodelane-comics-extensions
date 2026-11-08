# Manga18fx

站点：[manga18fx.com](https://manga18fx.com/)。插件 ID `86001008`，最低 App 版本 `0.1.0`。支持热门、最新、关键词搜索、题材／原文／排序筛选、详情、完整章节目录和图片正文。英语译本与原文共用一个来源。卡片按已核实的韩漫、国漫、条漫、免费和成人内容标记；原创／改编资料不足，保持未知。

## 协议与边界

- 使用 YiiMadara 的公开 HTML：热门 `/hot-manga?page=N`、最新 `/page/N`、搜索 `/search?q=…&page=N`、题材 `/manga-genre/<slug>/N`、原文 `/manhwa-raw/N`。关键词优先于筛选，题材优先于原文分类；排序需搭配题材或原文分类。按上游行为将搜索中的 ASCII 撇号转换为弯引号。分页核对页码、查询条件与下一页标记。
- 目录已完整内嵌于详情 HTML，页面的 Show More 只控制展示。保留同名章节、特别篇、0 话与小数话，仅按完整规范 URL 去重；去重前仍核对作品归属。检查目录容器、分页标记与响应完整性。源站没有独立总数，无法证明无标记的服务端漏章。
- 章节日期使用源站 `dd MMM yy`／`dd MMM yyyy`，校验真实日历后返回时间戳。只有 NEW 图片、缺失或无效日期均返回未知，不用抓取时间代替上传时间。
- 阅读页核对 canonical、作品面包屑、首尾章节菜单及图片连续页位。保留重复图片所在页位，使用源站根地址作为 Referer。图片按源站返回的 HTTP(S) 地址读取，不限定 CDN 域名；不同章节可使用不同图片主机。编码文件名中的空格，不执行网页脚本。
- 列表、详情、正文各一次请求，超时 25 秒、连接超时 10 秒，不自动重试。单次 HTML 上限 4 MiB、列表 100 项、目录 10,000 章、正文 2,000 页。CF 验证／封禁、权限、限流与解析错误分别报告，验证由 App 的来源网页和网络能力处理。

## 来源与验证

移植 [Keiyoushi Manga18fx](https://github.com/keiyoushi/extensions-source/blob/48b291828458a32c97c3b167be453258c1bd5a86/src/all/manga18fx/src/eu/kanade/tachiyomi/extension/all/manga18fx/Manga18fx.kt) 与 YiiMadara 协议，按当前网页核对筛选与目录。Mangayomi 固定提交 `6004f1f8…` 的完整代码树和索引未发现同站实现。上游 Apache-2.0 原许可随 `parser.js` 保留，NodeLane 修改按 GPL-3.0-only 分发；摘要见 [THIRD_PARTY](../../THIRD_PARTY.md)。

合成回归覆盖筛选／分页、搜索规范化、空结果、可选封面、章节归属与去重、日期、首尾导航、重复图片页位、验证页和失败后重试，并通过 App QuickJS／原生 DOM；导航样本保留相似类名按钮，防止原生选择器误匹配。真实 HTML 也通过同一 App 解析入口。

真实匿名 HTTP 已验证热门／最新翻页、搜索与空结果、题材／原文／排序及末页；《The Return of the Crazy Demon》《The Hero Returns》《Doctor’s Rebirth》的目录与首章正文可解析，第一部的首末图片可下载。iOS 模拟器已核对本地来源图标／标签、热门、搜索、原生筛选界面、第一部的完整目录及日期、首章首末图片和切后台后页码保持。超长图能解码，显示比例仍由 App 当前阅读模式控制。未验证真实 CF 挑战、Android 和真机。

在本仓库运行：

```sh
npm run check
npm run test:app -- /绝对路径/nodelane-comics-app
```

排查真实章节时对比不同图片主机及失败／正常章节，只输出状态与数量；不保存源站页面、图片地址或会话到仓库。
