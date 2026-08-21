# where2play — 用户故事

**where2play**（`where2play.place`）产品 backlog 与验收标准（AC）。

| Related | Location |
| --- | --- |
| 产品规格 | [`2play-prod-specs.md`](./2play-prod-specs.md) |
| 设计规范 | [`2play-design.md`](./2play-design.md) |
| 页面契约（设计 §3） | [`2play-design.md`](./2play-design.md) |
| 测试计划 | [`2play-test-plan.md`](./2play-test-plan.md) |
| UI mock-up | [`ui-mockup/`](./ui-mockup/) |
| 家族架构 | [`../../workspace-specs/2.architecture.md`](../../workspace-specs/2.architecture.md) |
| 行程引擎归属 | [`../../workspace-specs/adr/ADR-008-itinerary-ownership.md`](../../workspace-specs/adr/ADR-008-itinerary-ownership.md) |
| places-agent | [`../../1.places-agent/agent-specs/`](../../1.places-agent/agent-specs/) |

**状态：** draft — 与 [`ui-mockup/`](./ui-mockup/) 当前 mock-up 及 [`2play-prod-specs.md`](./2play-prod-specs.md) 对齐。格式参照 what2eat [`2eat-stories.md`](../../2.what2eat/2eat-specs/2eat-stories.md)。

## 人物角色

| 角色 | 谁 | 价值 |
| --- | --- | --- |
| 休闲出行者 | 已登录用户 | 快速得到**一条**可执行多日行程并在页内改 |
| 新访客 | 公开首页访客 | 了解产品并创建账号 |
| 回访用户 | 有 Profile / 已保存行程的用户 | 用兴趣预填偏好；打开旧行程与对话快照 |

## 术语

| 术语 | 含义 | 不是 |
| --- | --- | --- |
| **场所事实** | 名称、地址、时段、配图等，经 places-agent 来自 map vendors | Agent 建议文案或用户偏好 |
| **行程边界** | Plan 表单字段（目的地、天数、节奏、偏好…） | Profile 里的轻量兴趣 |
| **出行兴趣** | Profile/注册上的多选偏好；可带到规划器预填 | 当次行程全部边界 |
| **当前行程** | Plan 页中部展示的唯一一条 Day/Hour 行程 | 多卡短名单 |
| **Chat 草稿** | Plan 会话 transcript；真源 = localStorage | 每轮自动写库 |
| **已保存快照** | 用户点「保存」时写入 App DB 的行程 + 当时对话 | 未保存跨设备同步 |
| **重新规划** | 确认后丢弃未保存行程、生成新一条；保留本机对话并插入分隔 | 删除已保存行程记录 |

## MVP 计划

四个切片。每个 MVP 是**可独立交付的完整功能集**，各自 E2E 签收。**MVP DoD 禁止**用假行程冒充 live 规划结果（MVP-2 起须真实 places-agent / vendor 路径，除非切片明确允许 sandbox）。一次交付一个 user story 至 DoD（`incremental-delivery`）。

| 切片 | 成果 | Features | E2E 旅程（摘要） | 状态 |
| --- | --- | --- | --- | --- |
| **MVP-1** | Onboarding：shell、home、account、profile | **1–13** | 访客注册 → 保存资料与兴趣 → 登出/登录 → 资料持久；locale EN→CN | **To-do** |
| **MVP-2** | Plan 主路径 + 保存行程 + 我的行程 | **14–22** + `plan-07` AC1 | 已登录提交多日边界 → **一条** Day/Hour → 保存（可无对话）→ 我的行程多卡 → 打开详情 | **To-do** |
| **MVP-3** | 页内 Chat 双存储 | **23–26**（`plan-07` AC2–3） | Chat 改当前行程（local 草稿）→ 刷新仍在 → 保存后 DB 有对话快照 → 详情只读对话；登出清 local | **To-do** |
| **MVP-4** | Replan + PDF + Chat 高度 | **27–29** | 重新规划确认 → 新行程 + 分隔泡 + 对话保留；导出 PDF；拖拽调高 chat | **To-do** |

**构建顺序：** MVP-1 → MVP-2 → MVP-3 → MVP-4。  
**MVP-1 说明：** 无 places-agent 硬依赖。真实 App DB + session。邮件用 Resend sandbox / dev outbox。  
**MVP-2 说明：** BFF HTTP 调 places-agent；主路径每次**一条**行程；配图来自 agent；**「保存」提交行程快照到 App DB**（`messages` 可为空 `[]`）；我的行程多卡/详情以 Day/Hour 为主，**不要求**对话区。  
**MVP-3 说明：** Chat 经 BFF → agent；草稿 localStorage；同一次「保存」须提交截至当时的 `messages`；详情只读 DB 对话。  
**MVP-4 说明：** Replan 确认文案与分隔（真源：mock `06-plan.html` / design §3.5.4）；PDF 基于当前行程事实；chat resize 仅高度。

