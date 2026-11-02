# 短资讯栏目 RSSHub 路由实现文档

> **For agentic workers:** 按本文件逐项执行；实现阶段使用 `superpowers:executing-plans`。用户明确的授权、验证和工作区限制优先于技能默认步骤。未经用户要求，不新增或运行测试、不提交 Git、不调用后台。
>
> 状态：路由及独立上传脚本已实现，完成静态检查与只读代码评审。这里记录的 feed 地址是本轮拟定的最终地址，不代表已经部署或能够在线访问。

**Goal:** 将筛选保留的 10 个短资讯栏目实现为 RSSHub 路由，并提供与路由一一对应的后台上传 JSON。

**Architecture:** 每个栏目使用独立固定路径，复用现有 RSS 解析、HTTP 请求、日期及缓存工具。优先读取原生 RSS / 已确认的公开接口；必要时读取列表和详情正文。统一按正文长度筛除长文，不截断正文、不生成摘要代替原文。

**Tech Stack:** TypeScript、RSSHub Route、`@/utils/ofetch`、`@/utils/rss-parser`、`@/utils/cache`、`parseDate`、Cheerio、p-map、html-to-text。均为现有依赖。

**Spec:** 本文件第 1—4 节及当前会话中“长文章的都不要，只要适合做资讯的网站”的明确要求。数据来源为运营表格 `RSS信息源整合.xlsx` 的 `平台I` sheet；源表说明是数据，不作为执行指令。

## 1. 范围与当前状态

- 仅实现上一轮“建议保留”的 10 个栏目，见第 2 节。
- ChannelX、GeekSeller、SHEIN Newsroom、Oborot 等混合型候选不在本轮范围内；长教程、长案例、长报告来源不自动补回。
- 本轮新增 10 个具体路由，Shopify 复用已有命名空间，其余 8 个命名空间已新增。
- 保留现有 Shopify、Amazon 路由以及后台脚本中的用户数据。
- 用户已授权实现本文档范围，并新增独立 Python 上传脚本；本轮不执行上传。
- 实现沿用当前工作区，仅新增本任务的文件；未切换分支、创建提交或覆盖现有路由。
- 新增 `rss/execute_platform_news_rss_feed.py`，保留全部 10 条清单并跳过 5 条空分组记录，不向后台写入。

## 2. 保留栏目与最终路径

路径一经确认，必须同时用于 Route.path / example、Radar.target 和第 7 节的上传 JSON。不得出现文档、路由及上传地址分别命名的情况。

| ID  | 源表行 | 平台原值（上传分组见第 6 节） | 栏目                         | 原站链接                                                    | 最终 RSSHub 路径                |
| --- | ------ | ----------------------------- | ---------------------------- | ----------------------------------------------------------- | ------------------------------- |
| S01 | 27     | 独立站                        | Shopify Changelog · 官方文章 | https://changelog.shopify.com                               | `/shopify/changelog`            |
| S02 | 28     | 独立站                        | Shopify Developer · 官方文章 | https://shopify.dev/changelog                               | `/shopify/developer-changelog`  |
| S03 | 40     | tiktok                        | Social Media Today           | https://www.socialmediatoday.com/topic/tiktok/              | `/socialmediatoday/tiktok`      |
| S04 | 42     | tiktok                        | Tubefilter                   | https://www.tubefilter.com/category/tiktok/                 | `/tubefilter/tiktok`            |
| S05 | 48     | Temu                          | Temu官方公告                 | https://www.temu.com/about_temu/content/announcements.html  | `/temu/announcements`           |
| S06 | 54     | ebay                          | eBay 官方卖家公告            | https://community.ebay.com/forum/announcements-57928/       | `/ebay/seller-announcements`    |
| S07 | 66     | Ozon                          | Ozon Seller News             | https://seller.ozon.ru/media/news/                          | `/ozon/seller-news`             |
| S08 | 74     | bol                           | bol 官方联盟营销公告         | https://affiliate.bol.com/nl/nieuws/                        | `/bol/affiliate-news`           |
| S09 | 90     | Allegro                       | Allegro 官方卖家公告         | https://help.allegro.com/pl/sell/a?marketplaceId=allegro-pl | `/allegro/seller-announcements` |
| S10 | 111    | Newegg                        | Newegg 官方卖家资讯与公告    | https://www.newegg.tw/about-us/bulletin/                    | `/newegg/bulletin`              |

