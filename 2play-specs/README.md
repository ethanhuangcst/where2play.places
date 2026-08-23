# where2play — 规格

出行 / 游玩产品（`where2play.place`）。

**产品规格：** [`2play-prod-specs.md`](./2play-prod-specs.md)  
**设计规格：** [`2play-design.md`](./2play-design.md)（§1 视觉 + §2 架构/技术设计 + §3 逐页契约；与 mock 同步，实现须 100% 对齐）  
**行程生成 / Progressive UX：** [`itinerary-design.md`](./itinerary-design.md)（MVP-2 as-built：discover + 本地 prompt + OPENAI_CN；**MVP-3** 目标：Mode H host prompt + 真交通 + 地标）  
**用户故事 / AC：** [`2play-stories.md`](./2play-stories.md)（ATDD；格式对齐 2eat）  
**测试计划：** [`2play-test-plan.md`](./2play-test-plan.md)（质量门、用例矩阵；扩展 common-test-strategy）  
**部署（野草云3）：** [`2play-deployment-plan.md`](./2play-deployment-plan.md)（入口 [`6.deployment-plan.md`](./6.deployment-plan.md)）— stack `where2play`，宿主机 **`3005→3000`**，域名 `where2play.place`；Postgres **`where2play`**（[ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md)）；上游 `PLACES_AGENT_BASE_URL` / `PLACES_AGENT_CALLER_KEY`；L2/助手 `OPENAI_*` **仅 BFF 服务端**（ADR-036/037）。

## Mock-up

画廊入口：[`ui-mockup/index.html`](./ui-mockup/index.html)

| 文件 | 作用 |
| --- | --- |
| `01-home` … `05-set-password` | 公开 / Auth |
| `06-plan` | 规划器 + Day/Hour + Chat + 底栏 + 重新规划对话框 |
| `07-profile` | 个人信息 + 兴趣 |
| `08-saved` / `09-saved-detail` | 我的行程多卡 / 详情+DB 对话 |
| [`ui-mockup/assets/`](./ui-mockup/assets/) | `mockup.css`（tokens + 机翼气流）、`mockup.js`、logos |

## places.family footer（与 what2eat 共用约定）

行级约定对齐 what2eat（[`../../2.what2eat/2eat-specs/2.ui-guidline.md`](../../2.what2eat/2eat-specs/2.ui-guidline.md) §4）：

```text
places.family:  [logo] where2play.place  ·  [logo] what2eat.food  ·  [logo] places.agent-mate.ai  ·  copyright © Ethan Huang
```

| 规则 | 说明 |
| --- | --- |
| 标签 | `places.family:`（须带冒号） |
| 顺序 | where2play → what2eat → places.agent-mate → copyright |
| 当前产品 | 本站：where2play.place 为纯文本标记（无链接、无下划线） |
| 姊妹链接 | 有下划线；新标签打开（`target="_blank"` + `rel="noopener noreferrer"`） |
| Logo | 透明图；无 chip 底、无 hover 高亮 |
| 字体 | Figtree + Fredoka 标签 **12px**（i18n 落地后拉丁字宽仍稳定） |

视觉方向：天空登机牌 + **机翼下方气流**（非机尾尾焰）；footer **交互**规则与 what2eat 一致。
