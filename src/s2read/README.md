# S2READ

第二个模板验证站点，精确认领 `https://s2read.com/manga/<作品>/` 和其章节路径。独立实现当前 Madara HTML／只读 AJAX 协议，不声明其他 Madara 网站自动可用。

热门、最新和搜索每页一条 `madara_load_more` 只读 POST，固定每页 12 项，返回轻量候选。成功空响应或已知末页标记才代表结束；短页无标记、验证页、WordPress 错误和重复条目失败。详情一次 GET 读取完整静态目录；遇到未加载的 AJAX 目录明确失败。正文一次 `?style=list` GET，核对 canonical、预填充导航与当前章节，图片槽必须连续，重复图片 URL 保留不同页位置。图片仅接受 s2read.com 与已知 cdn-N.s2read.com，保留本站 Referer。

真实 HTTP 已取得热门／搜索翻页、最新、空结果、955 条章节目录及测试章节 6 张图片清单。iOS 27 模拟器已验证本地目录安装与 0.1.1 更新、搜索／缺封面占位、955 条目录、第一章首尾页、下一章，以及后台返回保留第 3/7 页。缺少可选封面不丢弃有效作品，正文缺图仍明确失败。单元样本与真实 App QuickJS／DOM 桥分别验证；CF、真机与性能尚未验收。没有因继承同类引擎而开放未核验变体。

```sh
npm run check
npm run test:app -- /明确选择的App路径
node scripts/verify-s2read.mjs
```

实现依据当前源站原始响应及浏览器项目的协议说明，未复制其适配器或共享引擎实现。未提取只有一个消费站点的通用 Madara 框架。来源记录见 [THIRD_PARTY.md](../../THIRD_PARTY.md)。
