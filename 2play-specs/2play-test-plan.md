# where2play — 测试计划

在 workspace **common-test-strategy** 基线上扩展 where2play 增量规则。不降低金字塔层级、不跳过 auth 测试、不削弱质量检查清单。格式对齐 what2eat [`2eat-test-plan.md`](../../2.what2eat/2eat-specs/2eat-test-plan.md)。

| 绑定 | 位置 |
| --- | --- |
| 基线 | `common-test-strategy`（always-on rule） |
| 产品规格 | [`2play-prod-specs.md`](./2play-prod-specs.md) |
| 用户故事 | [`2play-stories.md`](./2play-stories.md) |
| 设计 | [`2play-design.md`](./2play-design.md) |
| Progressive UX | [`itinerary-design.md`](./itinerary-design.md) · [`2play-stories.md`](./2play-stories.md) `plan-10` |
| UI mock | [`ui-mockup/`](./ui-mockup/) |
| places-agent 测试 | [`../../1.places-agent/agent-specs/4.test-strategy.md`](../../1.places-agent/agent-specs/4.test-strategy.md) |
| Agent 行程用例 | [`../../1.places-agent/agent-specs/agent-stories.md`](../../1.places-agent/agent-specs/agent-stories.md)（`plan_itinerary`） |
| ADR itinerary | [ADR-008](../../workspace-specs/adr/ADR-008-itinerary-ownership.md) |
| ADR live | [ADR-021](../../workspace-specs/adr/ADR-021-live-vendor-no-fixture.md) |
| ADR HTTP chat | [ADR-020](../../workspace-specs/adr/ADR-020-http-only-chat-and-enrich.md) |

**状态：** MVP-1 **closed**（2026-08-21：用户确认 usable；`make quality` = lint + test-coverage + test-e2e-mvp1）。§3 MVP DoD 仍为各切片交付门禁。

---

## §1 与 common-test-strategy 的关系

| 增量 | 规则 |
| --- | --- |
| Thin client | **L1 discover** / 地图经 BFF→places-agent；**L2 初排 + 助手**经 BFF 本应用 OPENAI_CN（ADR-036/037）；浏览器不持有 caller key / map key / LLM key |
| 不编造行程 | BFF 不得在 discover/OPENAI_CN 空/失败时返回 canned 景点名或假时段 |
| Live honesty（ADR-021） | MVP-2+ DoD：live vendor **discover**；签收探针无 `fixture_` native id；L2 可用 mock/沙箱 OPENAI_CN 于 Fast CI |
| Chat 双存储 | **草稿**仅 browser localStorage；**已保存快照**仅在用户点「保存」后入 DB；契约测试：未保存路径 DB **无**逐轮 chat INSERT |
| Chat / Plan L2 传输 | 助手与初排 L2：BFF → **本应用 OPENAI_CN**；**不**转发 agent `/v1/chat`；主路径**不** `arrange_day` **execution=agent**；**MVP-3** 起每日 **execution=host** 取 prompt 再 OPENAI_CN |
| 单行程 | Plan 主路径每次只交付**一条**行程；禁止用多卡短名单冒充主交付 |
| Progressive arrange（plan-10） | BFF：`slot_preview` 先于对应 `slot`；UI 一次只多一条；禁止 `arrange_pool_summary` 作主文案；pending 为 `plan-slot-pending` 同构 skeleton |
| 四 locale | `EN`/`CN`/`HK`/`TW`；HK ≠ TW；测试用 key / `data-testid` / role |
| 双信任模式 | 用户 session（cookie）访问 where2play；caller key 仅 BFF→agent 服务端 |
| 默认 PR CI | 注入 agent HTTP（快）；** alone 不满足** MVP-2/3/4 DoD |
| MVP E2E 签收 | 真实 where2play + 真实 places-agent（live vendor）+ 隔离测试 DB |
| Mock ≠ 产品证明 | MVP DoD **不得**用 `ui-mockup/` 静态 HTML 代替 Next 产品 |

