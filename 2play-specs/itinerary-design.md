# where2play — 行程生成与 Progressive UX

**Scope:** Plan 页「生成行程」的 L1 Discover → L2 Arrange 管线、BFF NDJSON 事件、Progressive UI 四段命名与动效。  
**Related:** [`2play-design.md`](./2play-design.md) §2.4 / §3.5 · [`2play-stories.md`](./2play-stories.md) · [ADR-037](../../workspace-specs/adr/ADR-037-where2play-plan-l2-quanzil.md) · [ADR-032](../../workspace-specs/adr/ADR-032-llm-itinerary-mcp-tool-split.md) · [performance.md §3](../../1.places-agent/agent-specs/performance.md) · [ADR-038](../../workspace-specs/adr/ADR-038-discover-places-quality.md)

**Status:** Accepted（§11-P0 Progressive **已实现**；Mode H + enrich **as-built 2026-08-23**；**MVP-10 目标态** §1.3 / §16–17 **方案已确定 2026-08-31**；跨产品契约见 [ADR-043](../../workspace-specs/adr/ADR-043-chatbox-mcp-and-cross-product-closure.md)）

---

## 1. 架构真源（ADR-037 + ADR-043）

### 1.1 当前已落地（as-built，2026-08-23）

```text
L1  Discover     places-agent  POST /v1/discover_places（地图，无 LLM；热门=POPULARITY+模板，ADR-043）
L2  Prompt       places-agent  POST /v1/arrange_day execution=host（本请求不调 agent LLM）
L2  Execute      where2play    OPENAI_CN 执行 system/user prompt → 日 JSON（含 start_time）
L3  Transit      places-agent  POST /v1/enrich_arrange_transit → legs_to_here
                 UI            NDJSON 逐步揭示（slot 含时刻 + transit）
```

主路径 **不**调用 agent `arrange_day` execution=agent。  
**ChatBox MCP** 另通道：强制 agent（时刻+腿同响应）— 见 ADR-043；**不是** 2play 路径。

### 1.2 历史「目标态」说明

原 `plan-11` / `plan-13` 目标（Mode H prompt + 真 transit）**已落地为 §1.1**。下文「目标」措辞若仍出现，以 §1.1 为准。

### 1.3 目标态（MVP-10 / plan-46，方案已确定 2026-08-31）

**真源：** places-agent [`performance.md §12`](../../1.places-agent/agent-specs/performance.md) · [`0.refactor-plan.md` 批次 11](../../1.places-agent/agent-specs/0.refactor-plan.md) · 本文件 §16–17 · [`2play-design.md §4`](./2play-design.md) · UI mock `ui-mockup/06-plan*.html`。

```text
L1  Discover     places-agent  POST /v1/discover_places（不变）
L2  Skeleton     places-agent  POST /v1/make_itinerary（NDJSON：skeleton_start → skeleton_day × N → skeleton_done）
L3  Fill         places-agent  循环 plan_next_stop + display_current_stop（串行 transit + 富信息，零 LLM）
                 UI            起点 = 标准 Stay stop → transit 行 → 景点 stop；真逐 stop 上屏（非 staged sleep）
```

**退役：** BFF 本地 OPENAI_CN arrange（§5）、`enrich_arrange_transit` 独立调用、假 progressive（§5.4 staged sleep）。**迁移：** F42 校验 → agent Feature 44 填充层。

---

## 2. Progressive UI — 四段命名

生成进行中，Plan 页中部按职责分为四段（与 mock / 实现 class 对齐）：

| 命名 | DOM / testid | 职责 | 变更 |
| --- | --- | --- | --- |
| **行程日提示** | `.plan-phase.is-busy` · `plan-phase` | 整趟大进度：「正在安排第 d/N 天…」 | **保持现状** |
| **行程细节提示** | `.plan-slot-preview` · `plan-slot-preview` | **当前正在生成**的那一条（景点 / 交通 / 餐） | 替换原「候选池 P 处 · 本趟已选用 U 处」 |
| **行程** | `.slot` / `.slot--transit` · `plan-itinerary` | 已落地的单行站点 | **一次只追加一条** |
| **加载中提示** | `.slot--pending` · `plan-slot-pending` | 下一条落地前的占位 | **同构 skeleton**，非虚线框 |

