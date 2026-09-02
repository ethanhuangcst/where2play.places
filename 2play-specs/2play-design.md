# where2play — 设计规范

**where2play**（`where2play.place`）视觉、技术架构与页面契约。产品边界见 [`2play-prod-specs.md`](./2play-prod-specs.md)；用户故事与 AC 见 [`2play-stories.md`](./2play-stories.md)；测试与质量门见 [`2play-test-plan.md`](./2play-test-plan.md)；部署见 [`6.deployment-plan.md`](./6.deployment-plan.md)。家族架构见 [`../../workspace-specs/2.architecture.md`](../../workspace-specs/2.architecture.md)；行程引擎 [ADR-008](../../workspace-specs/adr/ADR-008-itinerary-ownership.md)。格式与深度对齐 what2eat [`2eat-design.md`](../../2.what2eat/2eat-specs/2eat-design.md)。

**技术栈：** 与 what2eat 同族 thin client。实现目录 `3.where2play/`。本地 **PORT=3030**；生产 `where2play.place`（宿主机 `3005→3000`）。

**冲突优先级：** 与 [`ui-mockup/`](./ui-mockup/) + [`assets/mockup.css`](./ui-mockup/assets/mockup.css) 冲突时，**以 mock 为准**。实现真实页面须与本文件 §1 / §3 及对应 HTML **视觉与结构 100% 一致**（文案走 i18n key，源语言参考 mock 中文/英文）。

**可执行 mock：** [`ui-mockup/index.html`](./ui-mockup/index.html)。`index.html` 为评审画廊，非产品路由。

**MVP-10 视觉：** App 与 Auth mock 以 **Travor**（§4.7）为准；§1.2 天空蓝 token 仅作历史 as-built 参考。

---

## §1 视觉与交互

### 1.1 产品气质

**晴空桌布 · 登机牌行程。** 与 what2eat 同族「釉绿 + 桌布」，底色偏**淡天空蓝**（`--cloth-b: #eef6fb`），不是奶油陶土、不是紫渐变、不是黑底 acid。个性集中在：**飞机 mark + 机翼下尾迹羽流** + **登机牌 Day tab** + **时刻表 Hour 行**。

| 应当 | 禁止 |
| --- | --- |
| 2eat 同族 glaze 主按钮、Figtree/Fredoka/獅尾腿圓、淡天空蓝桌布格 | 阴冷雾蓝洗底、页面色块渐变、芥末黄主按钮（旧稿）、紫渐变、黑底 acid |
| Logo：机翼下**短羽流尾迹**，动画基线约 **−11deg**，与机身同向 | 机尾长 contrail；水平「拉风」三线；尾迹与机身脱节 |
| Plan：紧凑三列板、无「规划器/去哪里」分区大标题 | 大段说明占高；一次多行程短名单卡 |
| 行程：Highlights + `HH:MM–HH:MM` + 交通段 + 缩略图左对齐时间列 | 只有单点时刻、无亮点、无交通、缩略图错位 |
| Chat：页内嵌、SE 高度把手；非 FAB | 双 Chat / 全局 FAB |
| 空态/错误说明该改什么 | 模糊道歉、整页空白 |

### 1.2 Design tokens（与 `mockup.css` `:root` 一致）

```css
--cloth-a: #dcefe6;
--cloth-b: #eef6fb;          /* 淡天空蓝桌布底 */
--ink: #243832;
--ink-2: #3a524c;
--mute: #5c726b;
--glaze: #2a7a68;            /* Primary CTA */
--glaze-deep: #1f5c4f;
--zest: #e9a825;
--zest-deep: #c48a12;
--blossom: #f4c4ce;
--plate: #fffdf8;
--line: #c9ddd4;
--stub: #f8e8c4;
--sky: #e2eef6;
--sky-mid: #2a7a68;          /* = glaze */
--sky-deep: #1f5c4f;         /* = glaze-deep */
--mustard: var(--zest);      /* 仅 chip/active 点缀，非主按钮 */
--mustard-deep: var(--zest-deep);
--leaf: var(--glaze);
--cloud: var(--cloth-b);
--alert: #b6542a;
--danger: #9b2c2c;
--ok: #2a7a68;

--radius-bowl: 1.75rem;
--radius-control: 0.85rem;
--radius-chip: 999px;
--control-h: 2.75rem;
--header-control-h: 2.15rem;
--chat-min-h: 20rem;
--chat-h: 28rem;
--max-home: 28rem;
--max-auth: 26rem;
--max-register-card: 32rem;  /* 注册 / 个人信息单列卡 */
--max-app: 72rem;
--header-h: 3.75rem;
--plan-col: 9rem;            /* Plan 左两列固定宽；Hour 时间列同宽 */
--plan-gap: 0.85rem;

--font-display: "Fredoka", system-ui, sans-serif;
--font-ui: "Figtree", system-ui, sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, monospace;
```

| Locale | 字体覆盖 |
| --- | --- |
| `zh-CN` | display/ui → **獅尾腿圓簡體** |
| `zh-HK` / `zh-TW` | display/ui → **獅尾腿圓繁體** |
| `logo-word` | 始终 Fredoka（拉丁品牌字） |

**背景：** 公开与 App 均为桌布格（`--cloth-b` 底 + 细格线），**无整页色块渐变**。

### 1.3 Logo 与机翼尾迹

```html
<span class="mark-host mark-host--plane">
  <svg class="wing-trail" viewBox="0 0 18 10" fill="none" aria-hidden="true">
    <path d="M17 2.2c-3.2.9-6.5 2.2-10 3.6C4.2 6.8 2.2 7.6 1 8.2" />
  </svg>
  <img class="mark mark--plane" src="assets/play-logo.png" alt="" />
</span>
```

| 规则 | 值 |
| --- | --- |
| 位置 | 机翼/机腹下方短羽流（非机尾长迹） |
| path | 上表 SVG `d`（实现不得换旧三线/长 contrail） |
| 动画 | `plane-cruise` + 尾迹同相位；尾迹关键帧 **rotate(−11deg)** |
| 尺寸 | Home mark **72**；App header **40** |
| Reduced motion | 关闭 plane / wing-trail 循环 |

**已废弃：** `plane-trail`、水平拉风、与机身脱节的尾迹。

### 1.4 Shell 与导航

| Shell | 路由 | Chrome |
| --- | --- | --- |
| 公开首页 | `/` | 居中列 `--max-home`；无 app nav；CTA → register / login |
| Auth 窄卡 | `/login` · `/reset-password` · `/set-password` | `--max-auth`；logo 在卡内 |
| Auth 注册 | `/register` | `--max-register-card`；顶栏 logo + locale |
| App | `/plan` · `/saved` · `/profile` · `/saved/[id]` | Sticky header；`--max-app` 内轨 |

**App 导航顺序（固定）：** 行程规划 → 我的行程 → 个人信息  
**i18n keys：** `play.nav.plan` · `play.nav.saved` · `play.nav.profile`  
**源文案（CN）：** 行程规划 / 我的行程 / 个人信息  

**Active：** 浅底 + 底部 glaze/stub 指示（见 mock `.app-nav a.is-active`）。

**Header 结构：** 通栏 `.app-header` + 内轨 `.app-header__inner`（与 `.app-main` 同宽 `--max-app` + 两侧边距，对齐 2eat）。内容：logo（尾迹）· Menu（窄屏，`data-testid="nav-menu"`）· nav · `你好，` + avatar + 名 · locale（四等分）· 登出（quiet，与 locale 同高 `--header-control-h`）。

**中文权重：** `html[lang^="zh"]` 下 nav / 标题字重 **400**（獅尾腿圓）；字号与 2eat 对齐（nav ≈17px 根；`.page-title` ≈ `2.05rem`）。

### 1.5 places.family footer

```text
places.family:  [logo] where2play.place  ·  [logo] what2eat.food  ·  [logo] places.agent-mate.ai     copyright © Ethan Huang
```

