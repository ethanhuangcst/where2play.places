# where2play — 产品规格

**where2play**（`where2play.place`）产品需求。地图工具、vendor 密钥、**L1 候选发现**在 **places-agent**；**L2 按天排程与行程助手**在 where2play BFF 本应用 OPENAI_CN（[ADR-036](../../workspace-specs/adr/ADR-036-where2play-assistant-quanzil.md)、[ADR-037](../../workspace-specs/adr/ADR-037-where2play-plan-l2-quanzil.md)）。家族架构见 [`workspace-specs/2.architecture.md`](../../workspace-specs/2.architecture.md)；agent 能力见 [`1.places-agent/agent-specs/`](../../1.places-agent/agent-specs/)；地图/引擎边界见 [ADR-008](../../workspace-specs/adr/ADR-008-itinerary-ownership.md)。设计规格见 [`2play-design.md`](./2play-design.md)。用户故事与 AC 见 [`2play-stories.md`](./2play-stories.md)。测试与质量门见 [`2play-test-plan.md`](./2play-test-plan.md)。持久化见 [ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md)。

## 产品定义

帮助「不知道去哪玩」的用户：在 **个人信息（Profile）** 保存轻量出行兴趣偏好；在 **行程规划（Plan）** 填写边界后，经 BFF **一次推荐一条行程**（discover→OPENAI_CN arrange），同页展示 **Day-by-Day / Hour-by-hour**；页内 **单一 Chat** 随动修改当前行程；支持 **重新规划**、**保存** 到 **我的行程（Saved）**、以及 **PDF 导出**。

**MVP-10 目标态（方案已确定 2026-08-31，待实现）：** Plan 简化为 5 必填 + 悬浮助手问答；BFF 改调 agent `make_itinerary` → 循环 `plan_next_stop`/`display_current_stop`（详见 [`itinerary-design.md §1.3`](./itinerary-design.md)）；退役 BFF 本地 OPENAI_CN arrange 与假 progressive。当前 as-built 仍为 Mode H（下文职责划分）。

**性能取舍（as-built）：** 不一次生成多条行程；L2 走产品 OPENAI_CN（Mode H 拉 agent prompt）+ `enrich_arrange_transit`。

场所与地图经 BFF 以 **HTTP + caller API key** 调用 places-agent（**discover** / search / geocode / navigate）。**初排 L2 与行程助手**由 where2play BFF 调用本应用 OPENAI_CN。浏览器不持有 map vendor 密钥、caller key 或 LLM 密钥。

**不做：** 下单与支付、票务/酒店实时库存权威、与 what2eat 的 SSO、双 Chat / FAB 全局 Chat、一次多行程推荐、MVP 未保存规划 History 列表、多人实时协作、离线地图包、places-agent 管理 UI、餐厅决策（归 what2eat）。

## 目标用户

个人、情侣与家庭的休闲出行规划（一日玩到多日城市游），需要快速得到**一条**可执行行程草案并在页内迭代修改。

## 职责划分

| 层级 | 负责 | 不负责 |
| --- | --- | --- |
| **Web 应用** | 账号、轻量 Profile、Plan 单页、我的行程多卡、页内 Chat UX、**localStorage 草稿 transcript**、旅行风 UI | Map adapter、agent 管理 UI |
| **BFF（同源）** | Session、`providers[]`、deeplink 选择、**初排 L2→OPENAI_CN**、**行程助手→OPENAI_CN 流式**、可选 agent search、**保存时**将行程 + 对话快照写入 DB、PDF 导出 | Vendor 地图密钥；聊天每一回合强制写库 |
| **places-agent** | **L1** `discover_places`、`search_*`、详情、geocode、`navigate`、`sources[]`、配图；以及 MCP/其他调用方的 `arrange_day`（含 Mode H `execution=host`）/`plan_itinerary` | 消费者界面、用户 Profile、**2play 主初排 L2 LLM 与助手**（改由 BFF OPENAI_CN） |

```text
Browser → where2play /api/plan* → BFF：agent discover → OPENAI_CN arrange×N
Browser → where2play /api/chat → BFF OPENAI_CN（流式）；可选 agent search
Browser localStorage ← Plan 会话 chat 草稿（未保存真源）
App DB ← users, interest profile, 已保存行程 + 提交时的 chat 快照
```

- BFF 仅用 **HTTP** 调 agent（不用 MCP）。
- **Caller-driven vendors：** BFF 传 `providers[]`（discover）。
- **主规划路径：** 每次规划 / 重新规划返回 **一条** 行程。
- **Chat 双存储：** 见下方「Chat」；**草稿真源 = localStorage**；**已保存快照真源 = App DB**（仅在用户点「保存」时提交）。

## 国际化

全部用户可见字符串为 **i18n key**。Locale：`EN`、`CN`、`HK`、`TW`。导航展示文案（源语言参考）：行程规划 / 我的行程 / 个人信息。

## 功能域（概要）

| 域 | 内容 |
| --- | --- |
| **Shell** | sticky header：**Plan / Saved / Profile**（`play.nav.plan` · `play.nav.saved` · `play.nav.profile` → 行程规划 / 我的行程 / 个人信息）；问候、locale、登出；places.family footer |
| **Home** | 公开落地页、注册/登录 CTA |
| **Account** | 独立注册、登录、重置/设置密码（无 SSO） |
| **Profile** | 个人信息；轻量出行兴趣；行程参数不进 Profile |
| **Plan** | 单页：规划器 + 单行程详情 + 单一 Chat + 底栏 |
| **Saved（我的行程）** | **仅已保存**行程的多卡列表（交互类似 2eat Decide 卡网格）；点击打开详情（含 **DB 中的对话快照**）。MVP **不做**「未保存规划历史」列表 |