```text
┌─ 行程日提示 ─────────────────────────────────────────┐
│ 正在安排第 2/3 天…          [ 正在生成第 2/3 天… ]   │
├─ 行程细节提示 ───────────────────────────────────────┤
│ 正在加入行程：大雁塔，入选原因：…，预计游览时间：…     │
├─ 行程面板 ───────────────────────────────────────────┤
│ Day tabs · Highlights · [slot][slot][slot]…          │
│ [ 加载中提示 — skeleton 与 slot 同宽同构 ]             │
└──────────────────────────────────────────────────────┘
```

**LLM 等待期（首个 `slot_preview` 前）：** 行程细节提示用 `play.plan.arrange_planning_day`（「正在规划第 d/N 天…」），**不**再显示候选池统计为主文案。

---

## 3. 行程细节提示 — 文案契约（i18n）

所有用户可见句为 **i18n key**（CN / TW / HK / EN）。BFF 发结构化 `slot_preview`，UI 选模板插值。

| `slot_preview.kind` | i18n key | 参考（CN） |
| --- | --- | --- |
| `place` | `play.plan.preview_place` | 正在加入行程：{name}，入选原因：{reason}，预计游览时间：{window} |
| `transit` | `play.plan.preview_transit` | 正在安排下一段行程的交通：{label}，选择原因：{reason}，预计耗时：{duration} |
| `meal` | `play.plan.preview_meal` | 正在安排{meal}，推荐：{name}，推荐原因：{reason}，预计用餐时间：{window} |

**餐段 `meal` 映射：**

| block.type / 规则 | i18n 餐段 |
| --- | --- |
| `lunch` | 午餐 |
| `dinner` | 晚餐 |
| `cafe` | 下午茶 |
| `lunch` 且 start ≥ 15:00 | 下午茶 |

**`slot_preview` payload（BFF → UI）：**

```ts
type SlotPreview = {
  kind: "place" | "transit" | "meal";
  name: string;
  reason: string;
  window: string;           // "09:30–11:00" 或 "~15 min"
  mealLabel?: "lunch" | "afternoon_tea" | "dinner";
  transportLabel?: string;  // 如「捷运 + 步行」
};
```

---

## 4. BFF NDJSON 事件

在 [`plan-day-by-day.ts`](../src/core/plan-day-by-day.ts) `PlanProgressEvent` 上扩展（保留 `place` 为 `slot` 的 deprecated alias）。

| `type` | 何时 | UI |
| --- | --- | --- |
| `phase` | discovering / arranging | 行程日提示；表单 `.is-dimmed` |
| `candidate_place` | discover 流 | Discover 同态候选 |
| `discover_done` | L1 结束 | （可选）内部计数；**不作** arrange 主文案 |
| `arrange_day_start` | 日开始 | 预建 Day tabs；触发「规划当日…」 |
| `day_highlights` | theme 已知 | Highlights 骨架 |
| **`slot_preview`** | **每条 slot 落地前** | **行程细节提示** |
| **`slot`** | **每条 slot 落地** | **行程** +1 |
| `place` | alias of `slot` | 兼容旧客户端 |
| `day_done` / `progress` | 日完成 | 刷新 itinerary；自动切下一 Day tab |
| `done` | 全部完成 | Updated；去掉 progressive 壳 |
| `error` | 失败 | i18n key |

**顺序（单日）：** `arrange_day_start` → `day_highlights` → (`slot_preview` → `slot`)\* → `day_done`。

---

## 5. L2 管线（BFF）

### 5.1 拉 prompt（Mode H）

**目标（P1 / `plan-11`）：**

1. `POST` places-agent `/v1/arrange_day`，`execution: "host"`  
2. 响应：`{ execution: "host", system_prompt, user_prompt, output_contract, candidates_slim }`  
3. Agent **不**在本请求内调用 OPENAI_CN（agent Feature **35** 已支持）

