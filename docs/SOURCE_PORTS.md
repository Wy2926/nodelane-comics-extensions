# 浏览器来源移植队列

对照[官网支持网站](https://comics.nodelane.net/sites/)和 [node-comics 站点目录](https://github.com/Wy2926/node-comics/tree/9af732af4e3d7eb8d042db1c5f3877844086c6df/apps/extension/src/sources/sites)。优先有读者基础、匿名可读、可核实完整目录的站点；同站镜像不单独分配身份。下表是移植队列，可安装渠道见根 README。

| 顺序 | 站点 | 选择依据 | 当前入口／待办 |
| --- | --- | --- | --- |
| 1 | MangaPill | 英文免费漫画、热门榜与分类搜索 | [JS 来源](../src/mangapill/) |
| 2 | となりのヤングジャンプ | 集英社日语站，《一拳超人》等有公开连载章节 | [原包来源](../src/tonarinoyj/) |
| 3 | 拷贝漫画 | 中文免费目录，两个浏览器入口指向同站 | [原包来源](../src/mangacopy/)；需含请求头修复的 Android 宿主 |
| 4 | MangaDex | 多语免费目录，英语和多语来源均有可读样本 | [原包多语来源](../src/mangadex/)；需含请求头修复的 Android 宿主 |
| 5 | MangaSushi | 英文免费日漫，有公开译组目录 | [原包来源](../src/mangasushi/) |
| 6 | MangaDNA | 英文免费条漫，补充韩漫／国漫覆盖 | [原包来源](../src/mangadna/)；修复版 App 已验证长条漫跨章及恢复 |
| 7 | 漫画猫（00jf） | 简中免费、国／日／韩漫，现有浏览器协议可独立移植 | [JS 来源](../src/jf00/) |
| 8 | 少年ジャンプ＋ | 集英社日语连载，公开话与付费话并存 | [JS 来源](../src/shonenjumpplus/) |
| 9 | Seasons | 文藝春秋的免费日语漫画，含小说改编 | [JS 来源](../src/comicseasons/) |
| 10 | FEEL web | 日语免费刊物，部分旧话不再公开 | [JS 来源](../src/feelweb/) |
| 下一批 | WEBTOON、MANGA Plus | 有免费章节的多语平台 | 先验公开章节，核对地区、外链和混合收费 |

第 8–10 项使用 Keiyoushi 的 JS 移植，需要带 `image.tile-transpose.v1` 的 App。三站都是新增来源；本地对照原包中的作品和章节标识不等同于 JS 的网站 URL，不迁移原包试读进度。

逐站验收范围见 `src/<slug>/README.md`。试用待验收来源可运行 `npm run build`，再用 `python -m http.server 8787 --bind 127.0.0.1 --directory .build` 提供本地目录；以开发版 App 的 `NODELANE_CATALOG_URL` 指向该服务的 `/index.json`。Android 模拟器可用 `adb reverse tcp:8787 tcp:8787` 访问。