### 1.1 双通道：Fast CI vs Live DoD

| 通道 | 目的 | 行程 / 场所数据 | 阻塞合并？ |
| --- | --- | --- | --- |
| **Fast CI** | 单测、BFF 契约、auth、i18n、校验 | 注入 agent 响应 | 是 — 每 PR |
| **MVP DoD / live probe** | 证明 thin client 对真实 vendor / `plan_itinerary` 可用 | Live agent + live keys | 是 — MVP-2/3/4 关闭前 |

**反模式：** Fast CI 用 stub `plan_itinerary` 即标 Plan done（`fixture-only`，非 MVP DoD）。

---

## §2 测试金字塔

目标 mix ~70 / 20 / 10。

| 层 | 内容 | 工具 |
| --- | --- | --- |
| 单元/组件 (~70%) | plan-validate、interest-map、itinerary-map、chat-truncate、chip-selection、i18n、local-draft、Zod、combo 全量选项 | Vitest |
| 集成/契约 (~20%) | `/api/*` + 注入 agent fetch；session/CSRF；DB CRUD；保存前无 chat 行；保存后有快照 | Vitest + `TEST_DATABASE_URL` |
| E2E (~10%) | 每 MVP 一条完整旅程 | Python Playwright + live 栈（MVP-2+ 双进程） |

不得仅用硬编码行程 JSON 的单测代替 Plan E2E。

---

## §3 MVP DoD 质量门

MVP-2/3/4 涉及 place / itinerary 数据时，**全部**满足方可关闭：

1. **真实栈：** where2play + places-agent 运行；BFF 使用真实 caller key。
2. **Live vendors：** agent `PLACES_VENDOR_MODE=live`（探针目的地）。
3. **无 fixture id：** 行程 slot `nativeId`（若有）不以 `fixture_` 开头。
4. **运营探针目的地：** 每区域至少一处（如 CN 台北或杭州；EN London）— 写入 retrospective。
5. **Playwright MVP 旅程** 在 live 栈上绿（§6）。
6. **用户确认：** 「Do you confirm this MVP is usable?」（workspace DoD）。
7. **状态标签：** place/plan 路径为 `live-honest` 或 `fail-closed` — 非 `implemented` / `fixture-only`。
8. **视觉：** 关键路径与 [`ui-mockup/`](./ui-mockup/) + [`2play-design.md`](./2play-design.md) §1/§3 对齐（抽检关键屏）。

MVP-1 不调 agent，但仍需真实 DB、真实 session、真实邮件路径（Resend sandbox 或 dev outbox）。

### MVP-1 — 账号与 profile

| 门禁 | 要求 |
| --- | --- |
| 功能 | 注册、登录、重置/设置密码、单卡 profile（含出行兴趣）持久化；必填标记 |
| 测试 | `make test` / `make test-coverage` 绿；`make test-e2e-mvp1` 绿 |
| 真实集成 | 测试 DB；session；邮件 outbox |
| 质量 | common-test-strategy + §4（URL 无 password、i18n key、性别非必填） |
| 用户 | 明确可用性确认 |
| Retrospective | 运行 `retrospective` skill |

### MVP-2 — Plan + 保存闭环

| 门禁 | 要求 |
| --- | --- |
| 功能 | Live 边界 → progressive **一条** Day/Hour（**14–22**, **30**）；`plan-07` **AC1**（`messages: []`）；兴趣预填；多卡/详情/取消收藏 |
| 测试 | `make test` + **`make test-e2e-mvp2-live`**；**plan-10** §5.4 P10-E1/E2 |
| Live | ADR-021 探针通过；保存/打开基于真实行程快照；更新诚实性矩阵 |
| 质量 | 不编造场所；单行程；Progressive 非候选池主文案；无未保存 History 分区 |
| 用户 | 在 **live 目的地** 上确认 MVP-2 usable（含保存 → 我的行程 → 详情） |
| Retrospective | 附探针目的地 + 样例 itinerary JSON（无密钥） |

### MVP-3 — Plan L2 完整路径（Mode H）