**当前 as-built（2026-08-23）：** BFF [`fetchArrangeHostPrompts`](../src/core/plan-arrange-llm.ts) → `POST /v1/arrange_day` `execution: "host"`；本地 [`buildArrangeDayMessages`](../src/core/plan-arrange-llm.ts) **仅单测**。W2d live 签收前勿标 MVP-3 Done。

### 5.2 OPENAI_CN 执行

- BFF `OPENAI_*` → OPENAI_CN `chat/completions`（与行程助手同源，[ADR-036](../../workspace-specs/adr/ADR-036-where2play-assistant-quanzil.md)）
- **AbortSignal 110s**（[ADR-032](../../workspace-specs/adr/ADR-032-llm-itinerary-mcp-tool-split.md)）→ `errors.arrange_timeout`
- **P2：** `stream: true`，增量 parse JSON blocks，首个 block 尽早 `slot_preview`
- **P0：** 非流式等满 JSON → 解析后 **逐步** emit（见 §5.4）

### 5.3 统一 slot 序列

导出 **`expandArrangeDayToSlots(blocks, criteria, dayMeta)`**（[`itinerary-map.ts`](../src/core/itinerary-map.ts) 复用 `mapLlmDayBlocks` + 首尾交通合成）。

- Progressive `slot` 与 `day_done` 的 `itinerary.days[].slots` **必须同一函数**，避免最终跳变
- 交通：日首 `from_origin`、日尾 `to_destination`、站间合成（与 `criteria.transport` 一致）

### 5.4 逐步节奏

每对 `slot_preview` → `slot`：

- BFF `await sleep(380ms)`（可 env 配置；仅 post-parse staged 路径）
- UI **reveal 队列**：同帧收到多条时仍逐条展示
- `prefers-reduced-motion: reduce`：无 delay、无 shimmer

### 5.5 L2 业务约束（ADR-038 P0）

- 一日一主题；同区连游；禁止同日堆同一 landmark cluster
- 理由可含估计步行/打车（不调 navigate）
- 跨天 `exclude_names` / `usedNames` 收缩候选

---

## 6. UI 实现要点

**文件：** [`plan-page.tsx`](../src/ui/plan-page.tsx) · [`plan-itinerary-view.tsx`](../src/ui/plan-itinerary-view.tsx) · [`app/mockup.css`](../app/mockup.css)

| 项 | 行为 |
| --- | --- |
| 行程日提示 | 不变：`.plan-phase.is-busy` + 钮 `.is-generating` |
| 行程细节提示 | `slotPreview` state；`slot_preview` 更新；`.plan-slot-preview` |
| 行程 | `liveSlots` 每次 +1；`day_done` 前仅 live，完成后 merge itinerary |
| 加载中提示 | `dayPending`；`.slot--pending` skeleton（见 §7） |
| 删除 | arrange 阶段 `arrange_pool_summary` **作主文案** |

**切日：** `day_done` 后 `focusDayIndex = min(dayIndex + 1, daysTotal)`；未排日 tab `Day k · 排队`（`play.plan.day_n_queued`）。

---

## 7. 加载中提示 — 视觉（Frontend Design）

**问题：** 现行虚线框 + 单行「下一站加载中」与真实 `.slot` 脱节。

**方案：** `.slot--pending` 与 `.slot` **同构 skeleton**：

```text
[ 时间列 shimmer ] [ thumb 占位 ] [ 两行骨架条 ]
                  下一站加载中（小字，非主视觉）
```

- 微光扫过 `--glaze` 8% 透明度；**不用**灰色虚线大框
- 与上一条 `.slot.is-entering` 间距一致
- `aria-busy="true"` · `data-testid="plan-slot-pending"`
- `prefers-reduced-motion`：静态占位，无 shimmer / pulse

**等待动效（已有，保持）：**

