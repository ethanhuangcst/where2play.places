# where2play

Thin web + BFF for **where2play.place** (trip UX). Maps and itinerary engine live on **places-agent**.

This directory is **code and engineering only**. Product specs live in the umbrella repo:

- [`../specs/2play-specs/`](../specs/2play-specs/)
- Family architecture: [`../specs/2.architecture.md`](../specs/2.architecture.md)
- True-agent target: [`../specs/agent-specs/real-agent-refactory.md`](../specs/agent-specs/real-agent-refactory.md) + [ADR-050](../specs/adr/ADR-050-where2play-no-product-llm.md)

## Quick start

```bash
cp .env.example .env.local   # fill secrets locally — do not commit
make up                      # shared Postgres on :5435 (via sibling what2eat if needed)
make db-bootstrap
make db-migrate
make dev                     # Next on :3030
```

Useful targets: `make help`, `make test`, `make quality`, `make test-e2e-mvp1`.

## Docs

| Doc | Purpose |
| --- | --- |
| [`../specs/2play-specs/2play-stories.md`](../specs/2play-specs/2play-stories.md) | User stories / AC |
| [`../specs/2play-specs/2play-design.md`](../specs/2play-specs/2play-design.md) | Design + page contracts |
| [`../specs/2play-specs/itinerary-design.md`](../specs/2play-specs/itinerary-design.md) | Progressive itinerary UX |
| [`../specs/2play-specs/2play-test-plan.md`](../specs/2play-specs/2play-test-plan.md) | Test plan |
| [`../specs/2play-specs/2play-deployment-plan.md`](../specs/2play-specs/2play-deployment-plan.md) | Deploy |
