# 瓜子漫画

适配 `https://www.guazimanhua.com` 的公开漫画页面，沿用 `MProvider`。热门与最新分别按人气、更新时间读取分类目录；搜索支持中文与特殊字符，并提供题材、地区、受众、连载状态、排序五类筛选。每次列表请求只取当前页，下一页沿用相同条件；短页与完整 JSON-LD 一致时仍按分页导航继续。

作品地址为 `/comic.php?id=<ID>`，章节地址为 `/chapter.php?id=<ID>`。章节 URL 不含作品 ID，因此目录返回的章节带 `#nodelane-guazimanhua=<作品 ID>` 本地归属标记，发请求时移除片段，正文再核对 `Article.isPartOf`。缺少绑定的章节需刷新作品目录，不能靠章节名称猜所属作品。

详情一次 GET 读取全部 `.all-chapter-grid`，核对总数和 JSON-LD 目录预览；保留网站倒序、0 话、小数话与番外，不按 ID 大小排序。没有目录预览的空作品须由侧栏明确标为 0 话。源站没有逐章上传日期，统一返回未知；作品或正文的 `dateModified` 不作为章节上传时间。封面、作者、简介、题材和连载状态来自已核实的作品数据。

正文一次 GET 读取 `.reader-images` 全部图片，核对总数、连续页号及 JSON-LD 预览，保留重复 URL 的不同页槽；预览通常只有前 20 张，不能据此截断正文。普通图片由 App 读取，不需还原；正文仅接受 `img.guazicdn.com` 的 HTTPS 地址，封面另支持 `api.guaziapp.com` 的 HTTPS 地址。图标使用主站 `https://www.guazimanhua.com/favicon.ico`。

列表每页最多 36 项，页码上限 10000；单部目录上限 10000 章，单章上限 1500 页，HTML 上限 2 × 1024² 字符，主机另限制响应字节数。单次调用不并发请求、请求限时，不逐章抓日期，不缓存整本正文，不自动重试验证或限流。失败区分 `[GZ:verification]`、`rate-limit`、`identity`、`pagination`、`chapter-owner`、`page-count` 等原因，不以空成功结果替代故障。没有额外的持久化来源设置；登录、会员、付费与广告流程不属于公开阅读适配范围。

## 检查

```sh
npm run check
npm run test:app -- /明确选择的App路径
node scripts/verify-guazimanhua.mjs
# 串行抽查热门和最新首屏，最多 12 部目录：
node scripts/verify-guazimanhua.mjs --catalogs
```

Node 合成样本与实际 App QuickJS／DOM 桥覆盖列表、筛选定义、目录身份、空目录、未知日期及超出预览的完整正文。真实 HTTP 已抽查分页、搜索与五类筛选、多部作品目录（含零章节）、超过 20 页的正文及首末图片。iOS 模拟器已验证本地源安装／更新、图标、筛选、搜索、详情、空目录、正文与跨章阅读、后台恢复及继续阅读的页码保持。

真机、真实 CF 验证和性能尚未验收，Android 暂缓。来源、固定提交、摘要和 GPL-3.0-only 许可见 [THIRD_PARTY.md](../../THIRD_PARTY.md)。