**批次状态：Done（as-built，2026-08-23）** — 与 [ADR-043](../../workspace-specs/adr/ADR-043-chatbox-mcp-and-cross-product-closure.md) 双通道表一致。Stories **31–33** 代码与契约测绿；live E2E opt-in。

| 门禁 | 要求 |
| --- | --- |
| 功能 | **31–33**：host prompt → OPENAI_CN；`legs_to_here` enrich；slot **含 clock window**（如 `09:30–11:00`） |
| 管线 | discover → host → OPENAI_CN → enrich；**不** execution=agent |
| 回归 | `expand-arrange-slots` / `plan-day-by-day` / `itinerary-map`（时刻 + legs 优先于 15min） |
| ChatBox | **另通道**（MCP 强制 agent）— 非本表 2play 管线 |

#### MVP-3 分 story 门禁（incremental-delivery）

一次只关一条 story；**不得**因 `make test` 全绿就把整批标 Done。

| Story | 单元 / 契约（Fast CI） | Live / E2E | 用户确认 | Story 可标 Done？ |
| --- | --- | --- | --- | --- |
| **31** `plan-11` | `plan-day-by-day` / `api-plan`：host 调用、无 agent LLM | AC3 地标 → **W2d** | AC1–2/4 契约 + W2d AC3 | **Done** |
| **33** `plan-13` | `expand-arrange-slots`；agent `http-enrich-arrange-transit` | transit 模式 → **W2d** | 随 W2d | **Done** |
| **32** `plan-12` | `plan-arrange-llm` stream parser | 全链路 → **W2d** | 随 W2d | **Done** |
| **W2d 签收** | — | **`make test-e2e-mvp3-live`** | **必须** | → **MVP-3 Done**（2026-08-23） |

**W2d 排障清单（已关闭 2026-08-23）：**

1. E2E `e2e/run.py` 显式 `DATABASE_URL` + `app_dev_cmd()` 传入 dev 进程（避免 Prisma P2021）。
2. Agent E2E 用 `NODE_ENV=development npx tsx --env-file=.env.local server.ts`（非 `npm run dev` watch）。
3. `PLAN_SLOT_STAGE_MS=0` 缩短 staged emit；`probe_plan_stream.py` 作秒级诊断。
4. 杀 stale `:3010` / `:3030`；双服 `with_server.py`。
5. Caller key 已对齐（`where2play.dev.local` ACTIVE）。

### MVP-3r — 边界透传 + 交通契约修复（W2r，2026-08-24 立项）

| 门禁 | 要求 |
| --- | --- |
| 功能 | **34** `plan-14` arrange body 全量透传（tripType/interests/constraints → `preferences.natural_language`）+ 时间补零三处 + 首块时间硬校验；**35** `plan-15` origin/dest 先 geocode 成坐标贯穿 discover·arrange·enrich；**36** `plan-16` schema 保留 `from_origin`/`to_destination`/`legs_to_here` + enrich 失败显式 `transit_outcome` |
| 管线 | 不动 agent 契约；全部 2play 侧（BFF client + 编排 + timeline） |

#### MVP-3r 分 story 门禁（incremental-delivery）

一次只关一条 story；spec 真源 AC 见 `2play-stories.md` §34–36。

| Story | 单元 / 契约（Fast CI） | Live / E2E | 用户确认 | Story 可标 Done？ |
| --- | --- | --- | --- | --- |
| **34** `plan-14` | TC-M3r-34-\*（下表） | 手测一次 live 排程首块 = timeFrom ±5min | 必须 | Done |
| **35** `plan-15` | TC-M3r-35-\*（下表） | live 抽查里斯本首末段真实交通 | 必须 | To-do |
| **36** `plan-16` | TC-M3r-36-\*（下表） | 整批收尾 live 对照 5 症状 | 必须 | To-do |

#### TC-M3r-34（plan-14）

