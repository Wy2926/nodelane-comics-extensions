# Comix

支持 `https://comix.to/title/<hid>-<slug>` 及其章节地址。热门、最新、名称搜索、完整分页目录和图片清单沿用 `MProvider`；保留每个上传、扫描组、0 话和小数话。默认普通分级目录，未实现站点账号或付费操作。

公开协议材料从源站 HTML 与已知 main/apicore 资源按需读取，只作为文本解析，不执行远程脚本。同一插件实例只缓存一份 1088 字节材料并合并加载；冷启动通常额外 3 次请求。仅 `key_retired` 刷新一次并加刷新参数避免 CDN 旧缓存；`captcha_required`、CF、未知协议和解码失败明确报错。目录上限 100 页／10000 条，串行读取；局部失败不返回半份目录。

普通图片直接返回清单；`s:1` 声明 `image.tile-shuffle.v1`，由 App 在图片响应后按算法 3 与已知种子掩码还原。较旧 App 会明确提示更新。此实现参考浏览器项目的已知协议，手机端真实图片与浏览器端应分别验收。

```sh
npm run check
npm run test:app -- /明确选择的App路径
npm run verify:live
node scripts/verify-comix-images.mjs
```

Node 样本覆盖签名、Unicode、退休材料、完整目录及错误边界；App 契约样本覆盖实际 QuickJS 和图片参数传递。图片处理还有 App 的像素、边缘、失败、缓存隔离与 HTTP 阅读器入口测试。iOS 27 模拟器使用设备现有会话已加载热门及测试作品的完整 471 条目录，但章节接口仍返回 `captcha_required`；命令行环境也遇到该验证要求。需要设备内网页验证后继续，不能把目录或合成样本通过视为真实 CF、真机或图片显示验收。真实图片脚本仅保存最多 3 张到忽略目录，不输出签名地址。

来源、固定提交、摘要和 GPL-3.0-only 许可见根目录 [THIRD_PARTY.md](../../THIRD_PARTY.md)。