| 规则 | 说明 |
| --- | --- |
| 轨宽 | `--max-app`；三列栅格：中间居中家族链，右列 copyright 右对齐 |
| 当前产品 | where2play.place **非链接** |
| 姊妹 | 下划线；`target="_blank"` + `rel="noopener noreferrer"` |
| 拉丁字号 | **12px**（换 locale 不改 mark 尺寸） |
| App 页 | `.family-footer--app`（与 header 同底纹） |

### 1.6 组件

| 组件 | 规格 |
| --- | --- |
| Primary btn | **glaze** → hover **glaze-deep**（非 mustard） |
| Quiet | plate + line；登出同高 header control |
| Danger | danger 描边（重新规划、取消收藏） |
| Field | `--control-h`；invalid：`.field.is-invalid` + `.field-error` + `role="alert"` |
| Required | 注册：`label.is-required::after` → `" *"`（`--danger`）；Plan：标签旁 `<span class="req">*</span>`（`--alert`） |
| Chip | pill；`.is-on` 用 sky/glaze 浅底 |
| Panel | `--radius-bowl`；`.panel__head` / `.panel__body` padding **`1.1rem 1.15rem`** |
| Combo | 可编辑 + 黑三角 toggle；展开时**始终列出全部选项**（不按输入过滤） |
| Day tab | 登机牌票根形；选中 stub + 强调边 |
| Slot / Hour | 时间列宽 = `--plan-col`；缩略图填满行高；右列「详情｜地图」外链新标签 |
| Chat | 内嵌；user 右 / agent 左；system 居中虚线（replan 分隔）；SE 把手仅调高 |
| Trip card | 封面 + 标题 + meta；hover 上浮 ≈3px |
| Dialog | `role="alertdialog"`；遮罩；Escape / 取消关闭 |

### 1.7 动效与 a11y

- Logo 巡航 + 尾迹；卡 hover `0.18s`；`prefers-reduced-motion: reduce` 关闭循环动画。
- Skip link、`focus-visible`（glaze/sky-deep outline）、触摸目标 ≥44px；状态不单靠颜色。
- 全部用户可见字符串为 **i18n key**；locale `EN` / `CN` / `HK` / `TW`。协议 id / provider 名不翻译。

---

## §2 技术架构与详细设计

### 2.1 目标与非目标

| 目标 | 非目标 |
| --- | --- |
| Thin client + 同源 BFF；主路径 **一条**行程；规划经 ADR-032 拆分：**discover（agent）→ arrange L2（本应用 OPENAI_CN，[ADR-037](../../workspace-specs/adr/ADR-037-where2play-plan-l2-quanzil.md)）** | 一次多行程短名单；浏览器 MCP / map key / LLM key；chip 条作为候选主展示 |
| Plan 单页 + 单一 Chat + 底栏 | 双 Chat / FAB 全局 Chat |
| Chat：local 草稿 + **保存时** DB 快照 | 每轮 chat 写库；未保存跨设备同步 |
| 我的行程多卡读 DB | MVP 未保存 History 列表 |
| 四 locale 独立 catalog；账号独立 | 与 what2eat SSO；OpenCC；HK↔TW 共文件 |
| BFF → places-agent（**仅**地图 discover / search / geocode / navigate）；**初排 L2 + 行程助手** BFF → 本应用 OPENAI_CN（[ADR-036](../../workspace-specs/adr/ADR-036-where2play-assistant-quanzil.md)、[ADR-037](../../workspace-specs/adr/ADR-037-where2play-plan-l2-quanzil.md)） | 初排 L2 默认再调 agent `arrange_day`/`plan_itinerary`；浏览器直连 OPENAI_CN / map vendors |

```text
Browser → where2play /api/*
  ├─ /api/plan* → BFF：agent discover_places → 本应用 OPENAI_CN arrange×N（NDJSON）
  ├─ search/geocode 类 → places-agent /v1/*
  └─ /api/chat → where2play BFF → OPENAI_CN（流式）；可选再调 agent search_*
Browser localStorage ← w2p.chat.draft | w2p.chat.itinerary.{id}
App DB ← User, InterestProfile, SavedItinerary + ItineraryChatMessage (commit only)
           (+ optional PlanSessionCache for refresh hydrate)
```

**LLM 决策（[ADR-036](../../workspace-specs/adr/ADR-036-where2play-assistant-quanzil.md) + [ADR-037](../../workspace-specs/adr/ADR-037-where2play-plan-l2-quanzil.md)）：**

| 能力 | 谁调 LLM / 引擎 |
| --- | --- |
| **初排 / 重新规划 L1** | places-agent `discover_places`（地图，无 LLM） |
| **初排 / 重新规划 L2** | **where2play BFF 本应用 OPENAI_CN（gpt-5.4）** 按天排程；密钥仅服务端 |
| **行程助手**（页内 Chat） | **同一产品 OPENAI_CN**，流式回复 + patch |
| 地图 search / geocode / navigate | 仍 places-agent（2play **不含** `AMAP_*` / `GOOGLE_MAPS_*`） |

助手小改：流式 `reply` + `itineraryPatch`（或完整 `itinerary`）更新中部时间轴。**禁止**助手默认触发整单 `plan_itinerary`；整单重做走 `/api/plan/replan`（同 §2.4.1：discover + BFF OPENAI_CN arrange）。what2eat 默认仍经 agent chat，除非另开 ADR。

职责划分详见 [`2play-prod-specs.md`](./2play-prod-specs.md) 与 [`../../workspace-specs/2.architecture.md`](../../workspace-specs/2.architecture.md)。行程**候选与地图**归属 [ADR-008](../../workspace-specs/adr/ADR-008-itinerary-ownership.md) / agent；**2play 产品排程 L2 + 助手对话**见 ADR-036/037。

### 2.2 技术栈

与家族锁定版本一致：[`../../workspace-specs/3.tech-specs.md`](../../workspace-specs/3.tech-specs.md)。实现目录 `3.where2play/`。

| 类别 | 选型 |
| --- | --- |
| Next.js App Router 16.3 · React 19.2 · TS 7.0 | 页面 + BFF Route Handlers |
| Tailwind 4.3 · TanStack Query · Zustand · RHF + Zod | UI、服务器状态、客户端草稿、表单 |
| Prisma + **PostgreSQL** | 用户、兴趣、已保存行程、提交时 chat（[ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md)；库名 `where2play`） |
| Resend | 重置密码邮件 |
| PDF | 服务端生成（优先 `pdf-lib` 或轻量 HTML→PDF；**不**在浏览器拼 vendor 密钥） |
| Vitest + Python Playwright | 单测/契约 + E2E |
| places-agent `fetch` 客户端 | **L1 discover** / 地图；**L2 + 助手** 用产品 OPENAI_CN（ADR-036/037） |

入口：`next dev` / standalone `node server.js`（同 what2eat）。

**本地：** `PORT=3030` · `PUBLIC_BASE_URL=http://localhost:3030` · `PLACES_AGENT_BASE_URL=http://localhost:3010`。  
**Postgres（[ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md)）：** 本地 `postgresql://where2play:where2play@localhost:5435/where2play`；生产 Aliyun `…@101.132.156.250:5432/where2play`；测试库 `where2play_test`。

### 2.3 BFF 路由表

