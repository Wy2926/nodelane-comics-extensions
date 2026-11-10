# Comix

NodeLane 版本 **0.4.0**，来源 ID `86001001`。从归档 0.2.3 恢复 GPL-3.0-only JavaScript 实现，参考 PC node-comics 的网页上下文请求方式；不移植 Chrome 扩展运行时，不修改 App。

`sourceCodeLanguage: 1` 选择既有 JS 运行时，入口仍为 `MProvider`。每次调用 `evaluateJavascriptViaWebview(url, headers, scripts, 120)` 打开一个临时隐藏页面，注入随插件打包的脚本，在页面内签名并执行同源 `fetch`，通过 `setResponse` 一次性返回完整结果。宿主收到结果或等待超时后销毁页面；不是复用用户可见标签页，也没有浏览器书架导入按钮。

热门、最新和搜索打开 `/browse`；详情和图片清单打开作品页，避免提前加载章节图片。先等待 Comix 自身验证结束且真实目录／作品列表出现；已就绪则立即请求，不固定延时。`waf-captcha-solved` 同源通知仅唤醒状态检查，不单独放行。验证等待上限 60 秒，每 250 毫秒检查状态；完成或失败时清理监听与定时器。

详情及全部目录分页在同一页面内串行完成，复用协议材料，仅 `key_retired` 刷新一次。单次网络请求限时 25 秒，宿主整个页面限时 120 秒（含验证等待）。验证码、超时、分页缺失／重复／变动均报告失败，不用部分目录覆盖完整数据；不能立即响应调用方取消，不跨调用保活页面。

当前仅支持英文、普通分级作品，保留每个上传版本的独立 URL 与汉化组，以及 `image.tile-shuffle.v1` 图片还原声明；插件不合并同话版本，连续阅读选择由 App 决定。作品／章节沿用 `/title/…` 地址，不迁移或删除书籍；**0.3.0 原生扩展保存的路径不能直接使用，需从此版本来源重新打开作品**。旧包、源码和原许可继续保留在 `repo/`，本地构建不更新 stable/testing 渠道。

验证方式：

- `npm run check`：页面脚本回归与独立构建／归档恢复检查。
- `npm run test:app -- --app /明确选择的App路径`：真实 QuickJS、既有 HTTP 桥与原生模型契约检查，站点响应为模拟。通过 `FLUTTER` 指定与 App `.dart_tool/package_config.json` 匹配的 SDK 入口。

验证边界：MuMu Android 12 x86_64、App 0.1.1（6002）的隐藏网页服务已实测热门、完整分页目录及图片清单；不等同于图片下载、跨章／后台恢复验收。iOS、ARM 真机及插件内升级尚未验证。若网站要求人工交互，隐藏页不能切换为可见验证窗口，也不保证共享可见浏览器的验证状态；验证超时或再次返回 `captcha_required` 会如实报告。

来源和许可见 [THIRD_PARTY.md](../../THIRD_PARTY.md)，JS 许可全文见仓库 [LICENSE](../../LICENSE)。