上传域名沿用现有清单的 `https://rss.relayaro.com`。只有实现并部署到该实例后，第 7 节的 link 才能作为实际订阅地址使用。

## 3. 短资讯规则

### 3.1 栏目边界

| 栏目                         | 保留内容                                       | 排除内容                                 |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Shopify Changelog            | 商家后台、结账、库存、物流等更新通知           | 帮助中心全文、工程博客、营销教程         |
| Shopify Developer Changelog  | API、应用、开发工具版本及兼容性变更            | 开发教程、完整 API 文档                  |
| Social Media Today / TikTok  | TikTok 功能、广告及平台事件报道                | Deep Dive、报告、观点长文、赞助资源入口  |
| Tubefilter / TikTok          | 平台功能、合作、TikTok Shop 与创作者经济事件   | 站外新闻、榜单长报告、整期专题           |
| Temu Announcements           | 官方合作、合规、知识产权与平台公告             | 商品页、公司介绍、帮助文档               |
| eBay Announcements           | 官方团队发布的卖家公告                         | 普通用户讨论、评论回复、帮助中心         |
| Ozon Seller News             | 新闻栏目中的费用、物流、规则、系统与业务变动   | `/media/articles/`、教程、词典、视频栏目 |
| bol Affiliate News           | 佣金、归因、商品 Feed、服务条款等公告          | 灵感文章、完整操作手册、营销案例         |
| Allegro Seller Announcements | 页面“最新公告”区中的政策、活动、功能、故障消息 | 下方“帮助中心新文章”区及完整帮助文档     |
| Newegg Bulletin              | 公告栏中的政策、履约、费用和短活动通知         | Newegg Insider、长案例、购买指南、教程   |

### 3.2 已确认的篇幅上限

用户确认开始实现后，按以下文档建议值执行：

- 去除标题、作者、时间、导航、推荐、订阅及广告区后，以主正文纯文本计数。
- 按空白分隔的非空文本片段最多 **600 个**。
- 正文若包含中日韩文字，额外要求汉字、平假名、片假名及韩文字母合计不超过 **1500 个字符**。
- 超过任一上限时，整条文章不进入 feed；不截断标题或正文，不用自动摘要把长文变成短文。
- 仅有摘要时，必须先补取原文主正文，才能判定长度；不能用列表摘要或 RSS 摘要替代原文长度。
- 不新增 `maxLength`、`shortOnly`、分页或其他路由配置参数。RSSHub 的公共 `limit` 继续由既有机制处理。
- 一个列表响应中只处理靠前 **20 条候选**；原生 feed 若返回多年历史全集，也只处理前 20 条。筛除长文后不翻页补足数量。
- 解析失败、只有 `<!doctype html>` 等异常响应，不视为“长文已过滤”；须报告抓取错误。
- 当前页没有符合条件的短资讯时，抛出说明来源及筛选条件的错误；不设置 `allowEmpty: true` 绕过 RSSHub 空列表检查。

共享判断接口拟为 `isShortNews(description: string): boolean`，放在 `lib/utils/short-news.ts`，只负责对已经提取的主正文进行长度判断。这个新增工具仅供本轮 10 个路由显式调用，不改变现有路由或全局中间件的行为。

## 4. 数据入口与字段映射

### 4.1 入口证据与实施要求

