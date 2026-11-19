# 浏览器来源移植队列

选自 [node-comics 站点目录](https://github.com/Wy2926/node-comics/tree/9af732af4e3d7eb8d042db1c5f3877844086c6df/apps/extension/src/sources/sites)。优先有读者基础、匿名可读、可核实完整目录的站点；同站镜像不单独分配身份。下表是首批及候补，不是已发布目录。可安装渠道见根 README。

| 顺序 | 站点 | 选择依据 | 当前入口／待办 |
| --- | --- | --- | --- |
| 1 | MangaPill | 英文免费漫画、热门榜与分类搜索 | [JS 来源](../src/mangapill/) |
| 2 | となりのヤングジャンプ | 集英社日语站，《一拳超人》等有公开连载章节 | [原包来源](../src/tonarinoyj/) |
| 3 | 拷贝漫画 | 中文免费目录，两个浏览器入口指向同站 | [原包来源](../src/mangacopy/)；App 正文重试待修 |
| 4 | MangaDex | 多语免费目录，英语和多语来源均有可读样本 | [原包多语来源](../src/mangadex/)；App 列表 HTTP 403 待排查 |
| 候补 | MangaSushi、MangaDNA | 英文免费站，分别补充日漫和条漫 | 核对域名、真实目录及首尾图 |
| 后续 | 漫画猫、少年ジャンプ＋、WEBTOON | 中文目录与有免费章节的日／英／繁中平台 | 先验无需购买的章节，混合收费按站点单独标注 |

逐站实现与本地验证随本站提交；验收范围只维护在 `src/<slug>/README.md`。
