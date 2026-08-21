# where2play — 测试计划

在 workspace **common-test-strategy** 基线上扩展 where2play 增量规则。不降低金字塔层级、不跳过 auth 测试、不削弱质量检查清单。格式对齐 what2eat [`2eat-test-plan.md`](../../2.what2eat/2eat-specs/2eat-test-plan.md)。

| 绑定 | 位置 |
| --- | --- |
| 基线 | `common-test-strategy`（always-on rule） |
| 产品规格 | [`2play-prod-specs.md`](./2play-prod-specs.md) |
| 用户故事 | [`2play-stories.md`](./2play-stories.md) |
| 设计 | [`2play-design.md`](./2play-design.md) |
| UI mock | [`ui-mockup/`](./ui-mockup/) |
| places-agent 测试 | [`../../1.places-agent/agent-specs/4.test-strategy.md`](../../1.places-agent/agent-specs/4.test-strategy.md) |
| Agent 行程用例 | [`../../1.places-agent/agent-specs/agent-stories.md`](../../1.places-agent/agent-specs/agent-stories.md)（`plan_itinerary`） |
| ADR itinerary | [ADR-008](../../workspace-specs/adr/ADR-008-itinerary-ownership.md) |
| ADR live | [ADR-021](../../workspace-specs/adr/ADR-021-live-vendor-no-fixture.md) |
| ADR HTTP chat | [ADR-020](../../workspace-specs/adr/ADR-020-http-only-chat-and-enrich.md) |

**状态：** draft — §3 MVP DoD 为交付门禁；MVP-1 质量门命令：`make quality`（`lint` + `test-coverage` + `test-e2e-mvp1`）。

---

## §1 与 common-test-strategy 的关系

| 增量 | 规则 |
| --- | --- |
| Thin client | Plan、配图、地图链接、chat 须经 BFF HTTP 到达 places-agent；浏览器不持有 caller key / map key / LLM key |
| 不编造行程 | BFF 不得在 agent 空/失败时返回 canned 景点名或假时段 |
| Live honesty（ADR-021） | MVP-2+ DoD：live vendor；签收探针无 `fixture_` native id |
| Chat 双存储 | **草稿**仅 browser localStorage；**已保存快照**仅在用户点「保存」后入 DB；契约测试：未保存路径 DB **无**逐轮 chat INSERT |
| Chat 传输 | BFF → `POST /v1/chat`（ADR-020）；浏览器不调 MCP |
| 单行程 | Plan 主路径每次只交付**一条**行程；禁止用多卡短名单冒充主交付 |
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

### MVP-2 — 真实 Plan + 保存

| 门禁 | 要求 |
| --- | --- |
| 功能 | Live 边界 → **一条** Day/Hour → 保存（`messages` 可 `[]`）→ 我的行程多卡 → 打开详情；无未保存 History |
| 测试 | `make test` + **`make test-e2e-mvp2-live`** |
| Live | ADR-021 探针通过；更新诚实性矩阵 |
| 质量 | 不编造场所；地图/详情链接无 secret；单行程 |
| 用户 | 在 **live 目的地** 上确认可用性 |
| Retrospective | 附探针目的地 + 样例 itinerary JSON（无密钥） |

### MVP-3 — Chat 双存储

| 门禁 | 要求 |
| --- | --- |
| 功能 | Plan 页内 Chat 真实 agent 回复并可随动改行程；local 草稿；保存提交 DB；详情只读快照；登出清 local |
| 测试 | `make test` + **`make test-e2e-mvp3-live`** |
| Chat 存储 | 未保存：仅 localStorage；保存后：DB 有快照行；E2E 验证两边 |
| 质量 | 无 FAB 第二入口；回复标为建议；非票务权威 |
| 用户 | 明确可用性确认 |
| Retrospective | lessons + 若有 ADR（chat commit） |

### MVP-4 — Replan + PDF + Chat 高度

| 门禁 | 要求 |
| --- | --- |
| 功能 | Replan 确认对话框；新行程；local chat 保留 + 分隔泡；PDF；chat 仅高度 resize |
| 测试 | `make test` + **`make test-e2e-mvp4-live`** |
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
| U-04 | `interest-map` | Profile chips ↔ Plan `data-interest` 枚举双向映射 |
| U-05 | `itinerary-map` | agent timed days/blocks → `ItineraryDto` slots（transit/place） |
| U-06 | `itinerary-map` | 缺失 photo → omit；不填假 URL |
| U-07 | `chat-truncate` | 超长 transcript 截断保留尾部 + system 分隔后上下文 |
| U-08 | `local-draft` | save/load `w2p.chat.draft`；logout clear |
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
| C-06 | `POST /api/plan` | 注入 `plan_itinerary` → 一条 itinerary；写 PlanSessionCache |
| C-07 | `POST /api/plan` agent 失败 | 5xx/4xx 诚实错误；**无** canned 行程 |
| C-08 | `GET /api/plan/current` | 返回未过期 cache |
| C-09 | `POST /api/saved` | 行程入库；MVP-2 允许 `messages: []`；返回 id |
| C-10 | 保存前查 chat 表 | 无「仅聊天」产生的行 |
| C-11 | `GET /api/itineraries/[id]` | 含 DB messages；越权 404 |
| C-12 | `DELETE /api/saved/[id]` | 列表不再包含 |
| C-13 | `POST /api/chat` | 转发 `/v1/chat`；可选返回 patched itinerary |
| C-14 | `POST /api/plan/replan` | 新 itinerary；请求含截断 messages |
| C-15 | `GET .../export` | `content-type: application/pdf`；body 非空 |
| C-16 | `POST /api/geocode/reverse` | 注入成功/失败路径 |