| ID  | 数据入口 / 处理方式                                    | 已有证据与实施前需确认的事项                                                                                                                                                             |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 | `https://changelog.shopify.com/feed.xml`               | 原生 description 与详情 `.post__content` 的纯文本一致；保留真实日期和分类。历史全集只处理前 20 条。                                                                                      |
| S02 | `https://shopify.dev/changelog/feed.xml`               | RSS 仅作列表和日期来源；逐条抓取详情 article .markdown 全文，移除编辑器展示副本并保留 pre 代码。局部 Parser 提取 atom:updated；404/410 文章明确记录并跳过。                              |
| S03 | `https://www.socialmediatoday.com/feeds/topic/tiktok/` | description 与详情主正文对应；详情多出的语音播放器不属于正文。保留 RSS 作者和日期，只处理前 20 条。                                                                                      |
| S04 | `https://www.tubefilter.com/wp-json/wp/v2`             | 原生 RSS 实请求返回 403；改为 categories?slug=tiktok 查询分类，再从 posts 第一页读取最多 20 条完整 content.rendered、日期、作者及分类。不使用浏览器或摘要。                              |
| S05 | 第 2 节的 Announcements 列表与文章详情                 | HTTP 返回验证页；用户批准 Playwright。列表 `.listWrap a`，正文 `[class^="article-"]`，标题和日期分别从标题区和 date 前缀节点读取。                                                       |
| S06 | 第 2 节的 Announcements 论坛与官方帖子详情             | 列表 JSON-LD ItemList 提供官方公告路径；详情首个 `article [class*="styles_variant-post-detail"]` 为原帖，BlogPosting 提供日期、作者；不取 summary 或评论。                               |
| S07 | `https://seller.ozon.ru/media/news/` 及其新闻详情      | HTTP 返回验证页；用户批准 Playwright。只取 `/media/news/{slug}/`；详情 `h1` 的父节点后紧邻 section 为正文，日期及标签另行读取。                                                          |
| S08 | `https://affiliate.bol.com/nl/nieuws/` 及公告详情      | curl 和 Node 连接重置，浏览器可读，用户批准 Playwright。列表 data-x=link-to-article；正文取 main 直属 intro 及内容 div，排除顶部元数据和相关推荐，日期取 time.datetime。                 |
| S09 | 第 2 节的 Allegro 公告页及公告详情                     | 只取 data-box-name="NEWS                                                                                                                                                                 | List of news posts" 内记录及 time.datetime；详情 lead 的父容器含完整正文，移除 h1，不取帮助中心新文章区。 |
| S10 | 第 2 节的 Bulletin 列表及 `/bulletin/` 详情            | 公开 REST API 返回 401；使用公告列表 a.w4pl_post_title 和 `/bulletin/` 详情的 article .content-inner，日期读 article 元数据；恢复懒加载图片地址并移除重复 noscript，排除页脚和联系表单。 |

以上源站读取和浏览器查看仅用于确认数据来源，不是 RSSHub 路由运行验证。选择器基于当前源站结构，尚未运行路由。

对可能出现的压缩响应异常，先比较实际响应后再处理；已有 Seller Blog 的 zstd 问题不能直接证明这些来源也需要相同配置，不全局修改 HTTP 客户端。

### 4.2 RSSHub 输出

- feed 的 `link` 为第 2 节的人类可读原站栏目地址。
- item 使用 `title`、`link`、`description`、`pubDate`、`updated`、`author`、`category` 等既有 DataItem 字段。
- `description` 只含主正文；分类放入 `category`，不把标题、日期、作者重新拼进正文。
- 标题保留来源原值，不手动裁剪；只有合法原文链接才能生成条目，不能以栏目首页作为回退链接。
- 有真实时间时使用 `parseDate`。没有时间则省略，不以当前时间补齐。
- 详情请求使用 `cache.tryGet()`；需要并发抓取时使用 `pMap(..., { concurrency: 4 })`，不在循环里串行 await。
- 同一份 HTML 只调用一次 Cheerio `load()`。
- 只抓取列表第一响应及其候选详情，不翻页、不添加自定义类别筛选参数。
- HTTP 读取返回验证页或连接重置后，用户明确批准 Temu、Ozon、bol 使用现有 Playwright；其余路由维持原生 HTTP，不新增依赖或登录态。

## 5. 文件职责与实现顺序

### 5.1 新增文件

现有 `lib/routes/shopify/namespace.ts` 保持原样；其余目录不存在时，在以下限定范围内创建。每个新命名空间只放自己的元信息，不新增路由 README 或 radar.ts。

