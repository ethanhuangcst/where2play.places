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
| **35** `plan-15` | —（**Superseded** → MVP-10） | — | — | Superseded |
| **36** `plan-16` | TC-M3r-36-\*（下表） | 整批收尾 live 对照 5 症状 | 必须 | Done |

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

#### TC-M3r-36（plan-16）

| ID | 类型 | 主题 | 文件 |
| --- | --- | --- | --- |
| TC-M3r-36-01 | Unit | `blockSchema` 保留 `from_origin`/`to_destination`/`legs_to_here`：Zod parse 后字段存在，进入 `expandArrangeDayToSlots` | `tests/expand-arrange-slots.test.ts`（扩展） |
| TC-M3r-36-02 | Unit | enrich 失败显式 `transit_outcome: "partial"`：UI 不静默吞，标注降级原因（i18n key） | `tests/plan-enrich-transit.test.ts`（扩展） |
| TC-M3r-36-03 | Unit | 2play 侧站间时序校验（AC5）：blocks 含 legs_to_here，gap < transit − 5min → 触发一次重试；重试仍违规则硬失败 | `tests/plan-arrange-llm.test.ts`（扩展） |
| TC-M3r-36-04 | Unit | 2play 侧同日餐厅去重（AC6）：lunch/dinner 同名 → 触发一次重试；重试仍违规则硬失败 | `tests/plan-arrange-llm.test.ts`（扩展） |
| TC-M3r-36-05 | Unit | `expandArrangeDayToSlots` 混合 legs：有 `legs_to_here` 用真实时长/方式；无则 `estimateTransferMin` 兜底 | `tests/expand-arrange-slots.test.ts`（扩展） |

**注（2026-08-31）：** plan-15（35）**Superseded** — geocode/首末段并入 MVP-10 plan-46；TC-M3r-35-* 不再作为独立 story 门禁，等价覆盖见 TC-M10-46-04 / TC-M10-44-04。

### MVP-10 — plan-46 轻骨架消费端（2026-09-02 mock/spec 锁定；UI 重做）

**真源：** `[2play-stories.md](./2play-stories.md)` #37 · `[itinerary-design.md §16–17](./itinerary-design.md)` · `[2play-design.md §3.9 / §4.2.1 / §4.7](./2play-design.md)` · mock [`ui-mockup/`](./ui-mockup/) · agent `[0.refactor-plan.md](../../1.places-agent/agent-specs/0.refactor-plan.md)` 批次 11/16。

| 门禁 | 要求 |
| --- | --- |
| 功能 | **37** plan-46：mock **100%** 结构对齐 + 5 字段 + `plan-nav` intake + constraints/travel-tips + 新 BFF（`make_itinerary` → `plan_next_stop` + `fetch_trip_details`）+ place sheet |
| 依赖 | agent F44 + F63/64 + **F65 Done**（无 `display_current_stop`） |
| Mock 门 | 实现页 DOM/testid 与 `06-plan.html` / `06-plan-qa.html` / `06-plan-skeleton.html` / `09-saved-detail.html` 一致；**不得**仅用 CSS 壳冒充 |
| Live | Lisbon 4D：首 stop < 30s，总 < 90s |
| Agent parity | 30 城（§5.5） |
| 用户 | 明确 usable 确认（DoD） |

**分阶段测试签收（对齐 stories W2.5a–f）：**

| 子阶段 | 必绿测试 |
| --- | --- |
| W2.5b BFF | TC-M10-46-01/02/03 + `plan-skeleton-fill` |
| W2.5c Shell | TC-M10-46-12 + 视觉 spot-check `01–05`/`07–08` |
| W2.5d Plan UI | TC-M10-46-05/08/09/10/11 + TC-M10-E2E-01–04 |
| W2.5e Saved | TC-M10-46-06/07 + TC-M10-E2E-05 + saved detail 同构 |
| W2.5f 签收 | `make test-e2e-mvp10-live` + parity stub + 用户确认 |

| Story | 单元 / 契约 | E2E | 用户确认 | Done？ |
| --- | --- | --- | --- | --- |
| **37** plan-46 | TC-M10-46-* | TC-M10-E2E-* | 必须 | **ToDo** |

#### TC-M10-46（plan-46 BFF + UI）

