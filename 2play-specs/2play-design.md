# where2play — 设计规范

**where2play**（`where2play.place`）视觉、技术架构与页面契约。产品边界见 [`2play-prod-specs.md`](./2play-prod-specs.md)；用户故事与 AC 见 [`2play-stories.md`](./2play-stories.md)；测试与质量门见 [`2play-test-plan.md`](./2play-test-plan.md)；部署见 [`6.deployment-plan.md`](./6.deployment-plan.md)。家族架构见 [`../../workspace-specs/2.architecture.md`](../../workspace-specs/2.architecture.md)；行程引擎 [ADR-008](../../workspace-specs/adr/ADR-008-itinerary-ownership.md)。格式与深度对齐 what2eat [`2eat-design.md`](../../2.what2eat/2eat-specs/2eat-design.md)。

**技术栈：** 与 what2eat 同族 thin client。实现目录 `3.where2play/`。本地 **PORT=3030**；生产 `where2play.place`（宿主机 `3005→3000`）。

**冲突优先级：** 与 [`ui-mockup/`](./ui-mockup/) + [`assets/mockup.css`](./ui-mockup/assets/mockup.css) 冲突时，**以 mock 为准**。实现真实页面须与本文件 §1 / §3 及对应 HTML **视觉与结构 100% 一致**（文案走 i18n key，源语言参考 mock 中文/英文）。

**可执行 mock：** [`ui-mockup/index.html`](./ui-mockup/index.html)。`index.html` 为评审画廊，非产品路由。

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
| Thin client + 同源 BFF；每次一条 `plan_itinerary`（`detail: "timed"`） | 一次多行程短名单；浏览器 MCP / map key / LLM key |
| Plan 单页 + 单一 Chat + 底栏 | 双 Chat / FAB 全局 Chat |
| Chat：local 草稿 + **保存时** DB 快照 | 每轮 chat 写库；未保存跨设备同步 |
| 我的行程多卡读 DB | MVP 未保存 History 列表 |
| 四 locale 独立 catalog；账号独立 | 与 what2eat SSO；OpenCC；HK↔TW 共文件 |
| BFF HTTP-only → places-agent（ADR-020 同族） | 本应用直接调 Quanzil / map vendors |

```text
Browser → where2play /api/* → places-agent /v1/*
Browser localStorage ← w2p.chat.draft | w2p.chat.itinerary.{id}
App DB ← User, InterestProfile, SavedItinerary + ItineraryChatMessage (commit only)
           (+ optional PlanSessionCache for refresh hydrate)
```

**LLM 决策（定稿）：** where2play **不含** `OPENAI_*`。规划与对话均经 places-agent（与 what2eat 一致）。workspace `3.tech-specs.md` 中「where2play 可有 product Quanzil」视为过时；以本文件 + [`2play-prod-specs.md`](./2play-prod-specs.md) 为准。若将来需要本机产品文案模型，另开 ADR。

职责划分详见 [`2play-prod-specs.md`](./2play-prod-specs.md) 与 [`../../workspace-specs/2.architecture.md`](../../workspace-specs/2.architecture.md)。行程引擎归属 [ADR-008](../../workspace-specs/adr/ADR-008-itinerary-ownership.md)。

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
| places-agent `fetch` 客户端 | **无** MCP、**无** 浏览器 Quanzil |

入口：`next dev` / standalone `node server.js`（同 what2eat）。

**本地：** `PORT=3030` · `PUBLIC_BASE_URL=http://localhost:3030` · `PLACES_AGENT_BASE_URL=http://localhost:3010`。  
**Postgres（[ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md)）：** 本地 `postgresql://where2play:where2play@localhost:5435/where2play`；生产 Aliyun `…@101.132.156.250:5432/where2play`；测试库 `where2play_test`。

### 2.3 BFF 路由表

| 路径 | 方法 | 职责 |
| --- | --- | --- |
| `/api/auth/register` | POST | 注册（含可选兴趣） |
| `/api/auth/login` | POST | 登录 |
| `/api/auth/logout` | POST | 登出；客户端清 `w2p.chat.*` |
| `/api/auth/reset-password` | POST | 发重置邮件 |
| `/api/auth/set-password` | POST | 凭 token 设新密码 |
| `/api/profile/personal` | GET/PUT | 个人信息 + **出行兴趣**（单卡一次保存；兴趣可为同 payload 字段） |
| `/api/plan` | POST | 边界 → `plan_itinerary` → **一条** `ItineraryDto` |
| `/api/plan/current` | GET | 读取未过期 PlanSessionCache（刷新恢复中部行程 + 表单 criteria） |
| `/api/plan/replan` | POST | 新一条；body 含截断 chat 上下文；**不**清 local transcript |
| `/api/chat` | POST | 组装行程上下文 → `POST /v1/chat`；返回 assistant + 可选 `itineraryPatch` |
| `/api/saved` | GET | 已保存行程卡列表 |
| `/api/saved` | POST | **提交点**：行程快照 + messages[] → DB |
| `/api/saved/[id]` | DELETE | 取消收藏 |
| `/api/itineraries/[id]` | GET | 详情 + DB chat（只读） |
| `/api/itineraries/[id]/export` | GET | PDF（`application/pdf`） |
| `/api/geocode/reverse` | POST | 反向 geocode（出发地） |

