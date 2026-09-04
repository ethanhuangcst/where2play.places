# where2play ↔ agent 30 城 parity E2E · 索引

> **状态：** 规格已定义（[`2play-test-plan.md` §5.5](../2play-test-plan.md)）；自动化脚本 `e2e/test_agent_parity_30.py` **待实现**。
>
> **Agent 基线：** [`1.places-agent/agent-specs/e2e-test-result/INDEX.md`](../../1.places-agent/agent-specs/e2e-test-result/INDEX.md)（27/30 通过，2026-09-02）。

## 目的

经 where2play Plan 页（BFF + UI）完成的行程，应与 agent 直连 E2E 的骨架 stop 名称、填充结果与交通语义 **一致**（时段 ±15min；vendor 评分/图片可差异）。

## 运行（计划）

```bash
# 1. Agent 基线（对比源）
cd 1.places-agent && python3 scripts/e2e-places-agent.py --all

# 2. where2play parity（待实现）
cd 3.where2play && python3 e2e/test_agent_parity_30.py --compare
```

## 结果表（待首次跑后填充）

| # | 城市 | agent | where2play | parity | 文件 |
| --- | --- | --- | --- | --- | --- |
| 1 | Lisbon | ✓ | — | — | — |
| … | … | … | … | … | … |

## 判据摘要

见 `2play-test-plan.md` **P30-01–P30-05**。