| ID | 类型 | 主题 | 文件（目标） |
| --- | --- | --- | --- |
| TC-M10-46-01 | Unit | BFF 默认路径不调 `streamArrangeDay` / OPENAI_CN arrange | `tests/plan-skeleton-fill.test.ts` |
| TC-M10-46-02 | Unit | NDJSON：`skeleton_day` → `stop_filled` 序列 | `tests/plan-stream-client.test.ts` |
| TC-M10-46-03 | Unit | 起点 Stay stop；transit 单行双 mode | `tests/itinerary-skeleton-map.test.ts` |
| TC-M10-46-04 | Unit | origin geocode 失败 → i18n 降级 | `tests/plan-skeleton-fill.test.ts` |
| TC-M10-46-05 | Component | `plan-takeoff` 5 格；无 `plan-board` 双行；CTA 仅开助手 | `tests/plan-page.test.tsx` |
| TC-M10-46-06 | Component | place sheet：facts/itiner/nav；Escape 关闭 | `tests/place-sheet.test.tsx` |
| TC-M10-46-07 | Unit | place sheet enrich / 失败 i18n | `tests/place-sheet-data.test.ts` |
| TC-M10-46-08 | Unit | intake 8 步：默认跳过、`PlanBoundaries` 映射（§4.2.1） | `tests/plan-intake.test.ts` |
| TC-M10-46-09 | Component | `plan-constraints` 12 项；问答中 `—` | `tests/plan-constraints.test.tsx` |
| TC-M10-46-10 | Component | `plan-travel-tips` 四卡 + fold + visa popover | `tests/plan-travel-tips.test.tsx` |
| TC-M10-46-11 | Component | panel 头三按钮；`plan-phase`；无 bottom sticky | `tests/plan-page.test.tsx` |
| TC-M10-46-12 | Component | Public/App `data-style="travor"`；register/profile photo grid | `tests/travor-shell.test.tsx` |

#### TC-M10-E2E（Playwright）

| ID | 类型 | 主题 |
| --- | --- | --- |
| TC-M10-E2E-01 | E2E | 5 字段 → `plan-nav` 8 步（含默认跳过）→ 骨架预览可见 |
| TC-M10-E2E-02 | E2E | 首屏 `stop-origin` + 至少一条 `.transit-line` |
| TC-M10-E2E-03 | E2E | 终止问答 → 确认弹窗（4 i18n key） |
| TC-M10-E2E-04 | E2E | `prefers-reduced-motion` 无 shimmer |
| TC-M10-E2E-05 | E2E | `stop-detail-open` → `place-sheet`；`place-sheet-map` 新标签 |
| TC-M10-E2E-06 | E2E | 助手接管后可见 `plan-constraints`；贴士四卡在骨架 + travel_tips fetch 之后 |
| TC-M10-E2E-07 | E2E | 点「规划行程」即 discover；步骤 g 有 grounded 芯片（可晚于 b–f） |

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
- [ ] MVP-10 Travor：`data-style="travor"` 于 App + Auth；无 legacy `plan-board` 默认路径
- [ ] MVP-10：`plan-constraints`（12 项）+ `plan-travel-tips`（四卡）可见且 testid 正确
- [ ] MVP-10：`plan-nav` intake（非页内 chat）；CTA 不直接 POST 生成
- [ ] Register / Profile：`.register-card__photo` 头像 bowl（§3.2/§3.4）
- [ ] Home：`auth-links` 注册链（§3.1）
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

**状态：** P10-U* 目标绿于 Fast CI；P10-E* 为 MVP-10 / plan-46 DoD 门禁。

### 5.5 Agent 30 城 parity E2E（plan-46 · AC22–23）

**真源：** agent [`e2e-test.md`](../../1.places-agent/agent-specs/e2e-test.md) §5 + [`e2e-test-result/INDEX.md`](../../1.places-agent/agent-specs/e2e-test-result/INDEX.md) + 各城 `NN-city.md`。

**目标：** where2play Plan 页（BFF → agent 同工具链）产出与 agent 直连 E2E **可比**；用于回归 plan-46 消费端未扭曲 agent 结果。

**运行方式（计划）：**

```bash
# agent 基线（已有）
cd 1.places-agent && python3 scripts/e2e-places-agent.py --all

# where2play parity（待实现）
cd 3.where2play && python3 e2e/test_agent_parity_30.py [--only lisbon] [--compare]
```

**通过判据（每城）：**