| ID | 类型 | 主题 | 文件 |
| --- | --- | --- | --- |
| TC-M3r-34-01 | Unit | `buildArrangeDayBody`：tripType「情侣出游」+interests+constraints → `preferences.natural_language` 三者俱全；不使用 `preferences.interests`（agent 死字段） | `tests/plan-agent-body.party-size.test.ts` 扩展或新文件 |
| TC-M3r-34-02 | Unit | `plan-validate`：`"9:00"`/`"10:00"` 补零归一后比较，不误判顺序；输出 `HH:MM` | `tests/plan-validate.test.ts` |
| TC-M3r-34-03 | Unit | `parseArrangeDayModelText`：LLM `"9:30"` 归一 `"09:30"`；schema 严格 `^(\d{2}):(\d{2})$` | `tests/plan-arrange-llm.test.ts` |
| TC-M3r-34-04 | Unit | `streamArrangeDay`：mock LLM 首块 10:00、timeFrom=09:30 → 一次纠偏重试后合规（±5min 双向） | `tests/plan-arrange-llm.test.ts` |
| TC-M3r-34-05 | Unit | `addMinutes`：`"9:30"` 输入先补零，end 计算不再原样返回 | `tests/itinerary-map.test.ts` |

#### TC-M3r-35（plan-15）

| ID | 类型 | 主题 | 文件 |
| --- | --- | --- | --- |
| TC-M3r-35-01 | Unit | `client.geocode`：传 name → agent `/v1/geocode`，返回 `{lat,lng}`；失败返回 null（不抛） | `tests/plan-agent-client.test.ts`（新增） |
| TC-M3r-35-02 | Unit | `enrichArrangedDay`：origin name-only → 先 geocode 取坐标再传 enrich；origin 有坐标后 `from_origin` 出现真实时长/方式 | `tests/plan-enrich-transit.test.ts`（新增） |
| TC-M3r-35-03 | Unit | geocode 缓存：同 trip 内同 origin 第二次不重复调 agent（mock fetch 计数） | `tests/plan-enrich-transit.test.ts` |
| TC-M3r-35-04 | Unit | geocode 失败：origin 段显示 i18n key「无法定位起点」，不伪造交通时长；其余站间不受影响 | `tests/plan-enrich-transit.test.ts` |
| TC-M3r-35-05 | Unit | destination 同理：name → geocode → `to_destination` 真实时长/方式 | `tests/plan-enrich-transit.test.ts` |

### MVP-4 — Chat 双存储

| 门禁 | 要求 |
| --- | --- |
| 功能 | Plan 页内 Chat 真实 OPENAI_CN 回复并可随动改行程；local 草稿；`plan-07` AC2–3；详情只读快照；登出清 local |
| 测试 | `make test` + **`make test-e2e-mvp4-live`** |
| Chat 存储 | 未保存：仅 localStorage；保存后：DB 有快照行；E2E 验证两边 |
| 质量 | 无 FAB 第二入口；回复标为建议；非票务权威 |
| 用户 | 明确可用性确认 |
| Retrospective | lessons + 若有 ADR（chat commit） |

### MVP-5 — Replan + PDF + Chat 高度

| 门禁 | 要求 |
| --- | --- |
| 功能 | Replan 确认对话框；新行程（**MVP-3** Mode H 管线）；local chat 保留 + 分隔泡；PDF；chat 仅高度 resize |
| 测试 | `make test` + **`make test-e2e-mvp5-live`** |
| 质量 | PDF 不编造场所；replan 不删已保存 DB 行 |
| 用户 | 明确可用性确认 |
| Retrospective | lessons |

---

## §4 质量检查清单（where2play 增量）

在 common-test-strategy 全量清单之上，另需：

