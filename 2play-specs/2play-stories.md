# where2play — 用户故事

**where2play**（`where2play.place`）产品 backlog 与验收标准（AC）。


| Related               | Location                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 产品规格                  | `[2play-prod-specs.md](./2play-prod-specs.md)`                                                                         |
| 设计规范                  | `[2play-design.md](./2play-design.md)`                                                                                 |
| 行程生成 / Progressive UX | `[itinerary-design.md](./itinerary-design.md)`                                                                         |
| 页面契约（设计 §3）           | `[2play-design.md](./2play-design.md)` §3                                                                              |
| 性能 / L1–L2 交叉         | `[../../1.places-agent/agent-specs/performance.md](../../1.places-agent/agent-specs/performance.md)` §11               |
| 测试计划                  | `[2play-test-plan.md](./2play-test-plan.md)`                                                                           |
| UI mock-up            | `[ui-mockup/](./ui-mockup/)`                                                                                           |
| 家族架构                  | `[../../workspace-specs/2.architecture.md](../../workspace-specs/2.architecture.md)`                                   |
| 行程引擎归属                | `[../../workspace-specs/adr/ADR-008-itinerary-ownership.md](../../workspace-specs/adr/ADR-008-itinerary-ownership.md)` |
| places-agent          | `[../../1.places-agent/agent-specs/](../../1.places-agent/agent-specs/)`                                               |


**状态：** MVP-1（features 1–13）**Done**。MVP-2（features **14–22**, **30** + `plan-07` **AC1**）**Done**。**MVP-3**（**31–33** Mode H 完整排程路径）**Done**（2026-08-23：`make test-e2e-mvp3-live` 绿）。MVP-4 已开工 — **24** `chat-02` **Done**；**23–26** / `plan-07` AC2–3 待办。MVP-5 Replan 未开工。**MVP-3r（34–36 + F42 边界透传 + 交通契约修复 + agent 输出校验）进行中（2026-08-24：34 Done，35 进行中，F42/36 待办）。**

## 人物角色


| 角色    | 谁                    | 价值                     |
| ----- | -------------------- | ---------------------- |
| 休闲出行者 | 已登录用户                | 快速得到**一条**可执行多日行程并在页内改 |
| 新访客   | 公开首页访客               | 了解产品并创建账号              |
| 回访用户  | 有 Profile / 已保存行程的用户 | 用兴趣预填偏好；打开旧行程与对话快照     |




## 术语


| 术语          | 含义                                         | 不是              |
| ----------- | ------------------------------------------ | --------------- |
| **场所事实**    | 名称、地址、时段、配图等，经 places-agent 来自 map vendors | Agent 建议文案或用户偏好 |
| **行程边界**    | Plan 表单字段（目的地、天数、节奏、偏好…）                   | Profile 里的轻量兴趣  |
| **出行兴趣**    | Profile/注册上的多选偏好；可带到规划器预填                  | 当次行程全部边界        |
| **当前行程**    | Plan 页中部展示的唯一一条 Day/Hour 行程                | 多卡短名单           |
| **Chat 草稿** | Plan 会话 transcript；真源 = localStorage       | 每轮自动写库          |
| **已保存快照**   | 用户点「保存」时写入 App DB 的行程 + 当时对话               | 未保存跨设备同步        |
| **重新规划**    | 确认后丢弃未保存行程、生成新一条；保留本机对话并插入分隔               | 删除已保存行程记录       |
| **行程日提示**   | `.plan-phase.is-busy`：整趟「正在安排第 d/N 天…」     | 候选池统计           |
| **行程细节提示**  | `.plan-slot-preview`：当前正在生成的一条（景点/交通/餐）    | 候选池 P/U 作主文案    |
| **行程**      | `.slot` 行：已落地时段                            | 整日同 tick 一次性刷屏  |
| **加载中提示**   | `.slot--pending` 同构 skeleton               | 虚线框占位           |
| **Mode H**   | agent `arrange_day` `execution=host` 返 prompt；2play OPENAI_CN 执行 LLM | agent execution=agent 内跑 LLM |




## MVP 计划

五个主切片。每个 MVP 是**可独立交付的完整功能集**，各自 E2E 签收。**MVP DoD 禁止**用假行程冒充 live 规划结果（MVP-2 起须真实 places-agent / vendor 路径，除非切片明确允许 sandbox）。一次交付一个 user story 至 DoD（`incremental-delivery`）。


| 切片        | 成果                                       | Features                             | E2E 旅程（摘要）                                                                 | 状态                                                                 |
| --------- | ---------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **MVP-1** | Onboarding：shell、home、account、profile   | **1–13**                             | 访客注册 → 保存资料与兴趣 → 登出/登录 → 资料持久；locale EN→CN                              | **Done**（2026-08-21 用户确认 usable；`make quality` 绿）                    |
| **MVP-2** | Plan 渐进 UI + 保存闭环                        | **14–22**, **30**, `plan-07` **AC1** | 兴趣预填 → live progressive（as-built 本地 prompt）→ 保存 → 我的行程 → 详情 → 取消收藏       | **Done**（`make test-e2e-mvp2-live` 绿）                               |
| **MVP-3** | **Plan L2 完整路径（Mode H）**                  | **31–33**                            | discover → `arrange_day` **host** prompt → OPENAI_CN → 真交通 + 地标探针；`make test-e2e-mvp3-live` | **Done**（2026-08-23） |
| **MVP-4** | 页内 Chat 双存储                              | **23–26**, `plan-07` **AC2–3**       | Chat 改行程 → 刷新 local 仍在 → 保存含对话 → 详情只读；登出清 local                         | **In progress**（**24** Done）                                  |
| **MVP-5** | Replan + PDF + Chat 高度                   | **27–29**                            | 重新规划确认 → Mode H progressive 新行程 + 分隔泡；PDF；拖拽调高 chat                      | **To-do**                                                            |
| **MVP-3r** | Plan 边界透传 + 交通契约修复（MVP-3 补漏）   | **34–36**                            | 用户条件全量进 discover/arrange；origin/dest 先 geocode 再 enrich；LLM transit 字段不被 schema 剥掉            | **To-do**（2026-08-23 立项，源自 agent 侧 code review 根因） |


**构建顺序：** MVP-1 ✓ → MVP-2 ✓ → **MVP-3**（W2a → W2b → W2c → **W2d 签收**）→ **MVP-4**（Chat 持久化）→ **MVP-5**（Replan / 导出 / UX）。

**MVP-3 收口问题（自 MVP-2 as-built 继承）：**