**横切：** Mutating 路由 = session cookie + CSRF（对齐 what2eat）。Caller key **仅**服务端 env。未认证访问 App `/api/plan|saved|…` → `401`。

### 2.4 Plan / Replan / Chat 流程

#### 2.4.1 生成行程（`POST /api/plan`）

```text
1. requireUser + CSRF
2. Zod 校验 PlanBoundaries（目的地*、天数* 1–14；可选人数/类型/预算/节奏/交通/起终点/时段/兴趣/限制）
3. 读 InterestProfile（若表单未带兴趣，可用作默认 chips）
4. BFF 组装 places-agent 请求：
     - tool/path: POST /v1/plan_itinerary
     - detail: "timed"
     - providers[]: caller-driven（大陆倾向 ["AMAP","GOOGLE_MAPS"]；海外 ["GOOGLE_MAPS"]；ADR-005）
     - locale: 当前用户 locale
5. 映射 agent 响应 → ItineraryDto（一天一条 days[]；blocks → slots）
6. 写入 PlanSessionCache（userId, criteriaJson, itineraryJson, updatedAt；TTL 建议 24h）
7. 返回 { itinerary, updatedAt } — **不得**在 agent 失败时返回 canned 景点名
```

#### 2.4.2 刷新恢复（`GET /api/plan/current`）

对齐 what2eat `GET /api/decide/current`：mount 时恢复未过期 cache；表单 criteria 与中部行程一并 hydrate。无 cache → 空态（规划器可编辑，详情区引导生成）。

#### 2.4.3 页内 Chat（`POST /api/chat`）

```text
1. requireUser + CSRF
2. Body: { messages[], itineraryId?: "draft"|savedId, locale }
3. BFF 截断 transcript（长度上限，保留 system 分隔后尾部）
4. 附带当前 ItineraryDto 摘要（天数、slot ids/names、约束）→ POST /v1/chat
5. 响应：
   - reply: { role, content } 或 rich blocks（若 agent 支持；MVP-3 可先 plain）
   - itinerary?: 完整替换 DTO（随动改中部）— 或以 patch 约定；实现选一种并写契约测试
6. 客户端 append 到 localStorage；若返回新 itinerary，更新中部 + PlanSessionCache（可选再 PUT）
```

**不做：** 每轮 INSERT chat 表。

#### 2.4.4 重新规划（`POST /api/plan/replan`）

```text
1. 客户端先弹 alertdialog（文案见 §3.5.4）；取消则不请求
2. 确认后 POST：boundaries + messages[]（截断）+ locale
3. BFF 调 plan_itinerary（同 §2.4.1）；替换 PlanSessionCache
4. 客户端：替换中部行程；**保留** local transcript；插入 system 泡 play.chat.replan_divider
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
| `User` | email、passwordHash、name、gender?、age?、photoUrl?、defaultLocation、defaultLat/Lng、locale | 1 |
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
    core/              # plan-validate, interest-map, itinerary-map, chat-truncate, pdf-build
    places-agent/      # client.ts, types.ts（plan_itinerary, chat, geocode, search_places）
    auth/              # session, csrf, password, register-validation
    i18n/              # use-t, catalogs
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

键名真源：仓库根 `.env.example`（与 `.env.local` / `.env.production` 同键；**protect-eng**：未确认不改用户已填值）。where2play **不含** `OPENAI_*`、`AMAP_*`、`GOOGLE_MAPS_*`。

| 变量 | 用途 |
| --- | --- |
| `PORT` | 本地 **3030** |
| `PUBLIC_BASE_URL` | `http://localhost:3030` / `https://where2play.place` |
| `DATABASE_URL` / `TEST_DATABASE_URL` | PostgreSQL |
| `SESSION_SECRET` | Session cookie |
| `PLACES_AGENT_BASE_URL` / `PLACES_AGENT_CALLER_KEY` | MVP-2+ BFF → agent |
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
| 延迟 | `plan_itinerary` 可能数秒–十余秒；UI 须有 pending；超时可配置并诚实报错 |
| 日志 | BFF 记 `requestId`、userId hash、agent status、latency；无 PII 密码 |
| 成本 | 不在 where2play 直接调 LLM；控制 replan/chat 频率（可选轻量 rate limit） |
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
| `/plan` | `06-plan.html` | 三列规划器、Day/Hour、Chat、底栏、replan | `plan-form`, `plan-dest`, `plan-submit`, `plan-updated`, `chat-shell`, `chat-transcript`, `chat-input`, `chat-send`, `chat-resize`, `replan-open`, `replan-dialog`, `replan-cancel`, `replan-confirm`, `plan-save`, `plan-export`, `nav-menu` | plan-*, chat-*, header-* |
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
| Lead | 源 EN：`Pick a place, sketch a day, and go — without the planning fog.` |
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
| location | 常用出发地 | 否 | text + 定位按钮 |
| password | 密码 | **是** | password |
| password_confirm | 确认密码 | **是** | password |
| interests | **出行兴趣（多选）** | 否 | chips（默认可全关） |