- `.plan-phase.is-busy` — 文案 pulse
- `.btn.is-generating` — 绿钮呼吸光
- 不增加 indeterminate 进度条

Mock SoT 同步：[`ui-mockup/06-plan-skeleton.html`](./ui-mockup/06-plan-skeleton.html)（MVP-10；legacy arrange mock 已删除）。

---

## 8. 数据流

```mermaid
sequenceDiagram
  participant UI
  participant BFF as where2play_BFF
  participant Agent as places_agent
  participant LLM as OPENAI_CN

  UI->>BFF: POST /api/plan Accept NDJSON
  BFF->>Agent: discover_places NDJSON
  Agent-->>BFF: candidate_place*
  BFF-->>UI: candidate_place / discover_done

  loop each dayIndex
    BFF->>Agent: arrange_day execution=host
    Agent-->>BFF: system_prompt user_prompt
    BFF-->>UI: day_highlights
    BFF->>LLM: chat completions stream=true
    BFF->>Agent: enrich_arrange_transit
    Agent-->>BFF: legs_to_here transit_outcome
    loop each slot
      BFF-->>UI: slot_preview
      BFF-->>UI: slot
    end
    BFF-->>UI: day_done
  end
  BFF-->>UI: done
```

---

## 9. places-agent 能力（Mode H）— **已交付**

| 项 | 内容 | 状态 |
| --- | --- | --- |
| HTTP | `POST /v1/arrange_day` + `execution: "host"` | **Done**（agent Feature **35**） |
| 响应 | `{ execution, system_prompt, user_prompt, output_contract, candidates_slim }` | **Done** |
| 共享 | `buildSchedulePrompt` — MCP Mode H 与 HTTP 共用 | **Done** |
| 测试 | host 路径零 OpenAI（TC-M8-H35 / M35） | **Done** |

**2play 增量（`plan-11`）：** BFF 已改调上述 host 接口；本地 `buildArrangeDayMessages` 仅测试保留。

---

## 10. 分期交付

| 阶段 | 内容 | 验收 | 状态 |
| --- | --- | --- | --- |
| **P0** | `expandArrangeDayToSlots` + `slot_preview`/`slot` + 四段 UI + pending + i18n | 逐步揭示；细节提示随 kind | **已实现** |
| **P1** | **2play** 改拉 agent `execution=host` prompt（**MVP-3** / `plan-11`） | Prompt 单一真源；去掉本地 duplicate；地标 + 交通偏好 | **Implemented**（W2a；live AC3→W2d） |
| **P2** | OPENAI_CN `stream: true` + 增量 JSON parse（**MVP-3** / `plan-12`） | 首个 `slot_preview` 在整日 JSON 完成前 | **Implemented**（W2c） |
| **P1b** | 真 transit 消费（**MVP-3** / `plan-13`） | `legs_to_here`；非一律 15min | **Implemented**（W2b） |

**建议实施顺序：** P0 ✓ → **P1（2play）** → P2。

---

## 11. 测试

| 层 | 内容 |
| --- | --- |
| Agent | `buildSchedulePrompt` 快照；`execution=host` 无 LLM 调用 |
| BFF | mock prompt + mock OPENAI_CN → `slot_preview` 先于 `slot`；`expandArrangeDayToSlots` 含 transit |
| UI | preview 文案随 kind；一次只多一条 slot；reduced-motion 无动画 |
| E2E | 生成行程：细节提示变化；pending skeleton 可见 |

契约测：**不得**断言 agent `/v1/arrange_day` **execution=agent** 为 2play 默认路径（ADR-037）。**MVP-3** 起须断言每日 **execution=host** 被调用（mock 或 spy）。

---

## 12. 范围外

- Token 级在 UI 展示 LLM 原文
- 候选池统计作为 arrange 主文案
- 默认回退 agent `arrange_day` execution=agent
- Indeterminate 进度条
- 并行多日 arrange
- 生成前编辑候选

---

## 13. i18n 键清单（新增 / 变更）