- [ ] Token 表单：E2E 提交后 URL 不含 `password=`
- [ ] 用户 session 不能从浏览器直连 places-agent `/v1/*`
- [ ] Caller key 不在 client bundle / localStorage / sessionStorage
- [ ] 未保存 chat 仅 localStorage；契约：无「每轮」DB INSERT
- [ ] 保存后 `ItineraryChatMessage`（或等价）存在且只读详情可见
- [ ] 登出清除 `w2p.chat.*`；DB 已保存保留
- [ ] Plan 主路径结果为**单行程**（无多候选卡网格）
- [ ] Progressive（`plan-10`）：`slot_preview` 先于 `slot`；细节提示非候选池摘要；`plan-slot-pending` 可见；`prefers-reduced-motion` 无 shimmer
- [ ] MVP-2 live：slot 无 `fixture_` id（有 id 时）；至少一个真实 vendor source
- [ ] 地图/详情外链无 API key query
- [ ] HK 与 TW 非同一 catalog
- [ ] 默认 PR CI 不要求 live map keys
- [ ] MVP DoD 不用 `ui-mockup/` 代替 Next 产品证明
- [ ] 性别非必填（注册/资料）
- [ ] Profile 兴趣在同一卡；标签「出行兴趣（多选）」；无两段已删说明文案
- [ ] Replan 文案与分隔泡 i18n key 存在
- [ ] Story 诚实性矩阵与 §8 一致

---

## §5 测试用例矩阵

实现后落在 `3.where2play/tests/` 与 `e2e/`。下列为**计划用例**（命名可微调，覆盖不得少）。

### 5.1 单元 / 组件

| ID | 模块 | 用例意图 |
| --- | --- | --- |
| U-01 | `plan-validate` | 目的地空 → invalid |
| U-02 | `plan-validate` | 天数 0 / 15 → invalid；1–14 ok |
| U-03 | `plan-validate` | 仅填开始或结束 → ok；成对且 end≤start → invalid |
| U-03b | `plan-validate` | 起始日期空/非法 → invalid；合法 `YYYY-MM-DD` ok |
| U-03c | `plan-agent-body` | `startDate` → `bounds.start`；`end = startDate + days`；arrange `date` 偏移 |
| U-03d | `plan-day-by-day` | NDJSON：`phase`(discover) → `candidate_place*` → `discover_done` → `arrange_day_start` → `day_highlights` → (`slot_preview`→`slot`)\* → `day_done` → `done` |
| U-03e | `plan-day-by-day` | 跨日 `filterUnusedCandidates`：Day2 不含 Day1 已用 name |
| U-03f | `expandArrangeDayToSlots` | progressive `slot` 与 `day_done` 最终 slots 一致（含 transit） |
| U-03g | Plan UI progressive | `slot_preview` 更新 `.plan-slot-preview`（非 `arrange_pool_summary` 主文案）；reveal 队列逐条 +1；`plan-slot-pending` 同构 skeleton |
| U-03h | i18n plan-10 | `play.plan.arrange_planning_day`、`preview_*`、`meal_*` 四 locale |
| U-04 | `interest-map` | Profile chips ↔ Plan `data-interest` 枚举双向映射 |
| U-05 | `itinerary-map` | agent timed days/blocks → `ItineraryDto` slots（transit/place） |
| U-06 | `itinerary-map` | 缺失 photo → omit；不填假 URL |
| U-07 | `chat-truncate` | 超长 transcript 截断保留尾部 + system 分隔后上下文 |
| U-07b | `chat-assistant` | prompt 组装含行程摘要；不含 agent `/v1/chat` |
| U-07c | `itinerary-patch` | 优先 `itineraryPatch`；否则完整 `itinerary` 替换；皆无则行程不变 |
| U-08 | `local-draft` | save/load `w2p.chat.draft`；logout clear | Vitest + `make test-e2e-chat02` |
| U-09 | `combo` | 打开列表返回全部预设（不按当前值过滤） |
| U-10 | i18n | CN/HK/TW key 解析；缺失回退不抛 |
| U-11 | register-validation | 密码不匹配；邮箱格式；性别可选 |
| U-12 | chip-selection | 多选 toggle 独立 |

### 5.2 集成 / 契约（注入 agent）