| 路径 | 方法 | 职责 |
| --- | --- | --- |
| `/api/auth/register` | POST | 注册（含可选兴趣、**nationality?** MVP-11） |
| `/api/auth/login` | POST | 登录 |
| `/api/auth/logout` | POST | 登出；客户端清 `w2p.chat.*` |
| `/api/auth/reset-password` | POST | 发重置邮件 |
| `/api/auth/set-password` | POST | 凭 token 设新密码 |
| `/api/profile/personal` | GET/PUT | 个人信息 + **出行兴趣** + **nationality?**（单卡一次保存） |
| `/api/plan` | POST | 边界 → agent **discover** + **BFF OPENAI_CN arrange×N**（NDJSON，见 §2.4.1 / ADR-037）；JSON 兼容返回最终 `ItineraryDto` |
| `/api/plan/current` | GET | 读取未过期 PlanSessionCache（刷新恢复中部行程 + 表单 criteria） |
| `/api/plan/replan` | POST | 新一条（同 §2.4.1 编排）；body 含截断 chat 上下文；**不**清 local transcript |
| `/api/chat` | POST | 行程助手：BFF → **本应用 OPENAI_CN 流式**；可选 agent `search_*`；返回 assistant + `itineraryPatch`/`itinerary`（[ADR-036](../../workspace-specs/adr/ADR-036-where2play-assistant-quanzil.md)） |
| `/api/saved` | GET | 已保存行程卡列表 |
| `/api/saved` | POST | **提交点**：行程快照 + messages[] → DB |
| `/api/saved/[id]` | DELETE | 取消收藏 |
| `/api/itineraries/[id]` | GET | 详情 + DB chat（只读） |
| `/api/itineraries/[id]/export` | GET | PDF（`application/pdf`） |
| `/api/geocode/reverse` | POST | 反向 geocode（出发地） |
| `/api/travel-advice/visa` | GET | **（MVP-11 后续）** 读 session nationality + query destination → agent `/v1/visa_requirement` |

**横切：** Mutating 路由 = session cookie + CSRF（对齐 what2eat）。Caller key **仅**服务端 env。未认证访问 App `/api/plan|saved|…` → `401`。

### 2.4 Plan / Replan / Chat 流程

#### 2.4.1 生成行程（`POST /api/plan`）— ADR-037

**Progressive UX 与四段 UI（行程日提示 / 行程细节提示 / 行程 / 加载中提示）专项设计：** [`itinerary-design.md`](./itinerary-design.md)。

对齐 [ADR-032](../../workspace-specs/adr/ADR-032-llm-itinerary-mcp-tool-split.md)：**先发现、再按天安排**。where2play 负责 progressive UX 与 **L2 OPENAI_CN**；places-agent 提供 **L1** `discover_places`（HTTP 可 NDJSON）。**主路径不再**调用 agent `arrange_day` / 整单 `plan_itinerary`（[ADR-037](../../workspace-specs/adr/ADR-037-where2play-plan-l2-quanzil.md)）。

```text
1. requireUser + CSRF
2. Zod 校验 PlanBoundaries（目的地*、天数* 1–14、起始日期* `YYYY-MM-DD`；可选人数/类型/预算/节奏/交通/起终点/时段/兴趣/限制）
3. 读 InterestProfile（若表单未带兴趣，可用作默认 chips）
4. providers[]: caller-driven（大陆倾向 ["AMAP","GOOGLE_MAPS"]；海外 ["GOOGLE_MAPS"]；ADR-005）
5. Phase Discover — POST places-agent /v1/discover_places（numDays = N；locale；city；bounds 自 startDate）
     - Accept: application/x-ndjson → 每找到一个 POI 推一条 candidate
     - BFF 转发给浏览器：同态 slot 预览（见 §3.5.2 / §3.5.5）
6. Phase Arrange — 对 dayIndex = 1…N（**逐条 slot** 揭示，见 [`itinerary-design.md`](./itinerary-design.md)）：
     - 发 `phase` arranging（含 dayIndex / daysTotal）→ **行程日提示**
     - 发 `arrange_day_start`（预建 Day tabs；`poolTotal`/`usedCount` 可保留作调试，**不作** UI 主文案）
     - **BFF 本应用 OPENAI_CN**：slim 候选（每池最多约 16）+ 日约束 → 结构化单日 blocks（P0：`stream: false` 等满日 JSON 后解析；P2：流式增量 parse）
     - **Prompt 来源（as-built）：** agent `POST /v1/arrange_day` `execution=host`（Feature **35**）；本地 `buildArrangeDayMessages` **仅单测**
     - **交通（as-built）：** `POST /v1/enrich_arrange_transit` → `legs_to_here`（Feature **37**）
     - 发 `day_highlights`（优先用模型 `theme`）→ Highlights 骨架
     - 对每条落地站：发 `slot_preview`（kind=place|transit|meal）→ **行程细节提示**；再发 `slot`（`place` 为 deprecated alias）→ **行程** +1；下一条前 **加载中提示** `.slot--pending` 同构 skeleton
     - **不**默认 POST agent `/v1/arrange_day` **execution=agent**（ChatBox MCP 强制 agent 见 ADR-043；2play 仍 Mode H）
     - `day_done` / `progress`；自动切下一 Day tab（未排日 `· 排队`）
7. `done` → 最终 ItineraryDto；头栏 Updated；**不得**在失败时返回 canned 景点名
8. 无 Accept NDJSON 时：服务端仍跑同编排，结束后 JSON { itinerary, updatedAt }
9. 缺 `OPENAI_API_KEY` → 明确 outcome key（与助手同源）；可选开关才回退 agent arrange execution=agent（默认关）
```

**流事件（BFF → UI）：** `phase` · `candidate_place` · `discover_done`（**不作** arrange 主文案）· `arrange_day_start` · `day_highlights` · **`slot_preview`** · **`slot`**（`place` alias）· `day_done` · `progress` · `done` · `error`。单日顺序：`arrange_day_start` → `day_highlights` → (`slot_preview` → `slot`)\* → `day_done`。细节与 i18n 见 [`itinerary-design.md`](./itinerary-design.md) §3–§4；用户故事见 [`2play-stories.md`](./2play-stories.md) `plan-10`。

**L2 安排约束（[ADR-038](../../workspace-specs/adr/ADR-038-discover-places-quality.md) P0）：** 一日一主题；同区连游；禁止同日堆同一地标 cluster；理由可含估计步行/打车（**不**调 navigate）。L1 须已做 cluster 去重与多样性，避免城墙碎片占满候选头。  
**可行性：** L2 目标为 **按 block 尽早推送**（真流式或增量 parse）；不得以「整日等满再首次出站」为验收通过标准。  
**多样性：** 跨天 `usedNames` 收缩候选；各日不得简单复制 Day 1。  
**日历 bounds：** 仍传 agent discover；BFF 自算各日 `date = startDate + (dayIndex - 1)`。  
**Fallback：** discover 失败 → 诚实 error（不得假景点）。OPENAI_CN 单日失败且已有 ≥1 日 → 以已完成日结束；全日失败 → `error`。显式开关下可选 agent `arrange_day` execution=agent 降级。  
**Agent 搜词（QLP）：** 仅 discover 路径；BFF **不**组地图关键词。  
**现状（2026-08-23）：** L1 = agent `discover_places`；L2 = **本应用 OPENAI_CN**（本地拼 prompt，ADR-037）。Agent Mode H（`execution=host`）**已交付**；2play 改拉该 prompt 见 `plan-11` / [`itinerary-design.md`](./itinerary-design.md) §1。Mock 仍见 `06-plan-*.html`。

#### 2.4.2 刷新恢复（`GET /api/plan/current`）

对齐 what2eat `GET /api/decide/current`：mount 时恢复未过期 cache；表单 criteria 与中部行程一并 hydrate。无 cache → 空态（规划器可编辑，详情区引导生成）。

#### 2.4.3 页内 Chat（`POST /api/chat`）— ADR-036 方案 B

```text
1. requireUser + CSRF
2. Body: { messages[], itineraryId?: "draft"|savedId, locale }
3. BFF 截断 transcript（长度上限，保留 system 分隔后尾部）
4. 组装：当前 ItineraryDto 摘要（天数、slot ids/names、约束）+ messages
5. BFF 调用本应用 OPENAI_CN（流式 chat/completions）：
   - 流式 token → 客户端助手气泡（SSE 或 NDJSON，实现选定一种）
   - 模型输出约定：自然语言回复 + 可选结构化 itineraryPatch / 完整 itinerary JSON
6. 若本轮需要换店/查点：BFF 先 HTTP 调 places-agent search_* / geocode（可选），再注入上下文；**不**把助手默认路由到 /v1/chat 或 plan_itinerary
7. 客户端：append 聊天；若有 patch/itinerary → 更新中部时间轴 + PlanSessionCache
```

**不做：** 每轮 INSERT chat 表；助手路径默认整单 `plan_itinerary`。  
**整单重做：** §2.4.4 replan → 同 §2.4.1（agent discover + BFF OPENAI_CN arrange）。