### 5.3 Feature ↔ 测试落点（实现后填路径）

| Feature / MVP | 单元/契约（计划） | E2E（计划） | Makefile（计划） |
| --- | --- | --- | --- |
| **MVP-1** auth/profile/shell | `auth-*`, `profile-*`, `locale`, `i18n`, `register-validation`, `csrf` | `e2e/test_mvp1.py`, login_failed, reset_set, register_errors | `make test`, `make test-e2e-mvp1` |
| **MVP-2** plan/saved | `plan-*`, `itinerary-map`, `saved`, `plan-current` | `e2e/test_mvp2_live.py` | `make test-e2e-mvp2-live` |
| **MVP-3** chat commit | `chat-*`, `local-draft`, `commit` | `e2e/test_mvp3_live.py` | `make test-e2e-mvp3-live` |
| **MVP-4** replan/pdf/resize | `replan`, `pdf-build`, chat-resize | `e2e/test_mvp4_live.py` | `make test-e2e-mvp4-live` |

---

## §6 关键 E2E 旅程步骤

| 旅程 | MVP | 步骤摘要 |
| --- | --- | --- |
| 注册 → profile（兴趣）→ 登出 → 登录 → profile 仍在 | MVP-1 | 含 EN→CN locale；family footer；必填 `*` |
| 注册：性别可跳过 | MVP-1 | 不选具体性别仍可注册 |
| 登录失败提示 | MVP-1 | |
| 重置/设置密码 | MVP-1 | 无 URL 泄露 password |
| 登录 → Plan 填边界 → 生成 → **一条**行程 Day/Hour → 保存 → 我的行程卡 → 打开详情 | MVP-2 | live；无 `fixture_` |
| Plan 校验：空目的地 / 非法天数 | MVP-2 | 字段错误可见 |
| Open map / 详情 URL 无 API key | MVP-2 | 新标签 |
| 兴趣预填 Plan chips | MVP-2 | profile-01 → plan-05 |
| Combo 打开见全部选项 | MVP-2 | plan-06 |
| 空 Saved 态 | MVP-2 | 引导去规划 |
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
| `make test-e2e-mvp2-live` | MVP-2 DoD | 双服 live；诚实断言 |
| `make test-e2e-mvp3-live` | MVP-3 DoD | chat 双存储 live |
| `make test-e2e-mvp4-live` | MVP-4 DoD | replan + PDF + resize |
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
| Plan → 单行程 | `plan_itinerary` | 注入 HTTP | `test-e2e-mvp2-live` | MVP-2 | — |
| Slot 配图 / mapUrl | agent sources | 注入 | 同上 | MVP-2 | — |
| Save / unsave | App DB | Vitest + E2E | live 旅程 | MVP-2 | — |
| Plan chat | `POST /v1/chat` | 注入 | `test-e2e-mvp3-live` | MVP-3 | — |
| Chat commit on save | App DB | 契约：保存前后行数 | 同上 | MVP-3 | — |
| Saved detail read-only chat | App DB | Vitest + E2E | 同上 | MVP-3 | — |
| Reload hydrate (`/api/plan/current`) | PlanSessionCache | 契约 | MVP-2/3 | MVP-2 | — |
| Replan + divider | plan + chat | 单元 + E2E | `test-e2e-mvp4-live` | MVP-4 | — |
| PDF export | DTO → PDF | 契约 content-type | 同上 | MVP-4 | — |
| Chat height resize | 组件 + Playwright | min height | 同上 | MVP-4 | — |

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
| Plan、saved | 单测 + BFF + Playwright | MVP-2：**是** |
| Chat 草稿 / 提交 | 集成 + Playwright | MVP-3：**是** |
| Replan、PDF、resize | 集成 + Playwright | MVP-4：**是** |

---

## §10 失败处理

修生产代码或错误测试；不得删/ skip AC 测试换绿。反模式：硬编码行程、仅用单测签 MVP-2、把每轮 chat 写入 DB、把 `make test` fixture 绿当作 live 诚实、用 mockup HTML 冒充产品 DoD。

---

## §11 与 mock / 设计抽检

| 抽检项 | 方法 |
| --- | --- |
| Plan 三列板 / slot 时间列对齐 | E2E screenshot 或布局断言对照 mock |
| Primary = glaze | 视觉 / computed style 抽检 |
| 无 FAB | DOM 无全局 chat FAB |
| Profile 单卡 + 兴趣标签 | E2E 文案/testid |

视觉真源：[`ui-mockup/`](./ui-mockup/)；契约：[`2play-design.md`](./2play-design.md) §3.9。