兴趣词表（固定）：**景点 · 美食 · 博物馆 · 公园 · 寺庙 · 夜市 · 购物 · 温泉 · 户外**

页顶说明：`标 * 为必填`（`play.register.required_note`）。  
提交：`创建账号`（`register-submit`）。链：`已有账号？登录`。

---

### 3.3 Login / Reset / Set password — `03`–`05`

| 页 | 要点 |
| --- | --- |
| Login | `.auth-card`：Email、Password；`Sign in`；Forgot / Register 链；成功进 `/plan` |
| Reset | Email → `Send reset link`；成功 `.callout.is-info`（`reset-sent`） |
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
| location | 常用出发地 | **是**（与 2eat personal / 行程出发一致） | text + 定位 + 旁路「重置密码」 |
| interests | **出行兴趣（多选）** | 否 | 同注册 9 chips |

头：`用户资料` + `上次保存 {time}`。  
提交：`保存资料`（`profile-save`）。  
删除文案（不得出现）：「轻量出行兴趣会带到规划器…」「点选常去的玩法（可多选）。」

实现须补：`register-required-note` + `is-required`（mock 若尚未标全，以本契约 + 2eat 个人信息页为准）。

---

### 3.5 Plan — `06-plan.html`（核心）

```text
┌─ page-title: 行程规划 ─────────────────────┐
│ panel: plan-board（三列，无分区大标题）      │
│ panel: 行程详情（Day tabs + Highlights + slots）│
│ panel: 行程助手（chat-shell）                 │
│ plan-actions: 重新规划 · 保存 · 导出 PDF     │
└──────────────────────────────────────────────┘
+ replan alertdialog（默认隐藏）
```

#### 3.5.1 规划器 `plan-board`

`.plan-board__grid`：

```text
grid-template-columns: var(--plan-col) var(--plan-col) minmax(0, 1fr);
gap: var(--plan-gap);
```

| 列 | 纵向字段（上→下，`space-between` 等分） |
| --- | --- |
| **A** `.plan-board__stack` | 目的地* → 类型(combo) → 预算(combo) |
| **B** `.plan-board__stack` | 天数*+人数(`.plan-pair`) → 节奏(combo) → 交通偏好(combo) |
| **C** `.plan-board__right` | 每日起点\|终点\|开始\|到\|结束 → **偏好与限制**块 |

| 字段 | 必填 | 备注 |
| --- | --- | --- |
| 目的地 | **是** | `plan-dest`；placeholder `城市 / 区域` |
| 天数 | **是** | 1–14；与人数并排 |
| 人数 | 否 | 1–20 |
| 类型 | 否 | combo 选项：城市漫游 / 情侣出游 / 家庭度假 / 个人放松 / 美食之旅；可自填 |
| 预算 | 否 | 经济 / 中等 / 舒适 |
| 节奏 | 否 | 紧凑 / 适中 / 轻松 |
| 交通偏好 | 否 | 捷运 + 步行 / 步行优先 / 打车 / 公交 + 步行 |
| 每日起点/终点 | 否 | 终点 placeholder：`可选，不填默认与起点同` |
| 开始/结束 | 否 | `type=time`；若都填则结束 > 开始 |
| 偏好 chips | 否 | 同兴趣词表；可 `data-interest` 枚举；可自定义输入 |
| 其他限制 | 否 | maxlength 500；**无**「（可选）」后缀文案 |

块标题：**偏好与限制**（唯一小标题，非「规划器」）。  
生成：`生成行程`（`plan-submit`），`form="plan-form"` 可放在板外 `.plan-board__actions`。

**校验：** 仅目的地、天数必填；天数 1–14；时间成对则结束>开始；错误用 `.field.is-invalid` + `.field-error`。

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

#### 3.5.3 Chat

- 标题：行程助手
- `.chat-shell` 高 `--chat-h`，最小 `--chat-min-h`
- transcript：agent / user bubbles（`chat-transcript`）
- composer：placeholder 示例改站；`发送`（`chat-send`）
- `.chat-resize`：仅高度；`chat-resize`；`aria-label` 拖动调整高度
- Replan 后：系统分隔泡（`chat-replan-divider`）

#### 3.5.4 底栏与对话框

| 控件 | 样式 | testid |
| --- | --- | --- |
| 重新规划 | `btn-danger` | `replan-open` |
| 保存 | `btn-quiet` | `plan-save` |
| 导出 PDF | primary | `plan-export` |

对话框文案源：标题「重新规划？」；说明「将删除当前未保存的行程，并生成一条新行程。本机对话会保留，并在聊天中加入分隔提示。」；取消 / 确定重新规划。

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
- [ ] Plan：三列板；无分区大标题；combo 全量选项；slot 时间列 = `--plan-col`
- [ ] Chat 内嵌非 FAB；resize 仅高
- [ ] Replan 确认 + 分隔泡；保存提交行程+对话；Saved 多卡；详情只读 DB 对话
- [ ] 四 locale catalogs；reduced-motion 关闭飞行动画

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