#### 2.4.4 重新规划（`POST /api/plan/replan`）

```text
1. 客户端先弹 alertdialog（文案见 §3.5.5）；取消则不请求
2. 确认后 POST：boundaries + messages[]（截断）+ locale
3. BFF 按 §2.4.1 重新 **discover（agent）→ OPENAI_CN arrange×N**（可复用截断 chat 作偏好上下文）；替换 PlanSessionCache
4. 客户端：清空中部后走 progressive 渲染；**保留** local transcript；插入 system 泡 play.chat.replan_divider
5. 已保存 DB 行不受影响
```

#### 2.4.5 保存（`POST /api/saved`）

```text
1. Body: { itinerary: ItineraryDto, messages: ChatMessage[] }
2. **MVP-2：** 允许 `messages: []`（仅行程入库，满足我的行程多卡）
3. **MVP-3+：** 有 chat 时一并写入 `ItineraryChatMessage[]`（当时快照）
4. 事务：SavedItinerary +（可选）ItineraryChatMessage[]
5. 返回 { id, savedAt }；客户端可把 draft 键迁到 w2p.chat.itinerary.{id}
```

之后继续聊 → 仅更新 local；需再次保存才更新 DB。

### 2.5 DTO 契约（BFF ↔ UI）

#### `PlanBoundaries`（请求）

| 字段 | 类型 | 必填 |
| --- | --- | --- |
| `destination` | string | 是 |
| `days` | number 1–14 | 是 |
| `startDate` | `YYYY-MM-DD`（本地日历日） | **是** |
| `partySize` | number 1–20 | 否 |
| `tripType` | string | 否 |
| `budget` | string | 否 |
| `pace` | string | 否 |
| `transport` | string | 否 |
| `dailyStart` / `dailyEnd` | string | 否 |
| `timeFrom` / `timeTo` | `HH:MM` | 否；成对则 to > from |
| `interests` | string[]（§3.8 枚举或自定义） | 否 |
| `constraints` | string ≤500 | 否 |
| `locale` | `EN`\|`CN`\|`HK`\|`TW` | 是（或从 session） |

#### `ItineraryDto`（响应 / 缓存 / 保存）

```ts
type ItineraryDto = {
  title: string;
  destination: string;
  daysCount: number;
  updatedAt: string; // ISO
  days: Array<{
    dayIndex: number; // 1-based
    highlights: { label: string; title: string; theme?: string; tags: string[] };
    meta?: { transport?: string; pace?: string; window?: string };
    slots: Array<
      | { kind: "transit"; start: string; end?: string; text: string }
      | {
          kind: "place";
          start: string;
          end: string;
          placeKind: string; // Attraction | Food | …
          name: string;
          summary: string;
          photoUrl?: string;
          provider?: string;
          nativeId?: string;
          detailsUrl?: string; // secret-free
          mapUrl?: string;     // secret-free deeplink
        }
    >;
  }>;
};
```

**诚实规则：** 缺失 `photoUrl` / hours / rating 用占位，不编造。`nativeId` 不以 `fixture_` 开头（MVP-2+ live DoD，ADR-021）。

#### `ChatMessage`

```ts
type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  // MVP-4+ 可选: blocks?: ChatBlock[]
};
```

### 2.6 数据模型（App DB）

| 实体 | 要点 | MVP |
| --- | --- | --- |
| `User` | email、passwordHash、name、gender?、age?、**nationality?**（ISO alpha-3，MVP-11）、photoUrl?、defaultLocation、defaultLat/Lng、locale | 1 |
| `InterestProfile` | `userId` unique；`interests` Json `string[]`（§3.8） | 1 |
| `PlanSessionCache` | `userId` unique；criteriaJson；itineraryJson；updatedAt；expiresAt | 2 |
| `SavedItinerary` | title、destination、daysCount、coverUrl?、snapshot Json（ItineraryDto）、savedAt | 2 |
| `ItineraryChatMessage` | `itineraryId`；role；content；ord；createdAt — **仅保存时写入** | 3 |
| `PasswordResetToken` | tokenHash、expiresAt、usedAt | 1 |

**无表：** 每回合 chat、未保存 History、SSO identity。

兴趣也可嵌在 `User` JSON；若合并，可省 `InterestProfile` 表 — 实现二选一，契约测试锁行为。推荐独立表便于 PUT personal 时事务清晰。

### 2.7 模块布局

```text
3.where2play/
  app/
    (public)/          # home, register, login, reset, set-password
    (app)/             # plan, saved, saved/[id], profile
    api/               # Route Handlers（§2.3）
  src/
    core/              # plan-validate, interest-map, itinerary-map, chat-truncate, pdf-build, country-codes
    places-agent/      # client.ts, types.ts（plan_itinerary, chat, geocode, search_places）
    auth/              # session, csrf, password, register-validation
    i18n/              # use-t, catalogs
    ui/                # … nationality-select.tsx（MVP-11）
    db/                # prisma client
    chat/              # local-draft.ts, commit.ts
  messages/{EN,CN,HK,TW}.json
  prisma/
  tests/               # Vitest
  e2e/                 # Python Playwright
  2play-specs/
```

依赖方向：`app/api` → `core` + `places-agent/client` + `auth` → `db`；`core` **不** import Next。

### 2.8 环境变量（名称）

键名真源：仓库根 `.env.example`（与 `.env.local` / `.env.production` 同键；**protect-eng**：未确认不改用户已填值）。where2play **不含** `AMAP_*`、`GOOGLE_MAPS_*`。**初排 L2 + 行程助手**均需产品侧 OPENAI_CN（[ADR-036](../../workspace-specs/adr/ADR-036-where2play-assistant-quanzil.md)、[ADR-037](../../workspace-specs/adr/ADR-037-where2play-plan-l2-quanzil.md)）；**L1 discover / 地图**仍依赖 `PLACES_AGENT_*`。