| ID | API / 行为 | 断言 |
| --- | --- | --- |
| C-01 | `POST /api/auth/register` | 201；session；兴趣可选写入 |
| C-02 | `POST /api/auth/login` 错密 | 401；无 session |
| C-03 | `PUT /api/profile/personal` | 持久化 name/email/location/interests |
| C-04 | `PUT` 缺姓名 | 400 |
| C-05 | CSRF 缺失 | 变更 API 拒绝 |
| C-06 | `POST /api/plan` | 注入 discover + **mock OPENAI_CN arrange** → 一条 itinerary；NDJSON 含 `slot_preview` 先于 `slot`；写 PlanSessionCache；**不**调用 agent `/v1/arrange_day` **execution=agent**（as-built 亦不调 host；`plan-11` 后可 mock `execution=host` 仅拉 prompt） |
| C-07 | `POST /api/plan` discover/OPENAI_CN 失败 | 5xx/4xx 诚实错误；**无** canned 行程 |
| C-08 | `GET /api/plan/current` | 返回未过期 cache |
| C-09 | `POST /api/saved` | 行程入库；MVP-2 允许 `messages: []`；返回 id |
| C-10 | 保存前查 chat 表 | 无「仅聊天」产生的行 |
| C-11 | `GET /api/itineraries/[id]` | 含 DB messages；越权 404 |
| C-12 | `DELETE /api/saved/[id]` | 列表不再包含 |
| C-13 | `POST /api/chat` | 鉴权/CSRF；mock OPENAI_CN 流式 → reply + `itineraryPatch`/`itinerary`；**不**调用 agent `/v1/chat`；缺 `OPENAI_API_KEY` → 明确 outcome key |
| C-13b | `POST /api/plan` 缺 OPENAI | 明确 `errors.openai_not_configured`（或等价） |
| C-14 | `POST /api/plan/replan` | 新 itinerary；L2 仍 BFF OPENAI_CN；请求含截断 messages |
| C-15 | `GET .../export` | `content-type: application/pdf`；body 非空 |
| C-16 | `POST /api/geocode/reverse` | 注入成功/失败路径 |

### 5.3 Feature ↔ 测试落点（实现后填路径）

| Feature / MVP | 单元/契约（计划） | E2E（计划） | Makefile（计划） |
| --- | --- | --- | --- |
| **MVP-1** auth/profile/shell | `auth-*`, `profile-*`, `locale`, `i18n`, `register-validation`, `csrf` | `e2e/test_mvp1.py`, login_failed, reset_set, register_errors | `make test`, `make test-e2e-mvp1` |
| **MVP-2** plan + saved | `plan-*`, `saved-*`, `itinerary-map`, **plan-10** §5.4 | `e2e/test_mvp2_live.py` | `make test-e2e-mvp2-live` |
| **MVP-3** chat commit | `chat-*`, `local-draft`, `commit` | `e2e/test_mvp3_live.py` | `make test-e2e-mvp3-live` |
| **MVP-4** replan/pdf/resize | `replan`, `pdf-build`, chat-resize | `e2e/test_mvp4_live.py` | `make test-e2e-mvp4-live` |

### 5.4 `plan-10` Progressive generate UX（[`2play-stories.md`](./2play-stories.md) §30）

对齐 [`itinerary-design.md`](./itinerary-design.md) 与 agent [`performance.md`](../../1.places-agent/agent-specs/performance.md) 第十一节 §11.8。

| ID | 层 | 用例意图 |
| --- | --- | --- |
| P10-U1 | BFF | mock OPENAI_CN 整日 JSON → 每对 `slot_preview` 先于 `slot`；staged 间隔可 `PLAN_SLOT_STAGE_MS=0` |
| P10-U2 | `itinerary-map` | `expandArrangeDayToSlots` 含日首/日尾/站间 transit |
| P10-U3 | UI | `slot_preview.kind` 切换 `play.plan.preview_*` 模板；一次 DOM 只多一条 `.slot` |
| P10-U4 | UI | `data-testid=plan-slot-pending` 同构 skeleton；非虚线框主视觉 |
| P10-U5 | UI/a11y | `prefers-reduced-motion`：无 pending shimmer |
| P10-E1 | E2E live | 生成多日：细节提示随 kind 变化；pending 可见；日提示仍为「正在安排第 d/N 天」 |
| P10-E2 | E2E live | 同帧多条事件仍逐条揭示（无整日同 tick 刷屏） |