| Key | 用途 |
| --- | --- |
| `play.plan.arrange_planning_day` | LLM 等待期行程细节提示 |
| `play.plan.preview_place` | 景点 |
| `play.plan.preview_transit` | 交通 |
| `play.plan.preview_meal` | 餐厅（含 {meal} 餐段） |
| `play.plan.meal_lunch` / `meal_afternoon_tea` / `meal_dinner` | 餐段标签 |
| `play.plan.next_stop_loading` | pending 小字（已有，保留） |

**Deprecated 作主文案：** `play.plan.arrange_pool_summary`（可保留作调试或 LLM 前一行小字，默认隐藏）。

---

## 14. 实现文件索引

| 区域 | 路径 |
| --- | --- |
| BFF 编排 | [`src/core/plan-day-by-day.ts`](../src/core/plan-day-by-day.ts) |
| L2 OPENAI_CN | [`src/core/plan-arrange-llm.ts`](../src/core/plan-arrange-llm.ts) |
| Slot 映射 | [`src/core/itinerary-map.ts`](../src/core/itinerary-map.ts) |
| Plan UI | [`src/ui/plan-page.tsx`](../src/ui/plan-page.tsx) · [`src/ui/plan-itinerary-view.tsx`](../src/ui/plan-itinerary-view.tsx) |
| 样式 | [`app/mockup.css`](../app/mockup.css) · [`ui-mockup/assets/mockup.css`](./ui-mockup/assets/mockup.css) |
| Agent prompt | `1.places-agent`（P1） |

---

## 15. 与 `2play-design.md` 的关系

- **本文件：** 行程生成 **管线 + Progressive 四段 UI + 事件契约** 的专项设计（Mode H / ADR-037）。
- **`2play-design.md` §2.4.1 / §3.5.3：** 页面级摘要与 mock 索引；细节以 **本文件为准**。
- **`2play-stories.md` `plan-10`：** 可验收 AC；**`2play-test-plan.md` §5.4：** 测试矩阵。
- 冲突时：**mock 视觉** > 本文件 **交互契约** > `2play-design` 摘要。

---

## 16. §12 轻骨架重构迁移（MVP-10 plan-46，方案已确定 2026-08-31）

**真源：** places-agent [`performance.md §12`](../../1.places-agent/agent-specs/performance.md)；where2play [`2play-design.md §4`](./2play-design.md)（页面/助手/表单/Travor UI）；UI mock `06-plan*.html` + `assets/mockup-travor.css`。

### 16.1 管线替换

| 现（本文件 §5 L2 管线，as-built） | 新（MVP-10 目标） |
| --- | --- |
| BFF 本地 `buildArrangeDayMessages` + OPENAI_CN 等满日 JSON | agent `make_itinerary` NDJSON 流式骨架 |
| 解析后 staged `slot_preview`/`slot`（§5.4 sleep 假 progressive） | 骨架预览 → 循环 `plan_next_stop` + `display_current_stop` **真逐 stop** |
| `enrich_arrange_transit`（BFF 调 agent） | 吸收进 `plan_next_stop`（agent 侧串行 directions） |
| 起点藏在 `from_origin` transit 单行 | **起点 = 第一站标准 Stay stop 卡片**（§17.1） |

### 16.2 BFF NDJSON 事件（目标）

在 §4 四段命名不变前提下，事件载荷替换：

| 事件 | 时机 | 载荷要点 |
| --- | --- | --- |
| `skeleton_start` | make_itinerary 开始 | `{ total_days }` |
| `skeleton_day` | 骨架流式每完成一日 | `{ day_index, day_theme, stops: [{ name, kind, meal_slot? }] }` — **无时间** |
| `skeleton_done` | 骨架 LLM 结束 | `{ days_count }` |
| `stop_filled` | 每次 display_current_stop 完成 | `{ day_index, stop_index, stop, legs_to_here?, time_start?, time_end? }` |
| `day_done` | 当日末 stop 填充完 | `{ day_index }` |
| `itinerary_done` | 全程结束 | `{ outcome }` |

