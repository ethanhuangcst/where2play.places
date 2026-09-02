# where2play — 规格

出行 / 游玩产品（`where2play.place`）。

**产品规格：** [`2play-prod-specs.md`](./2play-prod-specs.md)  
**设计规格：** [`2play-design.md`](./2play-design.md)（§1 视觉 + §2 架构/技术设计 + §3 逐页契约；与 mock 同步，实现须 100% 对齐）  
**行程生成 / Progressive UX：** [`itinerary-design.md`](./itinerary-design.md)（MVP-3 **as-built** Mode H；**MVP-10 目标** §1.3 / §16–17 方案已确定 2026-08-31）  
**用户故事 / AC：** [`2play-stories.md`](./2play-stories.md)（ATDD；格式对齐 2eat）  
**测试计划：** [`2play-test-plan.md`](./2play-test-plan.md)（质量门、用例矩阵；扩展 common-test-strategy）  
**部署（野草云3）：** [`2play-deployment-plan.md`](./2play-deployment-plan.md)（入口 [`6.deployment-plan.md`](./6.deployment-plan.md)）— stack `where2play`，宿主机 **`3005→3000`**，域名 `where2play.place`；Postgres **`where2play`**（[ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md)）；上游 `PLACES_AGENT_BASE_URL` / `PLACES_AGENT_CALLER_KEY`；L2/助手 `OPENAI_*` **仅 BFF 服务端**（ADR-036/037）。

## Mock-up

画廊入口：[`ui-mockup/index.html`](./ui-mockup/index.html)

| 文件 | 作用 |
| --- | --- |
| `01-home` … `05-set-password` | 公开 / Auth · Travor |
| `06-plan` / `06-plan-skeleton` / `06-plan-qa` | **MVP-10 定稿**：5 字段起飞条 + Travor 皮肤 + 悬浮助手 + 骨架→逐站（[`2play-design.md §4.7`](./2play-design.md)） |
| `07-profile` | 个人信息 + 兴趣 |
| `08-saved` / `09-saved-detail` | 我的行程多卡 / 详情+DB 对话 |
| `10-travel-advice` | 出行建议 · 签证占位（MVP-11） |
| [`ui-mockup/assets/`](./ui-mockup/assets/) | `mockup.css`（结构类）、**`mockup-travor.css`**（Travor 覆盖）、`mockup.js`、logos |

## places.family footer（与 what2eat 共用约定）

行级约定对齐 what2eat（[`../../2.what2eat/2eat-specs/2.ui-guidline.md`](../../2.what2eat/2eat-specs/2.ui-guidline.md) §4）：

```text
places.family:  [logo] where2play.place  ·  [logo] what2eat.food  ·  [logo] places.agent-mate.ai  ·  copyright © Ethan Huang
```

| 规则 | 说明 |
| --- | --- |
| 标签 | `places.family:`（须带冒号） |
| 当前站点 | logo + 域名，非链接 |
| 姊妹站点 | logo + 域名，外链新标签 |
| 版权 | `copyright © Ethan Huang` |
| 公开页 | `.family-footer` 底栏 |
| App 页 | `.family-footer--app` 底栏 |