**状态：** P10-U* 目标绿于 Fast CI；P10-E* 为 MVP-2 DoD / `plan-10` **E2E 待签** 门禁。

---

## §6 关键 E2E 旅程步骤

| 旅程 | MVP | 步骤摘要 |
| --- | --- | --- |
| 注册 → profile（兴趣）→ 登出 → 登录 → profile 仍在 | MVP-1 | 含 EN→CN locale；family footer；必填 `*` |
| 注册：性别可跳过 | MVP-1 | 不选具体性别仍可注册 |
| 登录失败提示 | MVP-1 | |
| 重置/设置密码 | MVP-1 | 无 URL 泄露 password |
| 登录 → Plan 填边界 → 生成 → **一条** progressive Day/Hour | MVP-2 | live；无 `fixture_`；§5.4 P10-E1/E2 |
| Plan 校验 / combo / 单行程 | MVP-2 | 字段错误；全量 combo |
| 兴趣预填 → 保存 → 我的行程卡 → 打开详情 → 取消收藏 | MVP-2 | `messages: []` 可 |
| Chat 真实回复 → 中部随动（若有 patch）→ 刷新 local 仍在 → 登出清除 | MVP-3 | |
| 保存后详情只读 DB 对话 | MVP-3 | saved-04 |
| 保存后再聊不自动更新 DB 直至再保存 | MVP-3 | plan-07 AC2 |
| Replan：取消不变；确认后新行程 + 分隔泡 + 对话保留 | MVP-4 | |
| 导出 PDF 可下载 | MVP-4 | |
| Chat 高度拖拽 ≥ min | MVP-4 | |
| `prefers-reduced-motion` 关闭飞机动画 | MVP-4 或视觉抽检 | |

**Harness：** MVP-1 单进程 where2play；MVP-2+ 加 places-agent（`scripts/with_server.py` 或 Makefile 包装）。Playwright：`networkidle` 或显式 `data-testid` 等待（见 webapp-testing skill）。关键 testid 见 [`2play-design.md`](./2play-design.md) §3 表。

---

## §7 CI 命令表

| 命令 | 时机 | 内容 |
| --- | --- | --- |
| `make test` | 每 PR | Vitest 全量（注入 agent） |
| `make test` | 单元/集成 | 无覆盖率门禁 |
| `make test-coverage` | MVP-1 覆盖率门禁 | auth/profile/locale/geocode include；≥80% / branches ≥75% |
| `make test-e2e-mvp1` | MVP-1 DoD | 真实 DB 旅程 |
| `make test-e2e-mvp2-live` | MVP-2 DoD | 双服 live；保存闭环；as-built 本地 prompt |
| `make test-e2e-mvp3-live` | MVP-3 DoD | Mode H + 真交通 + 地标探针 live |
| `make test-e2e-chat02` | MVP-4 story **24** | local 草稿 refresh + logout |
| `make test-e2e-mvp4-live` | MVP-4 DoD | chat 双存储 live |
| `make test-e2e-mvp5-live` | MVP-5 DoD | replan + PDF + resize |
| `make lint` / typecheck | 每 PR | `tsc --noEmit` |
| Coverage | 可测时 | 关键路径 100%；整体 ≥80% |

失败阻塞合并。不得 skip auth、Plan、chat 持久化测试换绿。

本地开发：`make dev` / `make up` / `make down`（makefile 规则；实现脚手架时落地）。

---

## §8 探针目的地与诚实性矩阵

运营探针（示例 — 签收时写入 retrospective）：

| 区域 | 目的地 / pin | 期望 providers 倾向 |
| --- | --- | --- |
| CN / TW | 台北 或 杭州 | 含 `AMAP`（若 caller 列出） |
| EN | London（或 Clerkenwell 周边游玩） | `GOOGLE_MAPS` |