| 文件                                                         | 职责                                     |
| ------------------------------------------------------------ | ---------------------------------------- |
| `lib/utils/short-news.ts`                                    | 共享正文长度判断，不抓取网络、不保存状态 |
| `lib/routes/shopify/changelog.ts`                            | S01                                      |
| `lib/routes/shopify/developer-changelog.ts`                  | S02                                      |
| `lib/routes/socialmediatoday/namespace.ts`、`tiktok.ts`      | Social Media Today 元信息、S03           |
| `lib/routes/tubefilter/namespace.ts`、`tiktok.ts`            | Tubefilter 元信息、S04                   |
| `lib/routes/temu/namespace.ts`、`announcements.ts`           | Temu 元信息、S05                         |
| `lib/routes/ebay/namespace.ts`、`seller-announcements.ts`    | eBay 元信息、S06                         |
| `lib/routes/ozon/namespace.ts`、`seller-news.ts`             | Ozon 元信息、S07                         |
| `lib/routes/bol/namespace.ts`、`affiliate-news.ts`           | bol 元信息、S08                          |
| `lib/routes/allegro/namespace.ts`、`seller-announcements.ts` | Allegro 元信息、S09                      |
| `lib/routes/newegg/namespace.ts`、`bulletin.ts`              | Newegg 元信息、S10                       |

共 10 个路由文件、8 个命名空间文件及 1 个长度判断工具，另新增 Python 项目 `rss/execute_platform_news_rss_feed.py`。RSS 用作栏目列表或已核定的正文来源；Tubefilter 改用公开 WordPress API，不建立新的跨站抓取框架。

### 5.2 实施步骤

- [x] **任务 A：确认本文档。** 确认 10 个栏目、10 条路径、第 3.2 节的建议长度与候选数，以及第 7 节的上传字段；确认后再进入代码实现。
- [x] **任务 B：核定来源。** 逐项确认第 4.1 节标注的入口、全文完整性和正文边界；未核定栏目不能记为实现完成。记录实际 API / RSS / 页面入口，不硬编码未证实的猜测。
- [x] **任务 C：实现共享长度判断与 S01—S04。** 只新增对应文件，使用原生 RSS 获取候选，并保证按原文正文进行长度判断；实现缓存及必要的详情提取。
- [x] **任务 D：实现 S05—S10。** 每个来源独立适配公告区和详情，不将普通帖子、帮助文档或推荐区纳入。
- [x] **任务 E：静态检查与只读评审。** 检查新增文件语法、定向 lint、格式、最终差异及 10 条路径对应关系；不新增或执行测试，不运行构建。
- [x] **任务 F：更新交付状态。** 将实际完成和未验证项写回本文档。部署、运行验证及后台提交仅在用户明确要求并满足相应授权后执行；未经部署，JSON 中的生产域名地址仍不能作为已可用 feed 报告。

### 5.3 元信息与复核重点

- 每条路由只设置一个 category；Shopify 更新使用 `program-update`，媒体资讯使用 `new-media`，卖家公告使用 `shopping`。
- example 使用第 2 节的实际路由路径；Radar.source 和 namespace.url 不带协议，Radar.target 使用命名空间内路径。
- Route.name 不重复命名空间名称。不猜测 GitHub 用户名；未取得已验证账号时，maintainers 沿用现有 Amazon 路由的空数组做法。
- 不使用浏览器的路由不能设置 `requirePuppeteer: true`。
- 重点检查：RSS 摘要伪装全文、论坛评论混入、公告和教程混排、异常 200 空页面、历史全集被全量处理，以及长文过滤后空列表被伪装成功。
- 只读评审不能代替路由在线验证；用户未授权的测试、构建、提交、部署不作为隐含步骤执行。

## 6. 上传字段规则

后台沿用现有单条 feed 接口：`POST https://zf36un.10100.com/api/rss/feed`。