| # | 断言 | 说明 |
| --- | --- | --- |
| P30-01 | 链路 | UI/BFF 到达 `trip_complete`（或 honest 失败） |
| P30-02 | 骨架 | 各 `day_theme` + stop **名称集合** 与 agent markdown「骨架」节一致（顺序可忽略子排序） |
| P30-03 | 填充 | 各 stop 名称 + kind 与 agent「逐站填充」一致；时段 ±15min |
| P30-04 | 交通 | transit 模式/时长档位与 agent 同行一致（`partial` 时双方均显式降级） |
| P30-05 | 失败对齐 | agent INDEX 标记 ✗ 的城，where2play 不得 fixture 绿 |

**用例矩阵（引用 agent INDEX，不重复 30 行输入）：**

| 分组 | 城市 # | agent 结果 | where2play 期望 |
| --- | --- | --- | --- |
| 基线必过 | 1 Lisbon, 4 Rome, 11 Prague, 27 KL | ✓ | P30-01–04 全过 |
| 长耗时 | 20 Kyoto, 1 Lisbon | ✓ | 墙钟允许 +50% vs agent INDEX |
| 已知 agent 失败 | 2 Paris, 3 Tokyo, 21 Hanoi | ✗ | P30-05；UI 可读错误 |
| 全量 | 01–30 | 27/30 ✓ | nightly opt-in；产出 `2play-specs/e2e-parity-result/INDEX.md` |

**产物：** `2play-specs/e2e-parity-result/{NN}-{city}.md`（并排：agent 摘要 vs where2play 摘要 + diff 行）。

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

## §10a MVP-11 — 国籍字段 + 出行建议占位（2026-09-01 规格确定）

**真源：** [ADR-044](../../workspace-specs/adr/ADR-044-orizn-visa-rest-adapter.md) · `[2play-stories.md](./2play-stories.md)` Feature **38–39** · agent Feature **48** · `[2play-design.md](./2play-design.md)` §3.2/§3.4/§3.5.6。

| Story | Feature | 单元 / 契约（Fast CI） | E2E | Story 可标 Done？ |
| --- | --- | --- | --- | --- |
| **38** profile-03 | 国籍下拉 + DB | TC-M11-38-* | TC-M11-38-E2E | ToDo |
| **39** plan-47 | spec + mock 占位 | 文档/mock 抽检 | — | ToDo（spec only） |

**MVP DoD 增量（Feature 38）：**

1. 注册/资料页含国籍下拉；四 locale i18n key。
2. Prisma `User.nationality String?` + 迁移；注册/PUT profile API 持久化。
3. 非法 alpha-3 拒绝；空值存 `null`。
4. **不**在本 MVP 开发 visa 查询 UI（Feature 39 仅占位）。

#### TC-M11-38（profile-03 nationality）

| ID | 类型 | 主题 | 文件（目标） |
| --- | --- | --- | --- |
| TC-M11-38-01 | Unit | `register-validation`：非法 nationality → `play.errors.nationality_invalid` | `tests/register-validation.test.ts` |
| TC-M11-38-02 | Unit | 合法 alpha-3（`CHN`）通过客户端校验 | 同上 |
| TC-M11-38-03 | Integration | `POST /api/auth/register` body 含 `nationality: "CHN"` → DB 持久化 | `tests/api-register.test.ts` |
| TC-M11-38-04 | Integration | `GET/PUT /api/profile/personal` 读写 `nationality` | `tests/api-profile.test.ts` |
| TC-M11-38-05 | Component | 注册页渲染 `data-testid="register-nationality"` select | `tests/register-page.test.tsx`（若存在）或 E2E |
| TC-M11-38-06 | i18n | `play.register.nationality` / `play.profile.nationality` 四 locale 存在 | `tests/i18n-catalog.test.ts` |

#### TC-M11-38-E2E（Playwright，MVP-11 签收）

| ID | 步骤摘要 |
| --- | --- |
| TC-M11-38-E2E-01 | 注册选国籍 CHN → 登录 → 资料页仍为 CHN → 改 USA → 保存 → 刷新仍为 USA |
| TC-M11-38-E2E-02 | 注册跳过国籍 → DB null → 资料页显示「请选择」 |

#### TC-M11-39（plan-47 spec placeholder）