| 变量 | 用途 |
| --- | --- |
| `PORT` | 本地 **3030** |
| `PUBLIC_BASE_URL` | `http://localhost:3030` / `https://where2play.place` |
| `DATABASE_URL` / `TEST_DATABASE_URL` | PostgreSQL |
| `SESSION_SECRET` | Session cookie |
| `PLACES_AGENT_BASE_URL` / `PLACES_AGENT_CALLER_KEY` | MVP-2+ BFF → agent（**discover** / 地图） |
| `PLACES_AGENT_PLAN_TIMEOUT_MS` | 可选；单次 agent 调用超时（discover 等），默认 **120000** |
| `PLACES_AGENT_DISCOVER_TIMEOUT_MS` / `PLACES_AGENT_ARRANGE_TIMEOUT_MS` | 可选；discover 超时；arrange 仅在显式降级开关启用时有意义 |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_CHAT_MODEL` | **初排 L2 + 行程助手** BFF→OPENAI_CN（建议 model 默认 `gpt-5.4`） |
| `RESEND_*` / `FEATURE_EMAIL` | MVP-1 邮件 |
| `CHAT_CONTEXT_MAX_CHARS` | 可选；replan/chat 截断上限 |

### 2.9 安全

| 控制 | 要求 |
| --- | --- |
| Secrets | 浏览器永不持有 caller key / map key / LLM key |
| Session | HttpOnly Secure cookie；登出失效 |
| CSRF | 变更类 API 校验（同 what2eat） |
| 授权 | Saved/Itinerary 按 `userId` 隔离；越权 `404/403` |
| 输入 | Zod；constraints 长度上限；PDF 仅用已保存/当前 DTO 字段 |
| 外链 | `mapUrl`/`detailsUrl` 仅 https；`rel=noopener noreferrer` |
| 错误 | API 不回堆栈、不回 token；agent 失败 fail-closed 或诚实空态 |
| 日志 | 不记密码、不记 caller key |

### 2.10 可观测性与性能（MVP 基线）

| 项 | 约定 |
| --- | --- |
| 延迟 | discover ~数秒–二十秒；**L2 OPENAI_CN** 目标首日首站尽早可见；UI 须 **同态实时** 与 **逐 place** 反馈（§2.4.1 / §3.5.5）；超时可配置并诚实报错 |
| 日志 | BFF 记 `requestId`、userId hash、agent/discover status、OPENAI_CN latency；无 PII 密码 |
| 成本 | 初排 L2 + 助手均走本应用 OPENAI_CN：控制频率（可选 rate limit）；discover 成本仍在 agent |
| 缓存 | PlanSessionCache 短 TTL；不把 live vendor 结果当永久真源 |

### 2.11 MVP 实现顺序

与 [`2play-stories.md`](./2play-stories.md) / [`2play-test-plan.md`](./2play-test-plan.md) 一致：

| 切片 | 交付 |
| --- | --- |
| **MVP-1** | Shell、Home、Account、Profile（兴趣单卡）、i18n、footer |
| **MVP-2** | Plan 三列板 + 单行程 Day/Hour + PlanSessionCache + **保存行程**（`messages` 可 `[]`）+ 我的行程多卡/详情 |
| **MVP-3** | 页内 Chat（local）+ **保存提交 messages** + 详情只读 DB 对话 |
| **MVP-4** | Replan 确认+分隔、PDF、Chat 高度 resize |

### 2.12 对照 what2eat（架构差异）

| | what2eat | where2play |
| --- | --- | --- |
| 主 API | `search_restaurants` + rank | `plan_itinerary` timed |
| 主交付 | 短名单多卡 | **一条**行程 |
| Chat 存储 | **仅** localStorage | local 草稿 + **保存入 DB** |
| Chat UI | FAB 列表 + 详情内 | Plan **内嵌**唯一入口 |
| 收藏 | SavedPlace | SavedItinerary + chat 快照 |
| History | DecisionHistory | **不做**未保存 History |
| 端口 | 3020 | **3030** |
| DB | `what2eat` | `where2play` |

---

## §3 页面契约（与 mock 一一对应）

像素级 DOM/HTML 以 [`ui-mockup/`](./ui-mockup/) 为真源。实现时结构、字段、chip 词表、testid 须对齐。

| 路由 | Mock | 主要区块 | 关键 `data-testid` | Story |
| --- | --- | --- | --- | --- |
| `/` | `01-home.html` | 大 logo、headline、CTA | — | home-01, footer-02 |
| `/register` | `02-register.html` | 单列 register-card | `register-form`, `register-submit` | account-01 |
| `/login` | `03-login.html` | email/password | `login-submit` | account-02 |
| `/reset-password` | `04-reset.html` | 发信 / sent | `reset-sent` | account-03 |
| `/set-password` | `05-set-password.html` | 新密码 | — | account-04 |
| `/plan` | `06-plan.html`；`06-plan-skeleton.html`；`06-plan-qa.html` | 起飞条 5 字段、骨架填充、助手问答（Travor §4.7） | `plan-form`, `plan-dest`, `plan-start-date`, `plan-days`, `plan-party`, `plan-budget`, `plan-submit`, `plan-nav`, `plan-nav-resize`, `plan-nav-input`, `plan-nav-send`, `plan-nav-close`, `replan-dialog`, … | plan-46 |
| `/profile` | `07-profile.html` | 单列用户资料（含兴趣） | `profile-save` | profile-01 |
| `/saved` | `08-saved.html` | 行程卡网格 | `trip-card`（实现时加） | saved-01 |
| `/saved/[id]` | `09-saved-detail.html` | Day/Hour + DB 对话只读 | `chat-transcript`, `plan-export` | saved-02 |
| — | `index.html` | 画廊 | — | — |

---

### 3.1 Home — `01-home.html`

| 项 | 契约 |
| --- | --- |
| Shell | `shell-public`；`.home-main` 居中，宽 `--max-home` |
| Logo | mark **72** + wing-trail；`logo-word` where2play.place |
| Headline | 源 EN：`Where should we play?`（i18n） |
| Lead | 源 EN：`Life is short, and the world is wide.`；CN：`世界这么大，我想去看看 …`（HK/TW 同句繁体） |
| CTA | Primary `Start exploring` → `/register`；Quiet `Sign in` → `/login` |
| Footer | 公开 `family-footer`（§1.5） |

---

### 3.2 Register — `02-register.html`

**单列** `.register-shell` → `.register-card`（宽 `--max-register-card`）。**无**右侧头像栏（与 2eat 双列不同）。

顶栏：logo → home；locale EN/CN/HK/TW。

| 字段 | 标签（CN） | 必填 | 控件 |
| --- | --- | --- | --- |
| name | 姓名 | **是** `is-required` | text |
| email | Email + note「用于登录账号」 | **是** | email |
| gender | 性别 | 否 | select：不愿透露（默认）/ 女 / 男 / 其他 |
| age | 年龄 | 否 | number 13–120 |
| nationality | 国籍（护照签发国） | 否 | select：ISO alpha-3 值；展示名 `Intl.DisplayNames` 按 locale；首项空值「请选择」 |
| location | 常用出发地 | 否 | text + 定位按钮；浏览器定位成功后经 reverse geocode，**默认展示城市级标签**（`toCityLabel`） |
| password | 密码 | **是** | password |
| password_confirm | 确认密码 | **是** | password |
| interests | **出行兴趣（多选）** | 否 | chips（默认可全关） |

兴趣词表（固定）：**景点 · 美食 · 博物馆 · 公园 · 寺庙 · 夜市 · 购物 · 温泉 · 户外**

页顶说明：`标 * 为必填`（`play.register.required_note`）。  
提交：`创建账号`（`register-submit`）。链：`已有账号？登录`。

**i18n（MVP-11 新增 key，四 locale 均需）：**

| Key | EN 参考 |
| --- | --- |
| `play.register.nationality` | Nationality (passport country) |
| `play.register.nationality_placeholder` | Select… |
| `play.profile.nationality` | Nationality (passport country) |
| `play.errors.nationality_invalid` | Select a valid country. |

**组件 `NationalitySelect`（`src/ui/nationality-select.tsx`）：**

| 属性 | 契约 |
| --- | --- |
| 视觉 | 复用 `.field` + 原生 `select`，与 gender 同宽/同 typography |
| `value` / `onChange` | 受控；值为 alpha-3 或 `""` |
| `testId` | `register-nationality` / `profile-nationality` |
| 选项值 | `PASSPORT_COUNTRY_CODES`（`src/core/country-codes.ts`） |
| 选项标签 | `Intl.DisplayNames(displayNamesLocale, { type: "region" }).of(code)`；HK/TW 用 `zh-HK`/`zh-TW` |
| 首项 | i18n `play.register.nationality_placeholder`（空值） |
| a11y | `<label htmlFor>` 关联；注册/资料页各一实例 |

---

### 3.3 Login / Reset / Set password — `03`–`05`

| 页 | 要点 |
| --- | --- |
| Login | `.auth-card`：Email、Password；`Sign in`；`.auth-links` 为独立链接（glaze + underline），间距 ≥1rem；成功进 `/plan` |
| Reset | 标题与 `.lead` **左对齐**；lead 单行优先（窄屏可折）；Email → `Send reset link`；成功 `.callout.is-info`（`reset-sent`） |
| Set password | New / Confirm → `Save password` → login；需支持过期链状态（实现） |

窄列 `--max-auth`；公开 footer。

---

### 3.4 Profile — `07-profile.html`

**单列** `.app-main--profile` → `.profile-stack` → **一张** `.register-card`「用户资料」。  
**无**独立「出行兴趣」第二卡（已合并）。**无**页顶长说明文案。

| 字段 | 标签（CN） | 必填（实现） | 控件 |
| --- | --- | --- | --- |
| name | 姓名 | **是**（标 `*` + note） | text |
| email | Email +「用于登录账号」 | **是** | email |
| gender | 性别 | 否 | select |
| age | 年龄 | 否 | number 13–120 |
| nationality | 国籍（护照签发国） | 否 | select（同注册；ISO alpha-3；`data-testid="profile-nationality"`） |
| location | 常用出发地 | **是**（与 2eat personal / 行程出发一致） | text + 定位（城市级标签）+ 旁路「重置密码」 |
| interests | **出行兴趣（多选）** | 否 | 同注册 9 chips |

头：`用户资料` + `上次保存 {time}`。  
提交：`保存资料`（`profile-save`）。  
删除文案（不得出现）：「轻量出行兴趣会带到规划器…」「点选常去的玩法（可多选）。」

实现须补：`register-required-note` + `is-required`（mock 若尚未标全，以本契约 + 2eat 个人信息页为准）。

---

### 3.5 Plan — `06-plan*.html`（**deprecated — 见 §4 MVP-10**）

> **已废弃：** 本节描述 MVP-3 双行规划器与 Discover/Arrange mock（`06-plan-discover` 等已删除）。**当前真源：** §4 + `06-plan.html` / `06-plan-skeleton.html` / `06-plan-qa.html`。

**Accepted mock states（历史，文件已删）：** 完成态双行规划器 · Discover · Arrange Highlights / slots / Day2。

```text
┌─ page-title: 行程规划 ─────────────────────┐
│ panel: plan-board（双行栅格，无分区大标题）  │
│   Row1: 目的地 | 起始日期 | 天数 人数 起终点 时段
│   Row2: 类型/预算 | 节奏/交通 | 偏好与限制
│ plan-board__actions + plan-phase.is-busy + btn.is-generating │
│ panel: 候选地点（仅 discover；同态 .slot）    │  ← 06-plan-discover
│ 摘要 + panel: Highlights → slots → pending   │  ← arrange mocks
│   · 行程细节提示 `.plan-slot-preview`（非候选池摘要） │
│ panel: 行程助手（chat-shell；MVP 可后置）     │
│ plan-actions: 重新规划 · 保存 · 导出 PDF     │
└──────────────────────────────────────────────┘
+ replan alertdialog（默认隐藏）
```

#### 3.5.1 规划器 `plan-board`

`.plan-board__grid`（三列 × 两行，子节点按行主序）：

```text
grid-template-columns: var(--plan-col) var(--plan-col) minmax(0, 1fr);
gap: var(--plan-gap);
/* days / party 窄列 */
--plan-num: 2.85rem;
```

| 行 | 栅格子 | 内容 |
| --- | --- | --- |
| **1** | `dest` · `start_date` · `.plan-when` | 目的地*；起始日期*（宽=`--plan-col`，与下方「节奏」同 x/宽）；天数*+人数+每日起点+每日终点+开始+到+结束（天数左缘 = 偏好块左缘；结束右缘贴齐板右缘） |
| **2** | stack A · stack B · `.plan-prefs-block` | 类型→预算；节奏→交通（与类型列对齐）；**偏好与限制** |

**对齐约定（已接受）：** 起始日期 ≡ 节奏；天数左缘 ≡ 偏好与限制左缘；类型 ≡ 节奏；天数与人数同宽（`--plan-num`，可显示两位数 99）。

| 字段 | 必填 | 备注 |
| --- | --- | --- |
| 目的地 | **是** | `plan-dest`；placeholder `城市 / 区域`；第一行第一项 |
| 起始日期 | **是** | `type=date`；`plan-start-date`；本地 `YYYY-MM-DD`；第一行第二项；传 agent 作 `bounds.start` |
| 天数 | **是** | 1–14；`plan-days`；`.plan-when` 首项 |
| 人数 | 否 | 1–20；紧随天数，同宽 |
| 类型 | 否 | combo：城市漫游 / 情侣出游 / 家庭度假 / 个人放松 / 美食之旅；可自填 |
| 预算 | 否 | 经济 / 中等 / 舒适 |
| 节奏 | 否 | 紧凑 / 适中 / 轻松 |
| 交通偏好 | 否 | 捷运 + 步行 / 步行优先 / 打车 / 公交 + 步行 |
| 每日起点/终点 | 否 | 终点 placeholder：`可选，不填默认与起点同` |
| 开始/结束 | 否 | `type=time`；若都填则结束 > 开始 |
| 偏好 chips | 否 | 同兴趣词表；可 `data-interest` 枚举；可自定义输入 |
| 其他限制 | 否 | maxlength 500；**无**「（可选）」后缀文案 |

块标题：**偏好与限制**（唯一小标题，非「规划器」）。  
生成：`生成行程`（`plan-submit`），`form="plan-form"` 可放在板外 `.plan-board__actions`。

**校验：** 目的地、天数、起始日期必填；天数 1–14；起始日期须为合法 `YYYY-MM-DD`；时间成对则结束>开始；错误用 `.field.is-invalid` + `.field-error`。

**Combo：** 打开列表 = 全部选项（`mockup.js`）；黑倒三角 toggle。

#### 3.5.2 行程详情

- 头：行程标题 + `Updated {time}`（`plan-updated`）
- Day tabs：Day 1…N；票根造型
- Highlights：标签 + 标题串 + 主题句 + tag chips
- Day meta：交通 / 节奏 / 时段摘要
- **Slot：**
  - `.slot--transit`：仅时间 + 文案
  - 场所：`.slot-time`（宽=`--plan-col`）+ thumb（`slot-thumb-link`）+ `.slot-copy`（kind / h3 / p）+ `.slot-actions`（详情｜地图，新标签）
- 缩略图**左缘**与列 B 输入左缘对齐（时间列 = `--plan-col`）

#### 3.5.3 Progressive generate（发现 → 安排）— **accepted**（四段 UI + 逐条 slot）

Mock SoT（**已删除，历史参考**）：`06-plan-discover.html`（图1）、`06-plan-arrange-highlights.html`（图3）、`06-plan-arrange.html`（图2/4/5）、`06-plan-arrange-day2.html`（图6）。**当前 SoT：** §4 + [`06-plan-skeleton.html`](./ui-mockup/06-plan-skeleton.html)。技术流见 §2.4.1；专项契约 [`itinerary-design.md`](./itinerary-design.md)。

| 段 / 步骤 | DOM / 事件 | UI（与图对齐） | 禁止 |
| --- | --- | --- | --- |
| **行程日提示** | `.plan-phase.is-busy` · `phase` arranging | 「正在安排第 d/N 天…」；钮 `.is-generating` | 用候选池统计替换日提示 |
| **1 Discover** | `candidate_place` | 「正在搜索… 已找到 N 处」；`.slot--candidate`；表单 `.is-dimmed` | chip 主展示；等整包再刷 |
| **2.0 Arrange 日初** | `arrange_day_start` · `day_highlights` | Day tabs 预建（未排日 `· 排队`）；Highlights 骨架；细节提示 `play.plan.arrange_planning_day`（尚无 `slot_preview` 时） | **`候选池 P/U` 作主文案**（`arrange_pool_summary` 默认隐藏） |
| **2.1 细节提示** | `slot_preview` | `.plan-slot-preview`：按 kind 插值 `preview_place` / `preview_transit` / `preview_meal` | 整日同 tick 刷屏 |
| **2.2 行程 + 加载中** | `slot` · pending | 每 `slot` +1 行；底栏 `plan-slot-pending` **同构 skeleton**（非虚线框） | 等整天 JSON 再整日替换 |
| **2.x 切日** | `day_done` | 自动高亮下一日 tab，重复 2.0–2.2 | 须手动点 tab 才继续 |
| **完成态** | `done` | Updated；无候选主面板 / 无 pending | — |

**再生成：** 再次「生成行程」时立即清空中部行程，再进入 progressive。

**同态：** 候选与行程场所共用 `.slot` 结构。  
**动效：** slot 入场 + phase/钮/pending 等待动画；尊重 `prefers-reduced-motion`。

#### 3.5.4 Chat

- 标题：行程助手
- `.chat-shell` 高 `--chat-h`，最小 `--chat-min-h`
- transcript：agent / user bubbles（`chat-transcript`）
- composer：placeholder 示例改站；`发送`（`chat-send`）
- `.chat-resize`：仅高度；`chat-resize`；`aria-label` 拖动调整高度
- Replan 后：系统分隔泡（`chat-replan-divider`）

#### 3.5.5 底栏与对话框

| 控件 | 样式 | testid |
| --- | --- | --- |
| 重新规划 | `btn-danger` | `replan-open` |
| 保存 | `btn-quiet` | `plan-save` |
| 导出 PDF | primary | `plan-export` |

对话框文案源：标题「重新规划？」；说明「将删除当前未保存的行程，并生成一条新行程。本机对话会保留，并在聊天中加入分隔提示。」；取消 / 确定重新规划。

---

对话框文案源：标题「重新规划？」；说明「将删除当前未保存的行程，并生成一条新行程。本机对话会保留，并在聊天中加入分隔提示。」；取消 / 确定重新规划。

#### 3.5.6 出行建议 — 签证信息占位（MVP-11 spec only，**未实现**）

**路由（规划）：** `/plan/advice` 或 Plan 子面板「出行建议」（具体路由实现时定；本 spec 仅定义契约）。

**输入：**

| 来源 | 字段 |
| --- | --- |
| `User.nationality` | ISO alpha-3 护照国（Feature **38**；空则提示补全资料） |
| 当前 Plan 边界 / 用户选择 | 目的地 alpha-3（由目的地名 geocode 或映射表解析） |

**BFF（规划）：** `GET /api/travel-advice/visa?destination=JPN` — 服务端读 session `User.nationality` → `POST places-agent /v1/visa_requirement`。

**UI 区块 `.visa-advice`（mock 占位）：**

| 元素 | i18n key（示例） |
| --- | --- |
| 标题 | `play.travel_advice.visa_title` |
| 状态条 | `play.travel_advice.visa_status`（插值 requirement、days） |
| 材料摘要 | `play.travel_advice.documents_lead` + 列表 |
| 核验日期 | `play.travel_advice.last_verified` |
| 官方链接 | `play.travel_advice.source_link`（`source_url` 外链，新标签） |
| 缺国籍 | `play.travel_advice.nationality_missing` → 链至 Profile |
| 配额降级 | `play.travel_advice.quota_exceeded` |
| 加载中 | `play.travel_advice.loading` |

**Mock：** `ui-mockup/10-travel-advice.html`（占位页，静态样例 CHN→SGP 免签 30 天）。

**Honesty：** 不编造签证事实；Orizn 失败/配额耗尽显式降级；`last_verified` 须展示。

---

### 3.6 Saved — `08-saved.html`

- 标题「我的行程」；meta：仅已保存；点卡进详情
- `.trip-grid`：封面、标题、天数·保存日、摘要、`打开`
- 空态：引导去行程规划（实现）
- **无**未保存 History 分区

---

### 3.7 Saved detail — `09-saved-detail.html`

- 返回「← 我的行程」；标题 = 卡标题；meta「已保存 · 对话来自数据库快照」
- 行程详情：Day tabs + hour rows（可与 Plan slot 视觉同族）
- 「保存时的对话」：只读 transcript；注记「只读自 DB · 续聊请回到规划并再次保存」
- 底栏：返回列表 · 导出 PDF · 取消收藏（danger）

---

### 3.8 兴趣 / 偏好词表（全站统一）

| UI（CN） | Plan `data-interest`（建议） |
| --- | --- |
| 景点 | `tourist_attraction` |
| 美食 | `restaurant` |
| 博物馆 | `museum` |
| 公园 | `park` |
| 寺庙 | `place_of_worship` |
| 夜市 | `night_market` |
| 购物 | `shopping_mall` |
| 温泉 | `spa` |
| 户外 | `natural_feature` |

Profile / Register 标签固定为 **出行兴趣（多选）**。Plan 块标题为 **偏好与限制**（含 chips + 其他限制）。

---

### 3.9 实现核对清单（100% 对齐 mock）

- [ ] Token 与 `mockup.css` `:root` 一致（含 `--cloth-b`、`--plan-col`、`--max-register-card`）
- [ ] Primary = glaze；非 mustard 主按钮
- [ ] Logo = `wing-trail` path + −11deg 动画族；无旧 trail
- [ ] Header：行程规划 / 我的行程 / 个人信息；中文 weight 400
- [ ] Footer：三列栅格 + 12px 拉丁；当前产品非链
- [ ] Register / Profile：单列卡；兴趣合并；标签「出行兴趣（多选）」；无禁用长说明
- [ ] Plan：双行栅格（目的地/起始日期列 + `.plan-when` 行 + prefs）；无分区大标题；combo 全量选项；slot 时间列 = `--plan-col`；Discover/Arrange 同态 progressive
- [ ] Chat 内嵌非 FAB；resize 仅高
- [ ] Replan 确认 + 分隔泡；保存提交行程+对话；Saved 多卡；详情只读 DB 对话
- [ ] 四 locale catalogs；reduced-motion 关闭飞行动画

---

## §4 §12 轻骨架重构 — Plan 页与行程助手重设计（MVP-10，方案已确定 2026-08-31，待实现）

**真源：** places-agent [`performance.md §12`](../../1.places-agent/agent-specs/performance.md)（确认决策 §12.5/12.5.1/12.11）；`0.refactor-plan.md` 批次 11（Feature **37** plan-46 = where2play 消费）。**本节为 where2play 侧契约；UI 视觉见 §4.7（Travor 定稿）。**

### 4.1 规划器简化 — 5 必填字段

原双行栅格（§3.5.1）简化为单行 5 必填：

```text
┌─ panel: plan-board（单行） ──────────────────────────┐
│ 目的地* | 起始日期* | 天数* | 人数 | 预算($/$$/$$$)   │
│ [规划行程]                                            │
└───────────────────────────────────────────────────────┘
```

| 字段 | 必填 | testid | 备注 |
| --- | --- | --- | --- |
| 目的地 | 是 | `plan-dest` | 保留 |
| 起始日期 | 是 | `plan-start-date` | 保留；传 agent `bounds.start` |
| 天数 | 是 | `plan-days` | 保留；1–14 |
| 人数 | 是（原否） | `plan-party` | 提升必填；1–20 |
| 预算 | 是（原否） | `plan-budget` | 提升必填；$/$$/$$$ 三档 |

**移除字段（改由助手问答获取）：** 类型、节奏、交通偏好、每日起点/终点、开始/结束时间、偏好 chips、其他限制。

**按钮：** 「生成行程」→「**规划行程**」（`plan-submit`）。点击后调起行程助手 Agent 接管，不直接生成。

### 4.2 行程助手 — 右下角悬浮框

原页面下方固定 chat（§3.5.4）改为右下角悬浮框（参考 what2eat UI）。布局与视觉见 §4.7。

**问答流程（8 步，允许默认值/跳过）：**

| 步 | 问题 | 默认值 |
| --- | --- | --- |
| a | 收到，请告诉我更详细的要求，我来帮你规划行程 | — |
| b | 请问您居住的酒店/每天行程的起点和终点决定了吗？如果没有，暂时不安排每天出发和返回的交通 | 无 |
| c | 请问您希望的每天行程开始时间？ | 09:00 |
| d | 行程的类型？（A 个人放松 B 家庭度假 C 情侣出游 D 景点打卡 E 美食之旅，其他请说明） | 景点打卡 |
| e | 你希望的节奏？（A 轻松 B 适中 C 紧凑，其他请说明） | 适中 |
| f | 交通偏好？（A 公共交通优先 B 步行优先 C 打车优先，其他请说明） | 公共交通+步行 |
| g | 有没有特别想去的地点？ | 默认列出必去点 |
| h | 还有别的要求吗？例如有老人、有婴儿、有轮椅，请说明 | 无 |
| i | 现在我了解您的要求了，让我帮您推荐适合的行程 | — |

**跳过交互：** 每步支持快捷「使用默认」或直接回车采用默认值；用户也可文字输入自定义。

### 4.3 助手接管与终止

- 助手接管后，表单重新提交（改 5 字段后点「规划行程」）将终止助手当前工作并重新开始新行程规划。
- 终止前弹窗确认（i18n）：

| Key | EN | CN |
| --- | --- | --- |
| `play.plan.confirm_replan_title` | Start a new trip? | 开始新的行程规划？ |
| `play.plan.confirm_replan_body` | This will stop the current planning and start over. Continue? | 这将停止当前规划并重新开始。继续吗？ |
| `play.plan.confirm_replan_confirm` | Start over | 重新开始 |
| `play.plan.confirm_replan_cancel` | Keep planning | 继续规划 |

- 助手任何一步都可被终止（discover / make_itinerary / plan_next_stop 中均可中断）。

### 4.4 渐进行程展示 — 骨架 + 逐 stop

**管线（BFF）：**

```text
助手问答完成 → discover_places → make_itinerary（流式骨架）
  → 助手对话框内展示骨架预览（简单文字列表，day-by-day stop-by-stop，只显示 stop 名称，无时间）
  → display_current_stop(起点) → 行程列表开始
  → 循环: plan_next_stop → display_current_stop → 行程列表 +1 stop
  → 一天结束 → 下一天