---

# 第一部分 — 产品 backlog

| 编号 | 模块 | Feature code | 功能名 | 功能描述 | Story | MVP | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Header | `header-01` | App header & navigation | Sticky header：logo、行程规划 / 我的行程 / 个人信息、active、移动 Menu | [§1](#1-header-header-01--app-header--navigation) | **MVP-1** | To-do |
| 2 | Header | `header-02` | 已登录用户 chrome | 问候、avatar、登出 | [§2](#2-header-header-02--signed-in-user-chrome) | **MVP-1** | To-do |
| 3 | Header | `header-03` | Locale switcher (app) | EN / CN / HK / TW | [§3](#3-header-header-03--locale-switcher-app) | **MVP-1** | To-do |
| 4 | Footer | `footer-01` | Family footer (app) | places.family 行（App 底纹） | [§4](#4-footer-footer-01--family-footer-app) | **MVP-1** | To-do |
| 5 | Footer | `footer-02` | Family footer (public) | places.family 行（公开页） | [§5](#5-footer-footer-02--family-footer-public) | **MVP-1** | To-do |
| 6 | i18n | `i18n-01` | Four-locale catalogs | 全部用户可见字符串为 key；四 locale | [§6](#6-i18n-i18n-01--four-locale-catalogs) | **MVP-1** | To-do |
| 7 | Home | `home-01` | Public landing | Headline、lead、注册/登录 CTA | [§7](#7-home-home-01--public-landing) | **MVP-1** | To-do |
| 8 | Account | `account-01` | Register | 创建账号：必填姓名/邮箱/密码；选填性别年龄出发地兴趣 | [§8](#8-account-account-01--register) | **MVP-1** | To-do |
| 9 | Account | `account-02` | Sign in | 邮箱密码登录；失败提示 | [§9](#9-account-account-02--sign-in) | **MVP-1** | To-do |
| 10 | Account | `account-03` | Reset password | 请求重置邮件 | [§10](#10-account-account-03--reset-password) | **MVP-1** | To-do |
| 11 | Account | `account-04` | Set password | 从链接设新密码；过期态 | [§11](#11-account-account-04--set-password) | **MVP-1** | To-do |
| 12 | Profile | `profile-01` | User profile | 单卡：资料 + 出行兴趣（多选）；独立保存 | [§12](#12-profile-profile-01--user-profile) | **MVP-1** | To-do |
| 13 | Profile | `profile-02` | Required-field markers | 个人信息必填项标 `*` 与说明 | [§13](#13-profile-profile-02--required-field-markers) | **MVP-1** | To-do |
| 14 | Plan | `plan-01` | Planner form | 三列边界表单；生成一条行程 | [§14](#14-plan-plan-01--planner-form) | **MVP-2** | To-do |
| 15 | Plan | `plan-02` | Planner validation | 目的地/天数必填；天数范围；时间成对校验 | [§15](#15-plan-plan-02--planner-validation) | **MVP-2** | To-do |
| 16 | Plan | `plan-03` | Itinerary day/hour view | Day tabs、Highlights、时段行、交通段、配图与外链 | [§16](#16-plan-plan-03--itinerary-dayhour-view) | **MVP-2** | To-do |
| 17 | Plan | `plan-04` | Single itinerary only | 每次规划/重新规划只交付一条；无多卡短名单 | [§17](#17-plan-plan-04--single-itinerary-only) | **MVP-2** | To-do |
| 18 | Plan | `plan-05` | Prefill from interests | Profile 出行兴趣可预填 Plan 偏好 chips | [§18](#18-plan-plan-05--prefill-from-interests) | **MVP-2** | To-do |
| 19 | Plan | `plan-06` | Combo full options | 自定义 combo 展开始终列出全部选项 | [§19](#19-plan-plan-06--combo-full-options) | **MVP-2** | To-do |
| 20 | Saved | `saved-01` | Saved trips grid | 仅已保存多卡；空态 | [§20](#20-saved-saved-01--saved-trips-grid) | **MVP-2** | To-do |
| 21 | Saved | `saved-02` | Open saved trip | 详情 Day/Hour；无未保存 History | [§21](#21-saved-saved-02--open-saved-trip) | **MVP-2** | To-do |
| 22 | Saved | `saved-03` | Unsave trip | 从详情取消收藏 | [§22](#22-saved-saved-03--unsave-trip) | **MVP-2** | To-do |
| 23 | Chat | `chat-01` | In-page plan chat | Plan 下方唯一 Chat；随动改当前行程 | [§23](#23-chat-chat-01--in-page-plan-chat) | **MVP-3** | To-do |
| 24 | Chat | `chat-02` | Local draft transcript | 回合写入 localStorage；刷新保留；登出清除 | [§24](#24-chat-chat-02--local-draft-transcript) | **MVP-3** | To-do |
| 25 | Plan | `plan-07` | Save itinerary + chat | MVP-2：保存行程（`messages` 可 `[]`）；MVP-3：保存含对话快照 | [§25](#25-plan-plan-07--save-itinerary--chat) | **MVP-2→3** | To-do |
| 26 | Saved | `saved-04` | DB chat snapshot | 打开已保存行程可读 DB 对话；只读提示 | [§26](#26-saved-saved-04--db-chat-snapshot) | **MVP-3** | To-do |
| 27 | Plan | `plan-08` | Replan with confirm | 确认后换新行程；保留 local chat + 分隔提示 | [§27](#27-plan-plan-08--replan-with-confirm) | **MVP-4** | To-do |
| 28 | Plan | `plan-09` | Export PDF | 基于当前行程事实导出；不编造场所 | [§28](#28-plan-plan-09--export-pdf) | **MVP-4** | To-do |
| 29 | Chat | `chat-03` | Chat height resize | SE 把手仅调整高度；尊重最小高度 | [§29](#29-chat-chat-03--chat-height-resize) | **MVP-4** | To-do |

Backlog 为 **features 1–29**。明确不在范围：SSO、双 Chat/FAB、一次多行程短名单、未保存 History、下单支付、浏览器持有 map/caller/LLM 密钥。

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
- **AC3:** 给定我已登录，当我选择登出，则会话结束并回到公开首页，且本机 `w2p.chat.*` 被清除。

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

- **AC1:** 给定我在行程规划页，当页面加载，则规划器为三列布局（目的地/类型/预算 | 天数人数/节奏/交通 | 每日起终点时段 + 偏好与限制），且无「规划器」大段分区标题。
- **AC2:** 给定有效边界（至少目的地与天数），当我选择生成行程，则中部展示**一条**行程详情（含更新日期）。
- **AC3:** 给定偏好与限制，当我操作，则可见偏好 chips 与「其他限制」自由文本（无「（可选）」后缀文案）。

---

## 15. Plan · `plan-02` — Planner validation

**用户故事 — 提交前得到清晰校验**

作为用户，我希望必填与非法输入被拦住并标出字段，以便改正后生成。

- **AC1:** 给定目的地为空，当我生成，则目的地显示错误且不调用成功规划。
- **AC2:** 给定天数为空或不在 1–14，当我生成，则天数显示错误。
- **AC3:** 给定开始与结束时间都填写且结束不晚于开始，当我生成，则时间字段显示错误。

---

## 16. Plan · `plan-03` — Itinerary day/hour view

**用户故事 — 按日与时段阅读行程**

作为用户，我希望按 Day 查看 Highlights 与 Hour 行（含交通段、缩略图、详情/地图外链），以便执行当天安排。

- **AC1:** 给定一条多日行程，当我切换 Day tab，则只显示对应日内容。
- **AC2:** 给定场所时段，当渲染，则显示时段区间、场所名、说明，并提供详情与地图外链（新标签）。
- **AC3:** 给定交通段，当渲染，则使用交通样式且无场所缩略图要求。
- **AC4:** 给定场所缩略图，当布局，则时间列宽与规划器「天数」列同宽约定（`--plan-col`），缩略图左缘对齐该列输入。

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

- **AC1:** 给定已有当前行程，当我发送有效修改请求且助手成功，则中部行程随动更新。
- **AC2:** 给定 App，当我寻找 Chat，则仅在 Plan 页内嵌入口存在（无全局 FAB 第二入口）。

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
- **AC2 (MVP-3):** 给定当前行程与若干 chat 消息，当我保存成功，则 DB 含截至当时的对话快照。
- **AC3:** 给定保存后我又继续聊天，当我未再次保存，则 DB 快照仍为上次保存点；local 为更新真源。

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
- **AC4:** 给定 replan 请求，当发送，则携带截断后的 chat 上下文供 agent 尊重已聊约束。

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

# 附录 — 与 mock / 产品规格对照

| 主题 | 真源 |
| --- | --- |
| 视觉与 DOM | [`ui-mockup/`](./ui-mockup/) + [`2play-design.md`](./2play-design.md) §1/§3 |
| 产品边界 | [`2play-prod-specs.md`](./2play-prod-specs.md) |
| 兴趣标签文案 | 「出行兴趣（多选）」；无两段已删说明 |
| 性别 | 注册/资料均非必填 |
| Chat 真源 | 草稿 local；保存时 DB |
| 主路径 | 每次一条行程 |

**下一步：** 用户确认本 backlog 与 AC 后，按 MVP-1 → … 用 **tdd** 技能逐 story 红绿重构；实现 UI 以 mock + `2play-design.md` 为 100% 对齐标准。