| ID | 类型 | 主题 |
| --- | --- | --- |
| TC-M11-39-01 | 文档 | `[2play-design.md](./2play-design.md)` §3.5.6 含 BFF 契约与 i18n key 列表 |
| TC-M11-39-02 | Mock | `ui-mockup/10-travel-advice.html` 含 `.visa-advice` 区块 |

#### TC-M17（MVP-17 P0–P2 必去地单一源 + fill 契约）

绑定 2play Feature 37 AC13b · agent Feature 67/69。Lisbon UI E2E 属 P5，本切片不做。

| ID | 类型 | 主题 | 文件（目标） |
| --- | --- | --- | --- |
| TC-M17-ICONIC-01 | Unit | iconic helper 写 tips 后读 artifacts，不把 HTTP 体当 UI | `tests/plan-iconic.test.ts` |
| TC-M17-ICONIC-02 | Unit | 助手建议名单与 tips `iconic_places` 同序 | `src/core/plan-iconic.ts` / plan-page 测 |
| TC-M17-FILL-01 | Unit | `tripLedgerFields` 省略 null revision；fill 归一化 `end_time` | `tests/plan-agent-body.make-itinerary.test.ts` / `plan-skeleton-fill.test.ts` |
| TC-M17-I18N-01 | Unit | `play.errors.invalid_input` 四 locale 存在 | catalog / i18n 测 |

#### TC-M18（MVP-18 主干：fetch / 默认 / 时刻 / 预览）

绑定 Feature 37 AC8c / AC13c / AC24–AC27 · agent F71/F72/F75–F77。

| ID | 类型 | 主题 | 文件（目标） | 状态 |
| --- | --- | --- | --- | --- |
| TC-M18-71-01 | Component | 起飞预算默认 `mid`；顶栏无 `comfort` 英文键 | `tests/plan-page.test.tsx` | Done |
| TC-M18-75-01 | Unit | 规划编排在 make/plan_next_stop 成功后调用 `fetchTripDetails` | `tests/plan-skeleton-fill.test.ts` | Done |
| TC-M18-75-02 | Unit | 步骤 g 芯片来自 discover fetch `must_see`，不读 intake travel_tips | `tests/plan-page.test.tsx` / `plan-iconic-parse.test.ts` | Done |
| TC-M18-75-03 | Unit | CTA `POST /api/plan/discover` 写后 fetch candidates | `tests/plan-start-discover.test.ts` | Done |
| TC-M18-75-04 | Unit | 有 trip_id 则跳过二次 discover；travelTips 在 make 与 skeleton_done 之后 | `tests/plan-skeleton-fill.test.ts` | Done |
| TC-M18-76-01 | Unit | 贴士四卡绑定 fetch artifacts，visa 卡不绑 visa HTTP | plan-page / travel-tips 测 | Done |
| TC-M18-77-01 | Unit | intake `7:00 am` → `07:00` | `tests/plan-intake.test.ts` | Done |
| TC-M18-72-01 | Unit | 骨架预览折叠重复酒店 stay | `tests/plan-skeleton-preview.test.ts` | Done |

#### TC-M19（MVP-19：正交必去 + 骨架叙事 + 超时恢复）

绑定 Feature 37 AC28–AC34 · Feature **40** · agent F78–F82。

| ID | 类型 | 主题 | 文件（目标） | 状态 |
| --- | --- | --- | --- | --- |
| TC-M19-40-01 | Unit | 芯片 must_see 与 mustInclude 分列；3 处不覆盖 8 处 | `tests/plan-intake.test.ts` | **Done** |
| TC-M19-40-02 | Unit | make 失败后 fetch 有骨架则续 fill | `tests/plan-skeleton-fill.test.ts` | **Done** |
| TC-M19-40-03 | Component | 助手顺序：know_enough → 骨架文 → skeleton_ready → fill 行 | `tests/plan-page.test.tsx` | **Done** |
| TC-M19-40-04 | Component | filling 主区同时有 skeletonStops 与 stay，非仅酒店 | `tests/plan-skeleton-stops.test.ts` / plan-page | **Done** |
| TC-M19-40-05 | Unit | PlanSessionCache / current 含 trip_id | `tests/api-plan.test.ts` | **Done** |
| TC-M19-40-06 | i18n | §4.6 叙事 key 四 locale | `tests/i18n-catalog.test.ts` | **Done** |
| TC-M19-40-E2E | E2E | 里斯本 3 日：助手见多日骨架后再出 slot；芯片≠仅用户 2 处 | Playwright | **ToDo** |