```

**行程列表（保留 §3.5.2 slot 结构）：**

- 骨架阶段：Day tabs + 每日 stop 名称列表（无时间），来自 `skeleton_day` 事件
- 填充阶段：每 stop 算完 transit（`plan_next_stop`）即上屏，时间由 transit 时长回填
- pending skeleton：下一个 stop 填充中（沿用 `.slot--pending` 同构骨架）
- transit 展示：按 `legs_to_here` 实际返回展示；双 mode 时斜杠分隔，如「270路公交xx站-xx站，随后步行300m，35min，$ / 打车，15min，$$」

### 4.5 BFF 编排变更

| 现状（§2.4） | 新（MVP-10） |
| --- | --- |
| `plan-day-by-day.ts` 逐日 arrange（本地 OPENAI_CN `plan-arrange-llm.ts`）+ `enrich_arrange_transit` | 改调 agent `make_itinerary`（NDJSON 流式骨架）+ 循环 `plan_next_stop` + `display_current_stop` |
| 本地 `buildArrangeDayMessages` prompt | 删除（agent 侧拼 prompt） |
| 助手经 `/v1/chat` 或 BFF OPENAI_CN | BFF OPENAI_CN 流式（ADR-036 保留），问答完成后编排上述管线 |

**工具迁移：** `arrangeDay`/`enrichArrangeTransit` client fn 删除；新增 `makeItinerary`/`planNextStop`/`displayCurrentStop`。

### 4.6 i18n 键（新增）

| Key | 用途 |
| --- | --- |
| `play.plan.plan_cta` | 按钮文案「规划行程」 |
| `play.plan.confirm_replan_title/body/confirm/cancel` | 重提交弹窗（§4.3） |
| `play.plan.assistant_greeting` | 问 a |
| `play.plan.assistant_q_hotel` … `assistant_q_other` | 问 b–h |
| `play.plan.assistant_use_default` | 「使用默认」快捷 |
| `play.plan.assistant_defaults_hint` | 默认值提示（如「默认：适中」） |
| `play.plan.skeleton_preview_title` | 骨架预览标题 |
| `play.plan.stop_filling` | stop 填充中提示 |
| `play.plan.nav_resize` | 拉手 a11y label「拖动调整助手尺寸」 |
| `play.plan.nav_collapse` | 「收起」 |
| `play.plan.nav_terminate` | 「终止」 |
| `play.plan.quick_use_default` | 快答 chips「使用默认」 |

### 4.7 UI 视觉（Frontend Design 确认稿，2026-08-31 — Travor 皮肤定稿）

**真源：** `2play-specs/ui-mockup/06-plan.html`（起飞条）、`06-plan-skeleton.html`（骨架填充）、`06-plan-qa.html`（助手问答）；样式 **`assets/mockup-travor.css`**（`body[data-style="travor"]` 覆盖层）+ `assets/mockup.css` 结构类。

**设计立场：** 主题=旅行规划，受众=自助旅行者，页面任务=5 必填启动规划、悬浮领航员补全条件、骨架先出顺序再逐站填充。**Travor 暖色皮肤**（非 §1 登机牌绿）；签名元素=跑道式进度脊（保留结构，脊线填充色改 Travor token）。

#### Token（Travor）

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg-warm` | `#FAF7F1` | 页面底 |
| `--accent-cta` | `#FFA26B` | 实心按钮默认 |
| `--accent-cta-hover` | `#FF621F` | 按钮 hover |
| `--assistant-surface` | `#FFE3D3` | 助手头、用户气泡 |
| `--label-teal` | `#068A7F` | HIGHLIGHTS / slot-kind 标签 |
| `--radius-control` | `0.75rem` | 按钮、day tab、chip |
| 字体 | Inter + 獅尾腿圓 | 拉丁 + 中文 |