1. **时段与交通：** 站间多为估时合成 transit、默认 ~15min，未消费 agent `legs_to_here` / 用户「交通」偏好 → **`plan-13`**（W2b）。
2. **地标缺失：** L2 本地 prompt + discover 截断，热门城必去点未稳定进行程 → **`plan-11`**（W2a Mode H 单一 prompt 真源）+ L1 discover（ADR-038）+ 探针 AC（**W2d** live 签收）。

### MVP-3 交付重估（2026-08-23）

**问题：** 原 W2 将 **31 + 33 + 32 + live E2E + 跨产品 agent HTTP** 捆在同一迭代，违反 `incremental-delivery`；live 栈未绿即把 backlog 标 **Done**，DoD 与诚实性矩阵失真。

**原则：** 一次只交付**一条** user story 至 DoD（含该 story 适用的 live / 用户确认）；**MVP-3 批次 Done** 仅在 **W2d** `make test-e2e-mvp3-live` 绿 + 用户可用性确认后关闭。

| Story | 代码 / `make test` | Live / E2E | Story DoD | 说明 |
| --- | --- | --- | --- | --- |
| **31** `plan-11` | ✓ host 契约 | ✓ AC3 地标 live | **Done** | W2d `test-e2e-mvp3-live` |
| **33** `plan-13` | ✓ enrich + `legs_to_here` | ✓ transit live | **Done** | W2d |
| **32** `plan-12` | ✓ SSE stream parser | ✓ 全链路 live | **Done** | W2d |
| **—** live 签收 | ✓ | ✓ `make test-e2e-mvp3-live` | **Done** | 2026-08-23 |

**Live 签收（2026-08-23）：** `e2e/probe_plan_stream.py` → `done`（~17s）；`make test-e2e-mvp3-live` 绿（London must-see + transit）。根因修复：E2E 显式 `DATABASE_URL` + agent 非 watch `tsx server.ts` + `NODE_ENV=development`。

### 剩余功能开发计划（2026-08-23）

按 **incremental-delivery**：每波内仍一次只交付一个 story 至 DoD。实现真源：`3.where2play/`；测试真源：`[2play-test-plan.md](./2play-test-plan.md)`。


| 波次       | MVP       | 建议 story 顺序（**一次一条至 DoD**） | 交付物                                                                 | 状态                          |
| -------- | --------- | --------------------------- | ------------------------------------------------------------------- | --------------------------- |
| **W1**   | MVP-2     | **25** AC1 → **20–22** → **18** → **30** E2E → **14–19** | `make test-e2e-mvp2-live` 绿；保存闭环                                     | ✓ Done                      |
| **W2a**  | MVP-3     | **31** `plan-11` only       | host prompt 接线；`make test` 契约；**不**混入 enrich/stream              | **Implemented** — 待 AC1–2/4 故事级签收 + W2d AC3 |
| **W2b**  | MVP-3     | **33** `plan-13` only       | `enrich_arrange_transit` + `legs_to_here`；单元/契约绿                    | **Implemented** — 待 W2d live |
| **W2c**  | MVP-3     | **32** `plan-12` only       | OPENAI_CN stream + 首 `slot_preview`；单元绿                             | **Implemented** — 待 W2d live |
| **W2d**  | MVP-3 签收 | **ops** live harness → **31 AC3** | `make test-e2e-mvp3-live`；用户确认 MVP-3 usable     | ✓ Done（2026-08-23） |
| **W3**   | MVP-4     | **24** → **23** → **25** AC2–3 → **26** | Chat 流式 + patch；保存 `messages[]`；详情只读对话                               | **24** Done；余 To-do                       |
| **W2r**  | MVP-3r    | **34** `plan-14` ✅ → **35** `plan-15` → **36** `plan-16` → **F42** agent 校验 | 边界透传 → origin geocode → F42 agent 校验 → schema 保留 transit + 2play 侧时序/去重（一次一条至 DoD）       | In progress（plan-15 进行中）                      |
| **W4**   | MVP-5     | **27** → **28** → **29**    | Replan（同 MVP-3 管线）+ PDF + chat resize                                 | To-do                       |


**W2 说明（MVP-3，重排后）：**

- **W2a `plan-11`：** BFF `execution=host`；删除生产默认本地 duplicate prompt；AC1–2、AC4 用契约测签收；**AC3 地标仅 W2d live**。
- **W2b `plan-13`：** 消费 `legs_to_here` / `transit_outcome`；消除一律 ~15min；**不在此 story 改 stream**。
- **W2c `plan-12`：** OPENAI_CN `stream: true` + 增量 parse；首 `slot_preview`；可 `PLAN_ARRANGE_STREAM=0` 降级调试。
- **W2d 签收：** 双服 + caller key + map/OPENAI 密钥；`make test-e2e-mvp3-live`（London must-see + transit 模式）；retrospective；**用户确认 MVP-3 usable** → MVP-3 批次标 Done。

**禁止：** 在 W2a–c 未分别过 story DoD 时把 MVP-3 标 Done；用 `make test` fixture 绿代替 live 探针。

**W3 说明（MVP-4）：** **24** 本地草稿补 DoD；**23** `itineraryPatch`；**25** AC2–3；**26** 详情只读 chat。

**W2r 说明（MVP-3r 补漏，2026-08-23 立项）：** 源自 agent 侧 code review 根因（用户输入条件被丢、首末交通静默消失、schema 剥 transit 字段）。**34** `plan-14` `buildDiscoverPlacesBody`/`buildArrangeDayBody` 透传全部 `PlanBoundaries`；**35** `plan-15` origin/destination 先调 agent `geocode` 解析坐标再传 `enrich_arrange_transit`（agent 契约不动）；**36** `plan-16` `daySchema`/`blockSchema` 保留 `from_origin`/`to_destination`/`legs_to_here`，enrich 失败显式 `transit_outcome` 不静默吞。每条单独过 story DoD（含 live 抽查）。

**W4 说明（MVP-5）：** **27** replan 复用 MVP-3 L1+L2（Mode H + OPENAI_CN）；**28** PDF；**29** resize。

**MVP-1 说明：** 无 places-agent 硬依赖。真实 App DB + session。邮件用 Resend sandbox / dev outbox。

---



# 第一部分 — 产品 backlog

**列说明：** **编号** = backlog 序号（1–33，稳定 id）；表内按 **MVP-1→MVP-5** 批次排列，同批内按编号。**Feature code** = `plan-NN` 等；**MVP** 写全称（如 **MVP-2**）；`plan-07` 为 **MVP-2** / **MVP-3**（AC1 / AC2–3）。**itinerary 优化相关** 与 `[itinerary-design.md](./itinerary-design.md)` / ADR-036·037 / agent `[performance.md](../../1.places-agent/agent-specs/performance.md)` **第十一节**（勿与下文 Story **§11** `account-04` 混淆）：`P0` / `P1` / `P2` = 分期；`P0·核心` / `P0·间接` = Progressive 直接/复用；`Q4` = 真交通；`—` = 无变更。