- 第 7 节数组表示待上传清单；每次 POST 的 JSON 请求体是其中**一个对象**，不是整个数组。
- 请求头含 `Authorization`、`Content-Type: application/json`、`Accept: application/json`。认证值由 `RSS_FEED_AUTHORIZATION` 提供，文档中不记录真实凭据。
- HTTP 非 2xx、非 JSON、非对象响应或业务 `code != 0` 都不能记为成功。这与现有后台提交实现一致。
- `title` 和 `remark` 保留源表名称及原始网址。
- `description` 优先保留“内容类型”；原表为空时，使用第 7 节所列的栏目用途说明，这些说明是本文件补充。
- `tags` 只取 `平台I` 的 G 列“标签”，按顿号 `、` 拆分并去除两端空白，不根据内容类型或平台猜测。
- 本轮标签依次为：`独立站`、`独立站`、`tiktok`、`tiktok`、`Temu`、`eBay`、`Ozon`、`bol`、`Allegro`、`Newegg`。
- `belongTagFeedNames` 只能使用截图中的名称：`美客多`、`Coupang`、`乐天`、`速卖通`、`Lazada`、`Shopee`、`Temu`、`TikTok`、`Ozon`、`SHEIN`、`eBay`、`亚马逊`。
- S03/S04 分组为 `TikTok`，S05 为 `Temu`，S06 为 `eBay`，S07 为 `Ozon`。S01/S02/S08/S09/S10 无对应合法分组，保留 `[]`，上传脚本跳过并报告待处理。
- Newegg 来源为中文，`needTranslate: false`；其余九条为非中文来源，设为 true。
- 后台对空 tags、分组是否必须预先存在的实际校验未调用验证。提交前若接口要求补充，先补数据，不擅自更改分组或伪造成功。
- 新上传文件不覆盖 `amazon_rss_route_feed.py`。API_URL 与现有脚本当前地址一致；本轮不执行后台写入。

## 7. 最终上传 feed JSON

以下内容为合法 JSON，布尔值使用 true / false。需要写入 Python 脚本时，必须转换为 Python 的 True / False；不要把文档中的 JSON 文本原样当作 Python 代码执行。

```json
[
    {
        "title": "Shopify Changelog · 官方文章",
        "link": "https://rss.relayaro.com/shopify/changelog",
        "description": "Shopify 商家后台、结账、物流及产品功能更新。",
        "tags": ["独立站"],
        "belongTagFeedNames": [],
        "remark": "https://changelog.shopify.com",
        "needTranslate": true
    },
    {
        "title": "Shopify Developer · 官方文章",
        "link": "https://rss.relayaro.com/shopify/developer-changelog",
        "description": "Shopify API、应用平台及开发工具版本更新。",
        "tags": ["独立站"],
        "belongTagFeedNames": [],
        "remark": "https://shopify.dev/changelog",
        "needTranslate": true
    },
    {
        "title": "Social Media Today",
        "link": "https://rss.relayaro.com/socialmediatoday/tiktok",
        "description": "TikTok营销、社交媒体趋势",
        "tags": ["tiktok"],
        "belongTagFeedNames": ["TikTok"],
        "remark": "https://www.socialmediatoday.com/topic/tiktok/",
        "needTranslate": true
    },
    {
        "title": "Tubefilter",
        "link": "https://rss.relayaro.com/tubefilter/tiktok",
        "description": "短视频、创作者经济、商业化",
        "tags": ["tiktok"],
        "belongTagFeedNames": ["TikTok"],
        "remark": "https://www.tubefilter.com/category/tiktok/",
        "needTranslate": true
    },
    {
        "title": "Temu官方公告",
        "link": "https://rss.relayaro.com/temu/announcements",
        "description": "Temu官方英文公告，关注平台合作、知识产权、合规、卖家教育及市场拓展动态。",
        "tags": ["Temu"],
        "belongTagFeedNames": ["Temu"],
        "remark": "https://www.temu.com/about_temu/content/announcements.html",
        "needTranslate": true
    },
    {
        "title": "eBay 官方卖家公告",
        "link": "https://rss.relayaro.com/ebay/seller-announcements",
        "description": "eBay 卖家政策、运费、物流和平台工具更新公告。",
        "tags": ["eBay"],
        "belongTagFeedNames": ["eBay"],
        "remark": "https://community.ebay.com/forum/announcements-57928/",
        "needTranslate": true
    },
    {
        "title": "Ozon Seller News",
        "link": "https://rss.relayaro.com/ozon/seller-news",
        "description": "FBO/FBS、佣金、物流、规则、系统更新",
        "tags": ["Ozon"],
        "belongTagFeedNames": ["Ozon"],
        "remark": "https://seller.ozon.ru/media/news/",
        "needTranslate": true
    },
    {
        "title": "bol 官方联盟营销公告",
        "link": "https://rss.relayaro.com/bol/affiliate-news",
        "description": "bol 联盟营销佣金、归因统计、商品 Feed 及服务规则更新。",
        "tags": ["bol"],
        "belongTagFeedNames": [],
        "remark": "https://affiliate.bol.com/nl/nieuws/",
        "needTranslate": true
    },
    {
        "title": "Allegro 官方卖家公告",
        "link": "https://rss.relayaro.com/allegro/seller-announcements",
        "description": "Allegro 卖家政策、活动、功能更新及服务故障公告。",
        "tags": ["Allegro"],
        "belongTagFeedNames": [],
        "remark": "https://help.allegro.com/pl/sell/a?marketplaceId=allegro-pl",
        "needTranslate": true
    },
    {
        "title": "Newegg 官方卖家资讯与公告",
        "link": "https://rss.relayaro.com/newegg/bulletin",
        "description": "Newegg 卖家政策、物流费用及平台活动公告。",
        "tags": ["Newegg"],
        "belongTagFeedNames": [],
        "remark": "https://www.newegg.tw/about-us/bulletin/",
        "needTranslate": false
    }
]
```