**按钮：** 全部实心 CTA 统一 `--accent-cta` / hover；**不用** 绿渐变 launch pill（旧 §1 `--glaze` 绿仅作历史 mock 参考）。

**起飞条（`plan-takeoff`）：** 单行 5 格——目的地（拉长）/ 起始日期（`12rem`，日历）/ 天数（`3.3rem`）/ 人数（`3.3rem`）/ 预算（`<select>`：`$ 经济` / `$$ 中等` / `$$$ 舒适`），右端「规划行程」。移动端折两列。**点击只调起领航员**，不直接生成。

**悬浮领航员（`plan-nav`）：** 右下角参考 what2eat。

- 收起态：`plan-nav-launch` pill（浅橙底 + 机翼 mark +「行程助手」）。
- 展开态：`plan-nav__panel`，默认 `27rem × 45rem`，最大 `40rem × 64rem`。
- **左上角拉手（`plan-nav__resize`）：** SVG 双箭头，`nwse-resize`；最小=默认尺寸。
- 头部（`--assistant-surface`）：标题 + 上下文摘要 + 「收起」/「终止」；左留白避让拉手。
- 主体：agent 浅底 / user `#FFE3D3` 气泡 + 快答 chips + 骨架预览列表。
- 底部：输入 + 「发送」。

