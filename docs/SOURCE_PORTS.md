# 浏览器来源移植队列

选自 [node-comics 站点目录](https://github.com/Wy2926/node-comics/tree/9af732af4e3d7eb8d042db1c5f3877844086c6df/apps/extension/src/sources/sites)。优先有读者基础、匿名可读、可核实完整目录的站点；同站镜像不单独分配身份。下表是首批及候补，不是已发布目录。可安装渠道见根 README。

| 顺序 | 站点 | 选择依据 | 当前入口／待办 |
| --- | --- | --- | --- |
| 1 | MangaPill | 英文免费漫画、热门榜与分类搜索 | [JS 来源](../src/mangapill/) |
| 2 | となりのヤングジャンプ | 集英社日语站，《一拳超人》等有公开连载章节 | [原包来源](../src/tonarinoyj/) |
| 3 | 拷贝漫画 | 中文免费目录，两个浏览器入口指向同站 | [原包来源](../src/mangacopy/)；需含请求头修复的 Android 宿主 |
| 4 | MangaDex | 多语免费目录，英语和多语来源均有可读样本 | [原包多语来源](../src/mangadex/)；需含请求头修复的 Android 宿主 |
| 5 | MangaSushi | 英文免费日漫，有公开译组目录 | [原包来源](../src/mangasushi/) |
| 6 | MangaDNA | 英文免费条漫，补充韩漫／国漫覆盖 | [原包来源](../src/mangadna/)；修复版 App 已验证长条漫跨章及恢复 |
| 7 | 漫画猫（00jf） | 简中免费、国／日／韩漫，现有浏览器协议可独立移植 | [JS 来源](../src/jf00/) |
| 下一批 | 少年ジャンプ＋、WEBTOON、MANGA Plus | 日／英／繁中等有免费章节的平台 | 先验公开章节，核对地区、外链和混合收费 |
| 候补 | Comic Seasons、Feel Web | 浏览器版标注免费，有与 Young Jump 同系列的上游扩展 | 核对本站目录、免费话及实际图像，再逐站分配 ID |

逐站验收范围见 `src/<slug>/README.md`。试用待验收来源可运行 `npm run build`，再用 `python -m http.server 8787 --bind 127.0.0.1 --directory .build` 提供本地目录；以开发版 App 的 `NODELANE_CATALOG_URL` 指向该服务的 `/index.json`。Android 模拟器可用 `adb reverse tcp:8787 tcp:8787` 访问。