| 编号  | 模块      | Feature code | 功能名                      | 功能描述                                                                 | Story                                                 | MVP                              | 状态                      | itinerary 优化相关                  |
| --- | ------- | ------------ | ------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------- | ----------------------- | ------------------------------- |
| 1 | Header | `header-01` | App header & navigation | Sticky header：logo、行程规划 / 我的行程 / 个人信息、active、移动 Menu | [§1](#1-header-header-01--app-header--navigation) | **MVP-1** | **Done** | — |
| 2 | Header | `header-02` | 已登录用户 chrome | 问候、avatar、登出 | [§2](#2-header-header-02--signed-in-user-chrome) | **MVP-1** | **Done** | — |
| 3 | Header | `header-03` | Locale switcher (app) | EN / CN / HK / TW | [§3](#3-header-header-03--locale-switcher-app) | **MVP-1** | **Done** | — |
| 4 | Footer | `footer-01` | Family footer (app) | places.family 行（App 底纹） | [§4](#4-footer-footer-01--family-footer-app) | **MVP-1** | **Done** | — |
| 5 | Footer | `footer-02` | Family footer (public) | places.family 行（公开页） | [§5](#5-footer-footer-02--family-footer-public) | **MVP-1** | **Done** | — |
| 6 | i18n | `i18n-01` | Four-locale catalogs | 全部用户可见字符串为 key；四 locale（含 plan progressive preview_*） | [§6](#6-i18n-i18n-01--four-locale-catalogs) | **MVP-1** | **Done** | P0（preview keys） |
| 7 | Home | `home-01` | Public landing | Headline、lead、注册/登录 CTA | [§7](#7-home-home-01--public-landing) | **MVP-1** | **Done** | — |
| 8 | Account | `account-01` | Register | 创建账号：必填姓名/邮箱/密码；选填性别年龄出发地兴趣 | [§8](#8-account-account-01--register) | **MVP-1** | **Done** | — |
| 9 | Account | `account-02` | Sign in | 邮箱密码登录；失败提示 | [§9](#9-account-account-02--sign-in) | **MVP-1** | **Done** | — |
| 10 | Account | `account-03` | Reset password | 请求重置邮件 | [§10](#10-account-account-03--reset-password) | **MVP-1** | **Done** | — |
| 11 | Account | `account-04` | Set password | 从链接设新密码；过期态 | [§11](#11-account-account-04--set-password) | **MVP-1** | **Done** | — |
| 12 | Profile | `profile-01` | User profile | 单卡：资料 + 出行兴趣（多选）；独立保存 | [§12](#12-profile-profile-01--user-profile) | **MVP-1** | **Done** | — |
| 13 | Profile | `profile-02` | Required-field markers | 个人信息必填项标 `*` 与说明 | [§13](#13-profile-profile-02--required-field-markers) | **MVP-1** | **Done** | — |
| 14 | Plan | `plan-01` | Planner form | 三列边界表单；生成一条行程（L1 discover + BFF OPENAI_CN L2） | [§14](#14-plan-plan-01--planner-form) | **MVP-2** | **Done** | P0·核心 |
| 15 | Plan | `plan-02` | Planner validation | 目的地/天数/起始日期必填；天数范围；时间成对校验 | [§15](#15-plan-plan-02--planner-validation) | **MVP-2** | **Done** | — |
| 16 | Plan | `plan-03` | Itinerary day/hour view | Day tabs、Highlights、时段行、交通段、配图与外链；生成中 liveSlots | [§16](#16-plan-plan-03--itinerary-dayhour-view) | **MVP-2** | **Done** | P0 |
| 17 | Plan | `plan-04` | Single itinerary only | 每次规划/重新规划只交付一条；无多卡短名单 | [§17](#17-plan-plan-04--single-itinerary-only) | **MVP-2** | **Done** | — |
| 18 | Plan | `plan-05` | Prefill from interests | Profile 出行兴趣可预填 Plan 偏好 chips | [§18](#18-plan-plan-05--prefill-from-interests) | **MVP-2** | **Done** | — |
| 19 | Plan | `plan-06` | Combo full options | 自定义 combo 展开始终列出全部选项 | [§19](#19-plan-plan-06--combo-full-options) | **MVP-2** | **Done** | — |
| 30 | Plan | `plan-10` | Progressive generate UX | 四段 UI：日提示 / `slot_preview` 细节提示 / 逐条 slot / pending skeleton（§11-P0） | [§30](#30-plan-plan-10--progressive-generate-ux) | **MVP-2** | **Done** | **P0** |
| 20 | Saved | `saved-01` | Saved trips grid | 仅已保存多卡；空态 | [§20](#20-saved-saved-01--saved-trips-grid) | **MVP-2** | **Done** | — |
| 21 | Saved | `saved-02` | Open saved trip | 详情 Day/Hour；无未保存 History | [§21](#21-saved-saved-02--open-saved-trip) | **MVP-2** | **Done** | — |
| 22 | Saved | `saved-03` | Unsave trip | 从详情取消收藏 | [§22](#22-saved-saved-03--unsave-trip) | **MVP-2** | **Done** | — |
| 25 | Plan | `plan-07` | Save itinerary + chat | AC1：保存行程（`messages` 可 `[]`）；AC2–3：保存含对话快照 | [§25](#25-plan-plan-07--save-itinerary--chat) | **MVP-2** · **MVP-4** | **Done**（MVP-2 AC1）/ **To-do**（MVP-4 AC2–3） | — |
| 31 | Plan | `plan-11` | Mode H prompt source | BFF 从 agent `execution=host` 拉 prompt；OPENAI_CN 执行；UI 契约不变 | [§31](#31-plan-plan-11--mode-h-prompt-source) | **MVP-3** | **Done** | **P1** |
| 33 | Plan | `plan-13` | Real transit in timeline | 消费真 navigate/directions（非估时合成 transit） | [§33](#33-plan-plan-13--real-transit-in-timeline) | **MVP-3** | **Done** | **Q4** |
| 32 | Plan | `plan-12` | Arrange OPENAI_CN stream | L2 `stream: true` + 增量 parse；首 `slot_preview` 早于整日 JSON | [§32](#32-plan-plan-12--arrange-OPENAI_CN-stream) | **MVP-3** | **Done** | **P2** |
| 23 | Chat | `chat-01` | In-page plan chat | Plan 下方唯一 Chat；BFF 本应用 OPENAI_CN 流式改当前行程（ADR-036） | [§23](#23-chat-chat-01--in-page-plan-chat) | **MVP-4** | **In progress** | — |
| 24 | Chat | `chat-02` | Local draft transcript | 回合写入 localStorage；刷新保留；登出清除 | [§24](#24-chat-chat-02--local-draft-transcript) | **MVP-4** | **Done** | — |
| 26 | Saved | `saved-04` | DB chat snapshot | 打开已保存行程可读 DB 对话；只读提示 | [§26](#26-saved-saved-04--db-chat-snapshot) | **MVP-4** | To-do | — |
| 27 | Plan | `plan-08` | Replan with confirm | 确认后换新行程（同 MVP-3 Mode H 管线）；保留 local chat + 分隔提示 | [§27](#27-plan-plan-08--replan-with-confirm) | **MVP-5** | To-do | P0·间接 |
| 28 | Plan | `plan-09` | Export PDF | 基于当前行程事实导出；不编造场所 | [§28](#28-plan-plan-09--export-pdf) | **MVP-5** | To-do | — |
| 29 | Chat | `chat-03` | Chat height resize | SE 把手仅调整高度；尊重最小高度 | [§29](#29-chat-chat-03--chat-height-resize) | **MVP-5** | To-do | — |
| 34 | Plan | `plan-14` | Boundary passthrough | BFF body 组装透传全部 `PlanBoundaries`（pace/budget/tripType/interests/must_include/timeFrom/To）到 discover + arrange | [§34](#34-plan-plan-14--boundary-passthrough) | **MVP-3r** | Done | — |
| 35 | Plan | `plan-15` | Origin geocode before enrich | 先调 agent `geocode` 解析每日 origin/destination 为坐标，再传 `enrich_arrange_transit`；首末段交通不静默消失 | [§35](#35-plan-plan-15--origin-geocode-before-enrich) | **MVP-3r** | To-do | Q4 |
| 36 | Plan | `plan-16` | Keep LLM transit fields | `daySchema`/`blockSchema` 保留 `from_origin`/`to_destination`/`legs_to_here`；enrich 失败显式 `transit_outcome` 展示降级原因，不静默吞 | [§36](#36-plan-plan-16--keep-llm-transit-fields) | **MVP-3r** | To-do | Q4 |


Backlog 为 **features 1–33**。明确不在范围：SSO、双 Chat/FAB、一次多行程短名单、未保存 History、下单支付、浏览器持有 map/caller/LLM 密钥；**arrange 阶段候选池统计作主文案**（`play.plan.arrange_pool_summary` 默认隐藏，见 **30**）；搜索专名自动机翻（agent performance Q5）。

**本表变更摘要（2026-08-23）：**


| 类型         | 项                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| **表序**     | backlog 按 **MVP-1 → MVP-5** 批次重排；同批 features 相邻；`MVP` 列统一 **MVP-N**（不用裸数字） |
| **MVP 重排** | **MVP-3** Done（**31–33**）；**MVP-4** 进行中（**24** Done） |
| **Mode H** | discover → `arrange_day` **execution=host**（prompt）→ 2play OPENAI_CN（LLM）；与 agent / MCP 同源 |
| **Live 签收** | 2026-08-23：`probe_plan_stream` + `make test-e2e-mvp3-live` 绿 |
| **状态**     | MVP-2 Done；**MVP-3 Done**；**24** Done；**plan-07** AC2–3 → MVP-4 余 story |


---



# 第二部分 — Story mapping



## 1. Header · `header-01` — App header & navigation

**用户故事 — 在主导航间切换**

作为已登录用户，我希望在「行程规划 / 我的行程 / 个人信息」之间导航，以便在不丢上下文的情况下使用各功能。

- **AC1:** 给定我已登录，当我打开任一 App 页，则顶栏导航按顺序显示：行程规划、我的行程、个人信息。
- **AC2:** 给定我在行程规划页，当页面加载，则「行程规划」为当前项。
- **AC3:** 给定我在我的行程详情页，当页面加载，则「我的行程」为当前项。
- **AC4:** 给定窄视口，当我打开移动 Menu，则仍可到达相同三项且顺序不变。

---



## 2. Header · `header-02` — Signed-in user chrome

**用户故事 — 看到当前账号**

作为已登录用户，我希望看到问候与头像，并能够登出，以便确认账号并结束会话。

- **AC1:** 给定我已登录且显示名为 Mei，当我查看 App 页，则问候区包含我的显示名。
- **AC2:** 给定我已上传头像，当我查看 App 页，则 avatar 显示圆形缩略图。
- **AC3:** 给定我已登录，当我选择登出，则会话结束并回到公开首页，且本机 `w2p.chat.`* 被清除。

---



## 3. Header · `header-03` — Locale switcher (app)

**用户故事 — 切换语言**

作为用户，我希望在 App 顶栏切换 EN/CN/HK/TW，以便界面匹配我的语言偏好。

- **AC1:** 给定我在 App 页，当我选择 CN，则用户可见文案使用简体目录（有 key 处）。
- **AC2:** 给定某 key 在所选 locale 缺失，当页面渲染，则回退且不导致页面崩溃。

---



## 4. Footer · `footer-01` — Family footer (app)

**用户故事 — App 页家族链接**

作为已登录用户，我希望在 App 页底部看到 places.family，以便打开姊妹产品。

- **AC1:** 给定我在 Plan / Saved / Profile，当页面加载，则 footer 显示 places.family 行且 where2play 为当前（非链接）。
- **AC2:** 给定我点击 what2eat 或 places.agent，当链接打开，则在新标签页打开。

---



## 5. Footer · `footer-02` — Family footer (public)

**用户故事 — 公开页家族链接**

作为访客，我希望在公开页看到 places.family，以便识别产品家族。

- **AC1:** 给定我在首页或 Auth 页，当页面加载，则存在 places.family footer（公开样式）。

---



## 6. i18n · `i18n-01` — Four-locale catalogs

**用户故事 — 文案可国际化**

作为用户，我希望所有界面文案来自 locale catalog，以便四语言一致可切换。

- **AC1:** 给定产品 UI，当检查用户可见字符串，则均通过 i18n key 解析（非硬编码唯一语言契约）。
- **AC2:** 给定 locale EN/CN/HK/TW，当切换，则导航与主要 CTA 有对应条目。
- **AC3 (plan-10):** 给定 Progressive arrange，当渲染细节提示，则 `play.plan.arrange_planning_day`、`play.plan.preview_place`、`play.plan.preview_transit`、`play.plan.preview_meal` 及 `play.plan.meal_lunch` / `play.plan.meal_afternoon_tea` / `play.plan.meal_dinner` 在四 locale 均有条目。

---



## 7. Home · `home-01` — Public landing

**用户故事 — 从首页开始**

作为访客，我希望看到产品主张并进入注册或登录，以便开始规划。

- **AC1:** 给定我打开 `/`，当页面加载，则看到品牌 logo、主标题与注册/登录入口。
- **AC2:** 给定我选择开始探索，当进入，则到达注册页。
- **AC3:** 给定我选择登录，当进入，则到达登录页。

---



## 8. Account · `account-01` — Register

**用户故事 — 创建账号**

作为访客，我希望用邮箱创建账号并可选填写兴趣，以便保存偏好并进入规划。

- **AC1:** 给定我填写必填项（姓名、邮箱、密码、确认密码），当我提交注册，则账号创建成功并可进入行程规划。
- **AC2:** 给定我留下必填项为空，当我提交，则注册不完成且标明需补字段。
- **AC3:** 给定性别、年龄、常用出发地、出行兴趣，当我注册，则这些为选填；性别**不是**必填。
- **AC4:** 给定注册页，当我查看，则有「标 * 为必填」说明，且出行兴趣标签为「出行兴趣（多选）」。
- **AC5:** 给定邮箱已被占用，当我提交，则看到邮箱字段错误且不创建重复账号。
- **AC6:** 给定密码与确认不一致，当我提交，则注册失败并提示不匹配。

---



## 9. Account · `account-02` — Sign in

**用户故事 — 登录**

作为已注册用户，我希望用邮箱密码登录，以便回到我的行程与资料。

- **AC1:** 给定有效凭证，当我登录，则进入行程规划（或会话默认 App 页）。
- **AC2:** 给定错误密码，当我登录，则看到失败提示且不建立会话。

---



## 10. Account · `account-03` — Reset password

**用户故事 — 请求重置**

作为用户，我希望通过邮箱收到重置链接，以便在忘记密码时恢复。

- **AC1:** 给定我提交已注册邮箱，当请求发送，则看到已发送说明（不泄露是否存在账号的细节以实现为准，但须有明确下一步）。

---



## 11. Account · `account-04` — Set password

**用户故事 — 设置新密码**

作为持有有效链接的用户，我希望设置新密码，以便重新登录。

- **AC1:** 给定有效重置/邀请链接，当我设置并确认新密码，则可以新密码登录。
- **AC2:** 给定过期或无效链接，当我打开设密页，则看到过期/无效状态且不能静默成功。

---



## 12. Profile · `profile-01` — User profile

**用户故事 — 维护用户资料与出行兴趣**

作为已登录用户，我希望在单页「用户资料」中编辑个人信息与出行兴趣（多选），以便规划器可使用轻量偏好。

- **AC1:** 给定我在个人信息页，当页面加载，则只有一张用户资料卡（兴趣在同一卡内，无独立兴趣卡）。
- **AC2:** 给定我修改姓名/兴趣并保存，当保存成功，则显示上次保存时间更新且刷新后仍在。
- **AC3:** 给定出行兴趣，当我多选 chips，则可选景点/美食/博物馆/公园/寺庙/夜市/购物/温泉/户外。
- **AC4:** 给定页面文案，当渲染，则不出现「轻量出行兴趣会带到规划器…」与「点选常去的玩法（可多选）。」
- **AC5:** 给定常用出发地旁，当我选择重置密码，则进入重置流程。

---



## 13. Profile · `profile-02` — Required-field markers

**用户故事 — 看清必填项**

作为用户，我希望必填字段有明确标记，以便正确保存资料。

- **AC1:** 给定个人信息表单，当页面加载，则姓名、邮箱、常用出发地标为必填（`*`），并有「带 * 为必填」类说明。
- **AC2:** 给定性别与年龄，当页面加载，则不标为必填。

---



## 14. Plan · `plan-01` — Planner form

**用户故事 — 填写边界并生成行程**

作为已登录用户，我希望填写行程边界并生成一条行程，以便看到 Day-by-Day / Hour-by-hour 草案。

- **AC1:** 给定我在行程规划页，当页面加载，则规划器为双行栅格：第一行九控件顺序为目的地 → 起始日期 → 天数 → 人数 → 每日起点 → 每日终点 → 开始 → 到 → 结束（起始日期与「节奏」同列宽/x；天数左缘与「偏好与限制」对齐）；第二行为类型/预算 | 节奏/交通 | 偏好与限制；且无「规划器」大段分区标题。
- **AC2:** 给定有效边界（至少目的地、天数、起始日期），当我选择生成行程，则中部展示**一条**行程详情（含更新日期）。
- **AC3:** 给定偏好与限制，当我操作，则可见偏好 chips 与「其他限制」自由文本（无「（可选）」后缀文案）。
- **AC4:** 给定生成进行中，当收到 `candidate_place`，则 `.plan-phase`（`.is-busy`）反映搜索态（可含已找到数量），并以同态 `.slot--candidate` 逐条展示（非 chip 条）；提交钮带 `.is-generating` 等待动效。
- **AC5:** 给定进入 arrange，When BFF 流式 NDJSON，Then 编排级行为满足 `plan-10` **AC1–AC8**（四段 UI、`slot_preview`→`slot`、禁止候选池主文案）；跨日剔除已用名称。
- **AC6:** 给定规划器，当我查看第一行，则第二项为必填「起始日期」日历控件（`type=date`，`plan-start-date`）；提交时 `startDate` 写入 PlanBoundaries，并映射为 places-agent discover 的 `bounds.start`（`bounds.end` / 各日 `date` 由起始日期 + 天数推导）。
- **AC7:** 给定中部已有行程详情，当我再次选择生成行程，则中部旧行程立即清空，再按 progressive 展示新结果（不与旧 Day/Hour 叠显）。
- **AC8 (ADR-037 / Mode H):** 给定生成请求，When BFF 处理 L2，Then **本应用 OPENAI_CN** 按天排程；**不**调用 agent `arrange_day` **execution=agent** / `plan_itinerary`。每日先 `POST /v1/arrange_day` `execution=host` 取 prompt，再 OPENAI_CN 执行（**MVP-3 Done**）。L1 仍 `discover_places`。
- **AC9:** 给定缺 `OPENAI_API_KEY`，When 生成，Then 返回明确 outcome / i18n key（非静默失败）。

---



## 15. Plan · `plan-02` — Planner validation

**用户故事 — 提交前得到清晰校验**

作为用户，我希望必填与非法输入被拦住并标出字段，以便改正后生成。

- **AC1:** 给定目的地为空，当我生成，则目的地显示错误且不调用成功规划。
- **AC2:** 给定天数为空或不在 1–14，当我生成，则天数显示错误。
- **AC3:** 给定起始日期为空或非法，当我生成，则起始日期显示错误。
- **AC4:** 给定开始与结束时间都填写且结束不晚于开始，当我生成，则时间字段显示错误。

---



## 16. Plan · `plan-03` — Itinerary day/hour view

**用户故事 — 按日与时段阅读行程**

作为用户，我希望按 Day 查看 Highlights 与 Hour 行（含交通段、缩略图、详情/地图外链），以便执行当天安排。

- **AC1:** 给定一条多日行程，当我切换 Day tab，则只显示对应日内容。
- **AC2:** 给定场所时段，当渲染，则显示时段区间、场所名、说明，并提供详情与地图外链（新标签）。
- **AC3:** 给定交通段，当渲染，则使用交通样式且无场所缩略图要求。
- **AC4:** 给定场所缩略图，当布局，则时间列宽与规划器「天数」列同宽约定（`--plan-col`），缩略图左缘对齐该列输入。
- **AC5:** 给定生成进行中，When progressive 揭示，Then 当日列表行为满足 `plan-10` **AC4–AC5**（逐条 `slot`、同构 `.slot--pending`）。

---



## 17. Plan · `plan-04` — Single itinerary only

**用户故事 — 一次只拿一条行程**

作为用户，我希望每次规划只得到一条行程，以便更快出结果、减少选择负担。

- **AC1:** 给定我成功生成，当结果区渲染，则不出现多条行程候选卡网格作为主交付。
- **AC2:** 给定我再次生成或重新规划成功，当完成，则中部替换为新的一条当前行程。

---



## 18. Plan · `plan-05` — Prefill from interests

**用户故事 — 兴趣带到规划器**

作为已保存出行兴趣的用户，我希望打开规划器时偏好 chips 反映我的兴趣，以便少点几次。

- **AC1:** 给定 Profile 中已选「景点、美食」，当我进入行程规划，则对应偏好 chips 为选中（可再改）。
- **AC2:** 给定我在 Plan 改 chips，当我未再保存 Profile，则不强制写回 Profile（Plan 当次边界独立）。

---



## 19. Plan · `plan-06` — Combo full options

**用户故事 — 下拉看到全部预设**

作为用户，我希望打开类型/预算/节奏/交通 combo 时看到全部预设，以便改选项而不是被当前值过滤成一项。

- **AC1:** 给定类型已填「城市漫游」，当我打开类型列表，则仍列出全部预设选项。

---



## 20. Saved · `saved-01` — Saved trips grid

**用户故事 — 浏览已保存行程**

作为用户，我希望在「我的行程」看到已保存行程卡片，以便回访。

- **AC1:** 给定我有已保存行程，当我打开我的行程，则看到多卡（标题、天数、保存时间等）。
- **AC2:** 给定我没有任何已保存行程，当我打开我的行程，则看到空态并引导去行程规划。
- **AC3:** 给定页面，当渲染，则不出现「未保存规划历史」分区。

---



## 21. Saved · `saved-02` — Open saved trip

**用户故事 — 打开已保存详情**

作为用户，我希望点击卡片查看该次保存的 Day/Hour 详情，以便回顾行程。

- **AC1:** 给定一张已保存卡，当我打开，则看到行程详情与返回「我的行程」。
- **AC2:** 给定详情页，当加载，则顶栏「我的行程」为当前项。

---



## 22. Saved · `saved-03` — Unsave trip

**用户故事 — 取消收藏**

作为用户，我希望取消收藏某行程，以便清理列表。

- **AC1:** 给定已保存详情，当我确认取消收藏，则该行程不再出现在我的行程列表。

---



## 23. Chat · `chat-01` — In-page plan chat

**用户故事 — 用页内助手改行程**

作为用户，我希望在行程规划页下方与助手对话来修改当前行程，以便不必重填整表。

- **AC1:** 给定已有当前行程，当我发送有效修改请求且 BFF 助手成功，则助手区出现回复（流式或完成后文案），且中部行程随 `itineraryPatch`（优先）或完整 `itinerary` 更新。
- **AC2:** 给定 App，当我寻找 Chat，则仅在 Plan 页内嵌入口存在（无全局 FAB 第二入口）。
- **AC3:** 给定 `POST /api/chat`，When 处理，Then BFF 直连本应用 OPENAI_CN（流式），**不**调用 places-agent `POST /v1/chat`；且助手路径**不**默认触发整单 `plan_itinerary`。
- **AC4:** 给定缺 `OPENAI_API_KEY`（或等价），When 发送，Then 返回明确 outcome / i18n key（非静默失败）；浏览器不持有 LLM key。
- **AC5:** Patch 契约：优先应用 `itineraryPatch`；若无 patch 但有完整 `itinerary`，则替换当前行程；二者皆无则仅更新对话气泡。

---



## 24. Chat · `chat-02` — Local draft transcript

**用户故事 — 对话先留在本机**

作为用户，我希望未保存前对话留在本机，以便刷新不丢；并理解清站点数据会丢。

- **AC1:** 给定我在 Plan 发送了消息，当我刷新页面，则 transcript 仍在（同一浏览器配置）。
- **AC2:** 给定我登出，当再登录，则未保存草稿不从服务器恢复（local 已清）。
- **AC3:** 给定诚实提示需求，当产品说明未保存对话，则表明仅本机、清站点数据会丢。

---



## 25. Plan · `plan-07` — Save itinerary + chat

**用户故事 — 保存行程与当时对话**

作为用户，我希望一键保存当前行程（及截至当时的对话），以便在我的行程回看。

- **AC1 (MVP-2):** 给定当前行程，当我保存成功，则我的行程出现对应卡；请求体含行程快照，`messages` 允许为空数组。
- **AC2 (MVP-4):** 给定当前行程与若干 chat 消息，当我保存成功，则 DB 含截至当时的对话快照。
- **AC3 (MVP-4):** 给定保存后我又继续聊天，当我未再次保存，则 DB 快照仍为上次保存点；local 为更新真源。

---



## 26. Saved · `saved-04` — DB chat snapshot

**用户故事 — 回看保存时的对话**

作为用户，我希望在已保存详情中阅读保存当时的对话，以便回忆为何如此安排。

- **AC1:** 给定保存时含对话，当我打开该行程详情，则展示只读对话且注明来自数据库快照。
- **AC2:** 给定只读对话区，当展示，则说明续聊需回到规划并再次保存。

---



## 27. Plan · `plan-08` — Replan with confirm

**用户故事 — 确认后重新规划**

作为用户，我希望在丢弃未保存行程前得到确认，并在重新规划后保留本机对话与分隔提示，以便不丢聊过的约束语境。

- **AC1:** 给定我选择重新规划，当对话框出现，则说明将删除当前未保存行程并生成新行程，且本机对话会保留并加分隔。
- **AC2:** 给定我取消，当关闭对话框，则当前行程与对话不变。
- **AC3:** 给定我确认，当重新规划成功，则中部为新行程；local chat 保留并出现系统分隔；已保存库中旧记录不受影响。
- **AC4:** 给定 replan 请求，当发送，则携带截断后的 chat 上下文；L2 走 **MVP-3** 管线（Mode H host prompt + OPENAI_CN），不默认 agent `arrange_day` execution=agent。
- **AC5 (plan-10):** 给定我确认重新规划，When BFF 流式返回，Then 中部清空后满足 `plan-10` **AC1–AC5**（同 progressive 事件契约）。

---



## 28. Plan · `plan-09` — Export PDF

**用户故事 — 导出行程 PDF**

作为用户，我希望导出当前行程 PDF，以便离线分享或打印。

- **AC1:** 给定当前有行程，当我导出 PDF，则文件内容基于当前行程事实与文案。
- **AC2:** 给定某场所字段缺失，当导出，则使用占位/省略，不编造场所事实。

---



## 29. Chat · `chat-03` — Chat height resize

**用户故事 — 调高聊天区**

作为用户，我希望拖动把手只调整聊天高度，以便多看对话而不挡行程。

- **AC1:** 给定 Plan Chat，当我拖动高度把手，则面板高度变化且不低于最小高度。
- **AC2:** 给定 `prefers-reduced-motion: reduce`，当使用页面，则飞行动画关闭；resize 仍可用。

---



## 30. Plan · `plan-10` — Progressive generate UX

**用户故事 — 逐步看到正在生成什么**

作为用户，我希望生成行程时按条揭示（景点/交通/餐）并看到下一条加载中，以便等待时知道进度。

**规格真源：** `[itinerary-design.md](./itinerary-design.md)` · `[performance.md](../../1.places-agent/agent-specs/performance.md)` 第十一节 §11-P0 · 完工：**Done（单测/契约）/ E2E 待签**（切日 tab 见 AC8 **部分**）

- **AC1:** 给定生成进入 arrange，当页面展示，则**行程日提示**仍为「正在安排第 d/N 天…」（`.plan-phase.is-busy`）。
- **AC2:** 给定尚无 `slot_preview`，当 LLM 等待，则**行程细节提示**为 `play.plan.arrange_planning_day`（**不**以 `play.plan.arrange_pool_summary` 作主文案）。
- **AC3:** 给定 `slot_preview.kind=place|transit|meal`，当渲染，则分别使用 `play.plan.preview_place` / `play.plan.preview_transit` / `play.plan.preview_meal`（及 `play.plan.meal_`* 餐段）插值 name/reason/window。
- **AC4:** 给定一日多站，当 BFF staged emit，则**行程**列表一次只多一条 `.slot`（`place` 为兼容 alias）；下条前**加载中提示**为 `plan-slot-pending` 同构 skeleton（非虚线框）。
- **AC5:** 给定 BFF 发 `slot_preview` 后立即发 `slot`，When UI 同帧收到多条，Then reveal 队列仍逐条展示（不整日同 tick 刷屏）。
- **AC6:** 给定 `prefers-reduced-motion: reduce`，当生成，则无 pending shimmer；BFF stage 间隔可由 `PLAN_SLOT_STAGE_MS` 配置为 0。
- **AC7:** 给定 progressive `slot` 与 `day_done`，When 比对 `itinerary.days[].slots`，Then 二者来自同一 `expandArrangeDayToSlots`（含首尾/站间 transit），避免最终跳变。
- **AC8:** 给定单日事件序，When BFF emit，Then 为 `arrange_day_start` → `day_highlights` → (`slot_preview` → `slot`) → `day_done`；`discover_done` **不**驱动 arrange 主文案；`day_done` 后自动聚焦下一 Day tab（未排日 `play.plan.day_n_queued`）。

---



## 31. Plan · `plan-11` — Mode H prompt source

**用户故事 — 排程 prompt 与 agent 同源**

作为产品，我希望 BFF 从 places-agent `execution=host` 拉取排程 prompt，再用本应用 OPENAI_CN 完成排程，以便与 MCP / HTTP 共用一套拼装，并稳定纳入地标与交通约束。

**规格：** `[itinerary-design.md](./itinerary-design.md)` §5.1 / §9 · agent Feature **35**（**Done**）· **MVP-3**

- **AC1:** 给定生成 L2，When 每日排程，Then BFF `POST /v1/arrange_day` `execution=host`，使用返回的 `system_prompt` / `user_prompt` / `output_contract` / `candidates_slim`；**不**再默认本地 duplicate prompt；**不**调 agent 侧 LLM（execution=agent）。
- **AC2:** 给定切换 prompt 来源，When UI 收事件，Then 仍为 `slot_preview` → `slot` → `day_done` 契约（不变）。
- **AC3（地标）:** 给定 test-plan §8 探针目的地（如 London / 西安 seed 城），When 完整生成成功，Then 行程 slots 至少包含一处该城 canonical must-see（与 ADR-038 discover 种子一致；不得仅靠 LLM 幻觉）。
- **AC4（交通偏好）:** 给定用户在 Plan 表单选择「交通」偏好（如捷运/步行），When 调用 host arrange，Then 请求体携带对应约束字段（与 agent `buildSchedulePrompt` 契约一致）。

---



## 32. Plan · `plan-12` — Arrange OPENAI_CN stream

**用户故事 — 首站更早出现**

作为用户，我希望不必等整日 JSON 完成才看到第一条站点预告。

**规格：** `[itinerary-design.md](./itinerary-design.md)` §5.2 / §10 · `[performance.md](../../1.places-agent/agent-specs/performance.md)` §11-P2 · **W2c**

- **AC1:** 给定 arrange OPENAI_CN `stream: true`，When 解析出首个 block，Then 在整日 JSON 完成前即可发出首个 `slot_preview`。
- **AC2:** 给定流式失败/超时时，When 处理，Then 映射 `errors.arrange_timeout` 或等价 i18n，且不留下半截不可用日为「成功」。

---



## 33. Plan · `plan-13` — Real transit in timeline

**用户故事 — 交通段用真实耗时与方式**

作为用户，我希望站间交通显示真实 directions/navigate 耗时与方式，并反映我在规划器选择的交通偏好，而不仅是统一估时文案。

**规格：** agent `[performance.md](../../1.places-agent/agent-specs/performance.md)` §0.1 Q4 · Feature **37**（**Done**：`legs_to_here` / `transit_outcome`）· **MVP-3**

- **AC1:** 给定相邻两站有坐标且 agent 已 enrichment，When 行程含 transit 行，Then 时长/方式来自 navigate 或 directions 结果（密钥不进浏览器）。
- **AC2:** 给定 directions 失败，When 降级，Then 仍可展示行程其余站，并有明确失败/估时回退提示（i18n key）。
- **AC3:** 给定 LLM block 含 `duration_min` 与 agent `legs_to_here`，When `expandArrangeDayToSlots` 映射，Then 场所时段使用该时长（**禁止**一律默认 ~15min 占位）；transit 行展示具体方式（如步行/地铁/打车），非泛化「前往下一站」。

---



# 附录 — 与 mock / 产品规格对照


| 主题                   | 真源                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 视觉与 DOM              | `[ui-mockup/](./ui-mockup/)` + `[2play-design.md](./2play-design.md)` §1/§3                                               |
| 产品边界                 | `[2play-prod-specs.md](./2play-prod-specs.md)`                                                                            |
| 兴趣标签文案               | 「出行兴趣（多选）」；无两段已删说明                                                                                                        |
| 性别                   | 注册/资料均非必填                                                                                                                 |
| Chat 真源              | 草稿 local；保存时 DB                                                                                                           |
| 主路径                  | 每次一条行程                                                                                                                    |
| Progressive / NDJSON | `[itinerary-design.md](./itinerary-design.md)` · feature **30–32**；冲突时 **itinerary-design + plan-10** > `2play-design` 摘要 |
| 四段 UI 命名             | 行程日提示 / 行程细节提示 / 行程 / 加载中提示（术语表）                                                                                          |


**下一步：** **W2r** MVP-3r（**34** `plan-14` → **35** `plan-15` → **36** `plan-16`，P0）→ **W3** MVP-4 余 story（**23** chat-01 → **25** AC2–3 → **26**）→ **W4** MVP-5（Replan / PDF）。实现 UI 以 mock + `2play-design.md` + `itinerary-design.md` 为对齐标准。

---



# 34 — Plan — plan-14 — Boundary passthrough

**类别：** Plan · **MVP-3r** · Feature **34** · 完工：**Done**（2026-08-24：natural_language 组装、时间补零三处、首块时间硬校验重试；vitest 153 绿 + live probe 首块 09:30 确认）

**作为** where2play 用户  
**我希望** 我填的边界条件（节奏、预算、出行类型、兴趣、每日起止时间、人数）完整进入 arrange 排程  
**以便** 行程符合我的输入，而不是被丢掉后按默认排

**实现前修订（2026-08-24，契约调研后）：**

1. `PlanBoundaries`（`src/core/itinerary-types.ts`）无 `must_include` 字段且 UI 无输入口（属 ChatBox MCP 概念）→ 从本 story 剥离；新增必去输入属新产品需求另行立项。
2. agent `discover_places` schema 只认 `city/bounds/origin/numDays/providers/locale`，不接受偏好 → AC 收敛为 arrange body 全量透传；discover 侧改善走 `plan-15`（带坐标 origin 改善搜索锚点）。
3. agent 死字段规避：`preferences.interests` agent 接受但不进 prompt；NDJSON 路径丢 `party_size`/`num_days` → 2play 一律把 tripType/interests/constraints 拼进 `preferences.natural_language`（agent `buildUserMessage` 已消费）。
4. 时间补零缺陷（三处）：`plan-validate.ts` 字符串比较、`plan-arrange-llm.ts` regex 允许 `\d{1,2}`、`itinerary-map.ts` `addMinutes` 要求严格 `\d{2}` → 随本 story 一并修。

## AC

- **AC1:** 给定 `PlanBoundaries`（pace/budget/tripType/interests/constraints/timeFrom/timeTo/partySize），When BFF 组装 `arrange_day`（host）请求体，Then 已有字段全部透传（pace/budget/party_size/preferences.time_from/time_to/transit_preferred 保持），tripType/interests/constraints 拼入 `preferences.natural_language`，无一静默丢弃。
- **AC2:** 给定时间输入 `"9:00"`/`"10:00"`（非补零），When 校验与解析，Then 归一为 `HH:MM` 后比较与传递，不再误判顺序、不再因单数字小时解析失败。
- **AC3:** 给定用户填每日起止 9:30/20:00，When 2play LLM 生成日卡，Then 首 block start_time 与 `timeFrom` 一致（±5min；user_prompt 带硬规则，覆盖「早于」与「无视默认 10:00 漂移」两个方向；违规触发一次纠偏重试）；末 block 结束不晚于 `timeTo`（交通段除外）。
- **AC4:** 透传与时间归一有契约/单元测试覆盖（body 断言 `natural_language` 含 tripType/interests/constraints；补零三处各有用例），非仅手测。

# 35 — Plan — plan-15 — Origin geocode before enrich

**类别：** Plan · **MVP-3r** · Q4 · Feature **35** · 完工：**To-do**（源自 agent 侧 code review：origin/dest 传 name-only，agent enrich 要求坐标不 geocode，首末段交通静默消失）

**作为** where2play 用户  
**我希望** 每日酒店/终点先解析成坐标再请求真实交通  
**以便** 酒店到第一站、最后一站回酒店这两段不再凭空消失

## AC

- **AC1:** 给定 origin/destination 为名称（如 "Hills Hotel Lisboa"），When enrich 前，Then 2play 先调 agent `geocode` 取 lat/lng，再传 `enrich_arrange_transit`；agent 契约不动。
- **AC2:** 给定 geocode 失败，When 降级，Then 该段显示明确「无法定位起点」类 i18n 提示，不伪造交通时长。
- **AC3:** 给定 geocode 成功，When enrich 返回，Then `from_origin`/`to_destination` 出现在日卡首尾（含真实时长与方式）。
- **AC4:** geocode 结果按名称缓存（同 trip 内同 origin 不重复调用）。

# 36 — Plan — plan-16 — Keep LLM transit fields

**类别：** Plan · **MVP-3r** · Q4 · Feature **36** · 完工：**To-do**（源自 agent 侧 code review：`daySchema`/`blockSchema` 剥掉 `from_origin`/`to_destination`/`legs_to_here`；enrich 失败被静默吞，全 timeline 退化默认估时）

**作为** where2play 用户  
**我希望** LLM 输出的交通字段被保留、enrich 失败可见  
**以便** 站间不再一律显示默认步行 10+ 分钟且无方式说明

## AC

- **AC1:** 给定 arrange LLM 输出含 `from_origin`/`to_destination`/`legs_to_here`，When Zod 解析，Then schema 保留这些字段（不再剥离），进入 `expandArrangeDayToSlots`。
- **AC2:** 给定 agent `enrich_arrange_transit` 失败或降级（`transit_outcome: "heuristic" | "partial"`），When 展示，Then UI 标注降级原因（i18n key），不静默当作成功。
- **AC3:** 给定 enrich 成功，Then 站间 transit 用 `legs_to_here` 真实时长/方式替换默认估时；`estimateTransferMin` 仅在无任何数据时兜底。
- **AC4:** 契约测试：schema 快照含 transit 字段；enrich 失败路径有显式断言（非 catch 后吞）。