**骨架预览（领航员内）：** `skeleton-day` 列表，只显示 stop 名称（无时间）；餐位 🍽 + 餐段 i18n key。已填充 `skeleton-stop--filled`；当前 `is-pending` shimmer。

**跑道式进度脊（`plan-nav__rail`）：** 左 2px 脊线；`plan-nav__rail-fill` 按骨架/填充进度增长；`prefers-reduced-motion` 关过渡。

**行程主列表：** Day tabs（inactive 暖底；active 浅橙 + `--radius-control`）+ **起点 Stay stop**（§17.1）+ transit 单行（§17.2）+ 已填充 slot + pending skeleton。

**Panel 头（`panel__head-actions`）：** 标题行右侧 — 重新规划 / 保存行程 / 导出 PDF；**无** 底部 sticky 操作条。

**阶段 meta（`plan-phase__meta`）：** 左对齐 `骨架 HH:MM · 填充中`。

**重提交/终止弹窗：** 沿用 `.dialog`；文案 §4.3 i18n（4 key）。

**a11y：** 拉手 `aria-label`；领航员 `aria-label`；表单禁用 `aria-disabled`；reduced-motion 关 shimmer。

---

## 相关文档

| 文档 | 角色 |
| --- | --- |
| [`2play-prod-specs.md`](./2play-prod-specs.md) | 产品边界 |
| [`2play-stories.md`](./2play-stories.md) | AC / backlog |
| [`2play-test-plan.md`](./2play-test-plan.md) | 质量门与用例 |
| [`2play-deployment-plan.md`](./2play-deployment-plan.md) | 部署（[`6.deployment-plan.md`](./6.deployment-plan.md) 同义入口） |
| [`../../1.places-agent/agent-specs/`](../../1.places-agent/agent-specs/) | Agent HTTP / `plan_itinerary` |
| [`../../workspace-specs/6.deployment-plan.md`](../../workspace-specs/6.deployment-plan.md) §0 | 端口注册 |
| [ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md) | where2play PostgreSQL |
| [`../../2.what2eat/2eat-specs/2eat-design.md`](../../2.what2eat/2eat-specs/2eat-design.md) | 姊妹薄客户端参考 |