### Plan 单页布局

```text
┌─────────────────────────────────────────┐
│ 上方：行程规划器（边界表单）              │
├─────────────────────────────────────────┤
│ 中部：当前行程详情                       │
│   Day-by-Day · Hour-by-hour             │
│   地点缩略图 + 外链 · 规划/亮点文案       │
├─────────────────────────────────────────┤
│ 下方：单一 Chat（草稿存 localStorage）   │
├─────────────────────────────────────────┤
│ 底栏：重新规划 · 保存 · 导出 PDF         │
└─────────────────────────────────────────┘
```

| 区域 | 行为 |
| --- | --- |
| **规划器** | 提交边界 → 生成**一条**行程 → 刷新中部 |
| **行程详情** | 仅当前这一条；Day-by-Day / Hour-by-hour |
| **Chat** | 唯一入口；随动改当前行程；回合写入 **localStorage** |
| **重新规划** | 确认弹窗文案以 mock / design §3.5.4 为准：标题「重新规划？」；说明「将删除当前未保存的行程，并生成一条新行程。本机对话会保留，并在聊天中加入分隔提示。」确定后丢弃未保存行程、再调 agent 生成**新的一条**；**保留**浏览器本地对话；插入系统分隔提示；replan 请求携带 chat 上下文（有长度上限）。已保存过的行程记录不受影响 |
| **保存** | 将**当时**的行程快照 + **截至当时**的 chat transcript **提交到 App DB**，并出现在「我的行程」。保存后若继续聊天，以 local 为准，需再次保存才更新 DB。MVP-2 可先提交行程且 `messages` 为空；MVP-3 起对话快照为完整路径 |
| **导出 PDF** | 基于当前行程事实与文案；不编造场所数据 |

### Plan 行程边界（MVP）

目的地*、天数*（1–14）、人数、类型、每日起点/终点、开始/结束时间、节奏、交通偏好、偏好 chips（与 Profile 出行兴趣同词表）、预算、其他限制（自由文本）。字段与布局真源：[`2play-design.md`](./2play-design.md) §3.5 与 `ui-mockup/06-plan.html`。  
**不含**独立「含餐」开关（agent `plan_itinerary` timed 内部可排餐）。

### Profile 与 Plan 切分

| 进 Profile | 只在 Plan |
| --- | --- |
| 轻量**出行兴趣（多选）**——固定词表见 [`2play-design.md`](./2play-design.md) §3.8（景点·美食·博物馆·公园·寺庙·夜市·购物·温泉·户外） | 当次行程全部边界字段 |

### Chat（单一 + 双存储）

| 项 | 约定 |
| --- | --- |
| 入口 | 仅 Plan 页下方；无 FAB 全局 Chat |
| 作用域 | 当前行程；中部随动更新 |
| **未保存 / Plan 会话** | transcript **真源 = localStorage**（建议键 `w2p.chat.draft`；已打开已保存行程可用 `w2p.chat.itinerary.{id}`） |
| **保存时** | 把截至当时的 messages + 行程快照写入 **App DB**（提交点） |
| **我的行程 → 开卡** | 从 **DB** 读取对话快照；可 hydrate 到对应 local 键以便继续聊 |
| 登出 | 清除 `w2p.chat.*`；DB 中已保存内容保留 |
| 重新规划后 | **不清空** local chat；插入 i18n 系统分隔行（大意：已重新规划，上方为之前对话，下方起对新行程）；客户端把 transcript（截断）随 replan/chat 请求传给 BFF → agent |
| Rich 格式 | 段落、列表、对当前行程的说明等；不以多行程卡短名单为主交付物 |
| 诚实提示 | 未保存的对话仅本机；清站点数据会丢 |

### 我的行程（Saved）

- 多张**已保存**行程卡（封面图、标题、目的地、天数、保存时间等）。
- 点击卡片 → 行程详情（Day/Hour）+ **DB 对话历史**。
- MVP 不含未保存 History 分区。

### 配图

地点缩略图 / 封面由 **places-agent** 提供；不在 where2play 接无关第三方图库作事实图。

## 数据诚实

- 展示规划更新时间；缺失字段占位，不编造场所事实。
- 区分场所事实、用户偏好、agent 建议文案。
- 重新规划后若对话提及旧 POI，以分隔提示降低错位；不以旧对话冒充新行程事实。

## 非目标

- 浏览器持有 map / caller / LLM 密钥；浏览器调 MCP
- 一次多行程短名单（Plan 主路径）
- 双 Chat / FAB 全局 Chat
- 每轮 chat 自动写库；跨设备同步**未保存**草稿
- MVP「未保存规划历史」列表
- 与 what2eat SSO
- 下单/支付/票务库存权威、多人协作、离线包、agent 管理 UI、替代 what2eat

## 成功标准

注册 → 轻量 Profile → Plan 提交多日边界 → 一条 Day/Hour 行程 → 页内 Chat（local 草稿）随动修改 → 重新规划（确认后换新行程、保留 local chat + 分隔提示）→ 保存（行程+对话入 DB）→ 我的行程多卡打开含 DB 对话 → 导出 PDF；不把产品当作订票权威。