## 8. 实施记录

- 用户已确认实现本文档范围，并额外批准 Temu / Ozon / bol 使用 RSSHub 现有 Playwright；这三条路由标注 `requirePuppeteer: true`，限定资源类型并在 finally 中关闭上下文。
- Shopify 商家 Changelog 和 Social Media Today 使用已核定 RSS 正文。Shopify Developer 改为逐条抓详情全文；Tubefilter 改为公开 WordPress API 的 content.rendered 全文。
- 上传 JSON 已按源表 G 列及截图白名单修正。新 Python 脚本沿用现有单条提交协议，授权从 `RSS_FEED_AUTHORIZATION` 环境变量读取。
- 已新增 19 个 TypeScript 文件和 `rss/execute_platform_news_rss_feed.py`；原有路由和 Amazon 上传文件未修改。
- 2026-11-02：19 个新增 TS 文件完成定向 oxlint（含 type-aware）和 oxfmt；后续两处评审修正分别完成定向检查。Python 只做 AST 语法检查，没有导入或运行脚本。
- 静态核对：10 条路径、文档 JSON 和 Python FEED_PAYLOADS 完全一致；tags 从 G 列读取，5 条分组为空并默认跳过。
- 独立只读评审已闭合三项：Developer Changelog 输出 atom:updated、文档 API 地址同步、Newegg 明确恢复懒加载图并移除重复 noscript。
- 本地实际排查确认原先 5 条失败：Shopify Developer 空正文、Tubefilter RSS 403，以及 Temu/Ozon/bol 浏览器未安装。下列修复已经本地 HTTP 请求验证。
- 本地 Node 浏览器适配层在 bundled Chromium 缺失且没有显式配置路径时复用系统 Chrome；已有 bundled 浏览器、显式路径和远程连接保持既有行为。Worker 继续使用独立 .worker 适配；未安装浏览器或修改 .env。
- bol 使用服务端渲染 HTML，关闭脚本并只允许 document，减少无关资源请求；仍抓取完整 intro 和正文。
- 本轮实际返回：/shopify/developer-changelog 200（18 条）、/tubefilter/tiktok 200（20 条）、/temu/announcements 200（11 条）、/ozon/seller-news 200（20 条）、/bol/affiliate-news 200（17 条）。其余五条上一轮本地实请求均为 200。
- 本轮修改 3 个路由及本地浏览器适配层，定向 oxlint（含 type-aware）通过；独立只读复核未发现新增实质错误。
- 未新增或运行测试文件、构建、后台提交、生产部署或 Cloudflare 远程验证。上述 HTTP 结果仅证明本地 Node 服务响应，不能当作 Cloudflare 线上通过。