#### TC-M20（MVP-20：Plan 页重建 Feature 41）

绑定 Feature **41**。Story 2 = TC-M20-41-10–15。Story 4 = TC-M20-41-16–20。TC-M19-40-03/04（fill 叙事）**保持跳过**至 fill 故事。

| ID | 类型 | 主题 | 文件（目标） | 状态 |
| --- | --- | --- | --- | --- |
| TC-M20-41-01 | Component | CTA 后打开 `plan-nav`，隐藏起飞栏，不问 `POST /api/plan` | `tests/plan-page.test.tsx` | **Done** |
| TC-M20-41-02 | Component | 约束条起飞 5 项有值；7 项 pending=`constraint_pending` | `tests/plan-page.test.tsx` / `plan-constraints.test.tsx` | **Done** |
| TC-M20-41-03 | Unit | 未答 g 时必去格不用 `suggestedMustSee` | `tests/plan-intake.test.ts` | **Done** |
| TC-M20-41-04 | Component | CTA 后无搜点句、无 chips、无 tips、不问 make；**允许**静默 discover | `tests/plan-page.test.tsx` | **Done** |
| TC-M20-41-05 | i18n | `play.plan.constraint_pending` 四 locale | `tests/i18n-catalog.test.ts` | **Done** |
| TC-M20-41-10 | Unit | discover 池内热度打标，must_see ≤ max_number；不二次搜点 | agent `discover-places.test.ts` | **Done** |
| TC-M20-41-11 | Unit | startPlanDiscover 传 max_number=5；返回 pool；芯片 ≤5 | `tests/plan-start-discover.test.ts` | **Done** |
| TC-M20-41-12 | Component | g 等池；芯片来自 `POST /api/plan/candidates`（fetch_trip_details） | `tests/plan-page.test.tsx` | **Done** |
| TC-M20-41-13 | Component | 每答一题约束格回填；PATCH session | `tests/plan-page.test.tsx` | **Done** |
| TC-M20-41-14 | Component | intake 完无 debug dump；Story 4 接 make-only | `tests/plan-page.test.tsx` | **Story 4** |
| TC-M20-41-15 | i18n | know_enough 四 locale | `tests/i18n-catalog.test.ts` | **Done** |
| TC-M20-41-16 | Unit | make-only 路径：make 后 fetch skeleton；不调用 plan_next_stop | `tests/plan-skeleton-only.test.ts` | **Story 4** |
| TC-M20-41-17 | Unit | stay-only / make 失败 → error；不产出成功骨架 | `tests/plan-skeleton-only.test.ts` | **Story 4** |
| TC-M20-41-18 | Component | 进度 elapsed 0.1s；超时/失败 i18n | `tests/plan-page.test.tsx` | **Story 4** |
| TC-M20-41-19 | Component | headline + thread 骨架卡来自 fetch 切片 | `tests/plan-page.test.tsx` | **Story 4** |
| TC-M20-41-20 | i18n | planning / headline / elapsed / make 失败 四 locale | `tests/i18n-catalog.test.ts` | **Story 4** |
| TC-M21-41-21 | Unit | 空 b 不 search；非空命中 80km；未命中 not_found；禁无城市 geocode | `tests/plan-resolve-origin.test.ts` | **Done** |
| TC-M21-41-22 | Unit/API | PATCH b 未命中 422；忽略空 b 前进；make origin 不二次无城市 geocode | `tests/plan-skeleton-only.test.ts` / session | **Done** |
| TC-M21-41-23 | i18n | `intake_origin_not_found` / retry / skip 四 locale | `tests/i18n-catalog.test.ts` | **Done** |

---

## §11 与 mock / 设计抽检

| 抽检项 | 方法 |
| --- | --- |
| Plan 双行栅格 / Discover 同态 slot / Arrange `slot_preview`→`slot` / pending skeleton | E2E screenshot 或 `data-testid` 断言对照 accepted mock |
| Primary = glaze | 视觉 / computed style 抽检 |
| 无 FAB | DOM 无全局 chat FAB |
| Profile 单卡 + 兴趣标签 | E2E 文案/testid |

视觉真源：[`ui-mockup/`](./ui-mockup/)；契约：[`2play-design.md`](./2play-design.md) §3.9。