**废弃（MVP-10 后）：** 整日 `slot_preview`/`slot` 批量 staged 事件；`plan-phase` 仍可保留「第 d/N 天」busy 文案，但不再绑定整日 LLM 等待。

### 16.3 渐进语义变化

- **保留：** 四段命名（行程日提示 / 细节提示 / 行程 / 加载中）、pending 同构 skeleton、`is-entering` 入场、reduced-motion。
- **变化：** 粒度从「slot（整日 LLM 完成后 staged）」→ **「stop（骨架后真实逐个填充）」**；每次 `stop_filled` 对应一次真实 `plan_next_stop` 完成。
- **骨架预览：** 助手内 day-by-day stop 名称列表（无时间）；行程主列表直接 pending + 已填充 stop，不重复长文本骨架。
- **时间回填：** 骨架无时间；stop 上屏时由上一 stop 结束 + transit 时长推算（agent Feature 44）。

### 16.4 F42 校验迁移

站间时序、同日餐厅去重、day-trip 补搜、午间窗口软提示 — 从 2play `plan-arrange-llm.ts` 重试回路迁至 agent `plan_next_stop`/`display_current_stop`（Feature 44）。2play 仅透传 agent 的 `transit_outcome` 与错误码。

### 16.5 测试影响

- 删除/替换：`plan-arrange-llm.test.ts` 中 2play 侧时序/去重重试 → agent 侧 TC-M10-44-*。
- 更新：`plan-day-by-day` 事件测试 → 断言 `skeleton_day` / `stop_filled` 序列。
- E2E（TC-M10-*）：生成 → 骨架预览 → 逐 stop 上屏 → 完成态；助手 8 步含默认跳过；起点 Stay stop + transit 单行格式（§17.2）。

---

## 17. Stop / Transit 展示契约（MVP-10 UI，mock 定稿）

**真源：** `ui-mockup/06-plan-skeleton.html` · `assets/mockup-travor.css` · [`2play-design.md §4.7`](./2play-design.md)。

### 17.1 起点 stop（Stay）

- 酒店/住宿作为 **第一站标准 stop 卡片**（`data-testid="stop-origin"`），与景点 stop 同构：序号、名称、kind=Stay、时段、HIGHLIGHTS。
- **禁止** 仅把酒店塞在 transit 行的「出发 · 酒店 → …」里；transit 行只连接 **已上屏的两站**。

### 17.2 Transit 行（站间）

单行文案模式（i18n 模板，非硬编码）：

```text
从 · {from_name} 前往 · {to_name}：[{mode}|{duration}|{cost}] / [{mode}|{duration}|{cost}]
```

- `{from_name}` / `{to_name}` 加粗（`.transit-place`）；双 mode 用 `/` 分隔；每段为 pill（`.transit-option`：方式 | 时长 | 费用档位）。
- 背景透明/暖色，**不用** 独立蓝色 transit 盒。
- 无 directions 时：i18n 降级文案 + `transit_outcome: partial|heuristic`，不伪造精确分钟。

### 17.3 列表顺序（单日）

```text
[Stay 起点 stop] → [transit 行] → [stop 1] → [transit] → [stop 2] → … → [pending skeleton 行…]
```

### 17.4 Panel 操作与阶段 meta

- **Panel 头右侧：** 重新规划 / 保存行程 / 导出 PDF（`panel__head-actions`）；无底部 sticky 操作条。
- **阶段 meta 左对齐：** `骨架 HH:MM · 填充中`（`plan-phase__meta`），与 day tabs 同区。

### 17.5 自动化选择器（E2E / Playwright）

| 区域 | 选择器 |
| --- | --- |
| 起点 stop | `[data-testid="stop-origin"]` |
| 已填充 stop | `[data-testid="stop-filled"]` 或 `.slot:not(.slot--pending)` |
| Pending | `.slot--pending` |
| Transit 行 | `.transit-line` |
| 助手展开 | `[data-testid="plan-nav-panel"]` |
| 起飞 CTA | `[data-testid="plan-takeoff-submit"]` |