**诚实性矩阵（where2play 层）：**

| 路径 | Live 依赖 | Fast CI | Live probe | MVP | 最近 live pass |
| --- | --- | --- | --- | --- | --- |
| Register / login / profile | App DB | Vitest + E2E | 真实登录 | MVP-1 | — |
| Plan → 单行程 + 保存 | discover+L2 | 注入 HTTP | `test-e2e-mvp2-live` | MVP-2 | — |
| Mode H arrange | discover+host+OPENAI_CN | mock host + mock LLM | `test-e2e-mvp3-live` | MVP-3 | **2026-08-23** |
| 真交通 / 地标探针 | agent enrich + ADR-038 | 契约 + live | `test-e2e-mvp3-live` | MVP-3 | **2026-08-23** |
| Save / unsave | App DB | Vitest + E2E | `test-e2e-mvp2-live` | MVP-2 | — |
| Chat 草稿 local | localStorage `w2p.chat.draft` | U-08 + E2E stub | `make test-e2e-chat02` | MVP-4 | **2026-08-23** |
| Plan chat | `POST /api/chat` → OPENAI_CN（ADR-036） | mock LLM | `test-e2e-mvp4-live` | MVP-4 | — |
| Chat commit on save | App DB | 契约：保存前后行数 | 同上 | MVP-4 | — |
| Saved detail read-only chat | App DB | Vitest + E2E | 同上 | MVP-4 | — |
| Reload hydrate (`/api/plan/current`) | PlanSessionCache | 契约 | MVP-2/4 | MVP-2 | — |
| Progressive arrange (`plan-10`) | BFF NDJSON + UI | U-03d/g, P10-U*, C-06 | P10-E* + `test-e2e-mvp2-live` | MVP-2 | — |
| Replan + divider | MVP-3 plan + chat | 单元 + E2E | `test-e2e-mvp5-live` | MVP-5 | — |
| PDF export | DTO → PDF | 契约 content-type | 同上 | MVP-5 | — |
| Chat height resize | 组件 + Playwright | min height | 同上 | MVP-5 | — |

Agent 层 live 探针细节见 places-agent 测试文档 — 此处不重复 TC 明细。

---

## §9 TDD 与 AC 映射

1. 从 [`2play-stories.md`](./2play-stories.md) 取**一条** user story（incremental delivery）。
2. 每条 AC：**Red**（可观测 Then）→ **Green** → **Refactor**。
3. 命名：`should_[expected]_when_[condition]`。

| Story 区域 | 主层 | DoD 需 live？ |
| --- | --- | --- |
| Shell、home、i18n、footer | 组件 + Playwright | MVP-1：仅真实 app |
| Account、profile | 集成 + Playwright | MVP-1：真实 DB |
| Plan、saved（主路径） | 单测 + BFF + Playwright | MVP-2：**是** |
| Chat 草稿 / 提交 | 集成 + Playwright | MVP-3：**是** |
| Replan、PDF、resize | 集成 + Playwright | MVP-4：**是** |

---

## §10 失败处理

修生产代码或错误测试；不得删/ skip AC 测试换绿。反模式：硬编码行程、仅用单测签 MVP-2、把每轮 chat 写入 DB、把 `make test` fixture 绿当作 live 诚实、用 mockup HTML 冒充产品 DoD。

---

## §11 与 mock / 设计抽检

| 抽检项 | 方法 |
| --- | --- |
| Plan 双行栅格 / Discover 同态 slot / Arrange `slot_preview`→`slot` / pending skeleton | E2E screenshot 或 `data-testid` 断言对照 accepted mock |
| Primary = glaze | 视觉 / computed style 抽检 |
| 无 FAB | DOM 无全局 chat FAB |
| Profile 单卡 + 兴趣标签 | E2E 文案/testid |

视觉真源：[`ui-mockup/`](./ui-mockup/)；契约：[`2play-design.md`](./2play-design.md) §3.9。
