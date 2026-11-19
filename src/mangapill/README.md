# MangaPill

英文免费漫画。热门取首页 Trending Mangas，最新取最近更新的作品，两者均为单页。搜索按源站翻页，可按类型、状态和多个题材筛选。静态目录以章节完整地址区分不同组和特别篇，源站未给章节上传日期。

Keiyoushi 1.6.1 原包在 MuMu 将搜索末页的 Previous 和空结果的 Report Missing Manga 都判为下一页；按 App 调用方式取详情也缺标题和链接。本站改用 JS 移植浏览器版协议，来源见[第三方声明](../../THIRD_PARTY.md)。

Node 和 App QuickJS／DOM 有合成契约；真实 HTTP 已核对两页搜索、空结果、筛选和《Dragon Ball》520 条目录，并获取相邻两章的首尾图片。

MuMu Android 12 x86_64 已从本地目录安装 JS 包，搜索并打开《Dragon Ball》，从第一章第 36 页切至第二章；回到桌面再打开仍为 `8 / 14`。iOS、ARM 真机、断网重试与离线下载待验收。
