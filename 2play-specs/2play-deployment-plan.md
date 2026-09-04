# Deployment plan — where2play (`where2play.place`)

**Consumer:** release-bot semi-auto release on **野草云3** (`svr_hk_vps_3`). Operators follow `0.2.release-bot/knowledge/03-semi-auto-release.md`. Family overview: [`../../workspace-specs/6.deployment-plan.md`](../../workspace-specs/6.deployment-plan.md). Sister plan: [`../../2.what2eat/2eat-specs/6.deployment-plan.md`](../../2.what2eat/2eat-specs/6.deployment-plan.md).

**App repo (target):** `ethanhuangcst/where2play.places` · local folder `3.where2play/`  
**Wave:** **Third** in the places family. **Upstream:** places-agent is **live** (`https://places.agent-mate.ai`, host debug `3007→3000`). Product gate: BFF uses `search_places` + `plan_itinerary` live-honest ([ADR-008](../../workspace-specs/adr/ADR-008-itinerary-ownership.md), [ADR-021](../../workspace-specs/adr/ADR-021-live-vendor-no-fixture.md)).  
**Secrets:** never in this file. Env **names** only.

---

## 0. Meta

| Field | Value |
| --- | --- |
| Product | **where2play** — thin Next.js consumer web + same-origin BFF |
| App repo | `ethanhuangcst/where2play.places` |
| Local folder | `3.where2play/` |
| Target node | **野草云3** · `38.55.192.140` |
| **Local dev** | **`PORT=3030`** · `PUBLIC_BASE_URL=http://localhost:3030` — not `:3010` / `:3020` |
| **Prod host debug** | **`3005→3000`** (confirm free; do not take **`3007`**) |
| Stack name | **`where2play`** |
| Container name | **`where2play-web`** |
| Public domain | **`where2play.place`** (apex; not `.places`) |
| `PUBLIC_BASE_URL` | `https://where2play.place` |
| Pipeline | GitHub Actions → GHCR → Portainer pull-only → NPM → Cloudflare |
| Shared network | **`portainer_network`** (never delete or recreate) |

### Consoles

| Console | URL |
| --- | --- |
| GitHub Actions | `https://github.com/ethanhuangcst/where2play.places/actions` |
| GHCR | `https://github.com/ethanhuangcst/where2play.places/pkgs/container/where2play.places%2Fweb` |
| Portainer | `https://portainer.agent-mate.ai/` |
| NPM | `https://nginx.agent-mate.ai/` |
| Cloudflare | zone **`where2play.place`** |
| places-agent | `https://places.agent-mate.ai` |
| App (after go-live) | `https://where2play.place` |

---

## Blockers — app-repo readiness

release-bot **must not** start Portainer until artifacts exist in **`ethanhuangcst/where2play.places`**. Specs + mock-up in this folder do **not** satisfy deploy.

| Artifact | Status |
| --- | --- |
| Next app + BFF (`package.json`) | **Blocker** — local `3.where2play/` is specs + `ui-mockup` only |
| `Dockerfile` | **Blocker** — Next standalone; listen `0.0.0.0:3000` |
| `docker-compose.prod.yml` | **Blocker** — image-only; external `portainer_network` |
| `.github/workflows/ghcr.yml` | **Blocker** |
| `.env.prod.example` | **Blocker** |
| Specs / mock-up | **Has** (`2play-specs/`) |

**Upstream:** Agent MVP-2 tools (`search_places`, `plan_itinerary`) are already in the live places-agent image. Issue a **caller API key** for `where2play.place`. On `portainer_network` prefer `PLACES_AGENT_BASE_URL=http://places-agent:3000`. Smoke fallback: `https://places.agent-mate.ai`.

---

## 1. Architecture (runtime)

```text
[Consumer browser]
    → Cloudflare (grey until Let's Encrypt OK)
        → NPM :443
            → where2play-web:3000  (stack where2play)
                → places-agent:3000  (HTTP /v1; Bearer PLACES_AGENT_CALLER_KEY)
                → Postgres `where2play` (ADR-033)
```

Thin app: **no** map vendor keys. Itinerary **engine** stays on places-agent ([ADR-008](../../workspace-specs/adr/ADR-008-itinerary-ownership.md)). Product **Qwen** (`QWEN_*`) on this BFF (ADR-047). Persistence: PostgreSQL **`where2play`** ([ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md)).

---

## 2. Services

| Service | Stack | container_name | Image (proposed) | Container | Host debug |
| --- | --- | --- | --- | --- | --- |
| web | `where2play` | `where2play-web` | `ghcr.io/ethanhuangcst/where2play.places/web:<IMAGE_TAG>` | `3000` | **`3005`** |

NPM Forward Hostname **`where2play-web`**, Forward Port **`3000`** (never host `3005`).

---

## 3. Images & CI

Same family contract as what2eat: GHCR on GitHub runners; Portainer pull-only; tags `sha` / `v*` / `latest`; never branch `main`. Recreate + Pull.

---

## 4. Compose skeleton (land in app repo)

```yaml
name: where2play

services:
  web:
    image: ghcr.io/ethanhuangcst/where2play.places/web:${IMAGE_TAG:-latest}
    container_name: where2play-web
    restart: unless-stopped
    ports:
      - "3005:3000"
    environment:
      NODE_ENV: production
      APP_NAME: where2play
      PORT: "3000"
      HOSTNAME: "0.0.0.0"
      PUBLIC_BASE_URL: ${PUBLIC_BASE_URL:-https://where2play.place}
      APP_URL: ${APP_URL:-https://where2play.place}
      SESSION_SECRET: ${SESSION_SECRET:?set SESSION_SECRET}
      DATABASE_URL: ${DATABASE_URL:?set DATABASE_URL}
      PLACES_AGENT_BASE_URL: ${PLACES_AGENT_BASE_URL:-http://places-agent:3000}
      PLACES_AGENT_CALLER_KEY: ${PLACES_AGENT_CALLER_KEY:?set caller key}
      PLACES_AGENT_TIMEOUT_MS: ${PLACES_AGENT_TIMEOUT_MS:-25000}
    networks:
      - default

networks:
  default:
    external: true
    name: portainer_network
```

Do **not** add `AMAP_*`, `GOOGLE_MAPS_*`, `GMAPS_MCP_*`, `TRIPADVISOR_*`. Do **not** use legacy names `PLACES_AGENT_URL` / `PLACES_AGENT_API_KEY`.

---

## 5. Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `APP_NAME` | yes | `where2play` |
| `NODE_ENV` / `PORT` / `HOSTNAME` | yes | `production` / `3000` / `0.0.0.0` |
| `PUBLIC_BASE_URL` | yes | `https://where2play.place` |
| `PLACES_AGENT_BASE_URL` | yes | Prefer `http://places-agent:3000` on 野草云3 |
| `PLACES_AGENT_CALLER_KEY` | yes | Server-only. Never `NEXT_PUBLIC_*` |
| `IMAGE_TAG` | deploy | Published GHCR tag |
| `DATABASE_URL` | **yes** | Aliyun `…@101.132.156.250:5432/where2play` ([ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md)). Portainer secret. |
| `SESSION_SECRET` | **yes** | Consumer session cookie |
| `PLACES_AGENT_TIMEOUT_MS` | no | Default 25000 |

**LLM:** `QWEN_*` on this BFF (ADR-047). `OPENAI_*` fallback only — do not delete.  

**Forbidden:** map vendor keys; `NEXT_PUBLIC_PLACES_AGENT_*`; reusing DB names `what2eat` / `places_agent`.

---

## 6. Database

| Item | where2play |
| --- | --- |
| Engine | **PostgreSQL + Prisma** ([ADR-033](../../workspace-specs/adr/ADR-033-where2play-postgres-prisma.md)) |
| Local | `localhost:5435` · db **`where2play`** · `postgresql://where2play:where2play@localhost:5435/where2play`（可与 what2eat 同实例不同库） |
| Test | db **`where2play_test`** · `TEST_DATABASE_URL`（永不指向生产） |
| Production | Aliyun **`101.132.156.250:5432`** · db **`where2play`**（新建空库后再首次 migrate） |
| Do **not** reuse | `what2eat`, `places_agent`, `kb_agent`, `mypoke_trade_prod`, `media_marketing`, `hca` |
| VPS volume | **None** for primary store（DB off-node） |
| Boot | `prisma migrate deploy` after `DATABASE_URL` reachable |

---

## 7. DNS & TLS

| Item | Value |
| --- | --- |
| Zone | **`where2play.place`** |
| Record | Apex **`@`** → **A** `38.55.192.140` |
| Cloudflare | Grey until NPM Let's Encrypt succeeds |
| NPM domain | **`where2play.place`** (exact SNI) |
| NPM upstream | `http://where2play-web:3000` |
| SSL | Request LE; Force SSL after success |

---

## 8. Reverse-proxy extras

Single upstream like mypoke / what2eat. **No** Custom Locations. WebSockets on if Next needs them. After stack Recreate, **Save** the NPM host.

---

## 9. Smoke checklist

- [ ] `https://where2play.place/` loads (not NPM Default Site)
- [ ] HTML must **not** contain `data:text/javascript;base64`
- [ ] Signed-in trip / search path returns **live** place ids — no `fixture_` ([ADR-021](../../workspace-specs/adr/ADR-021-live-vendor-no-fixture.md))
- [ ] Itinerary UI is presentation-only; planning comes from agent `plan_itinerary`
- [ ] Map deeplinks have **no** API key in the URL
- [ ] Spot-check `https://places.agent-mate.ai/v1/health` and ≥1 other existing app

---

## 10. Isolation checklist

- [ ] Stack **`where2play`** free
- [ ] Container **`where2play-web`** free
- [ ] Host port **`3005`** free (do not take **`3004`** what2eat or **`3007`** places-agent)
- [ ] Domain **`where2play.place`** unused on NPM
- [ ] Will **not** recreate `portainer_network`
- [ ] Will **not** edit other NPM hosts / DNS
- [ ] Will **not** attach other products’ DBs
- [ ] Rollback: pin **`IMAGE_TAG`** for this stack only

---

## 11. Ops notes

| Topic | Rule |
| --- | --- |
| Deploy wave | After places-agent (**live**) and preferably after what2eat stack name/ports are settled |
| Thin client | No map keys; itinerary engine on agent |
| `IMAGE_TAG` | Published GHCR tag only |
| release-bot | `0.2.release-bot/svr_hk_vps_3/places.family/where2play-instruction.md` |

---

## 12. Release step map

**Gate:** § Blockers + caller key + live `search_places` / `plan_itinerary`.

| Step | Answer |
| --- | --- |
| **0 Preflight** | Repo `ethanhuangcst/where2play.places`; stack `where2play`; domain `where2play.place`; image `…/where2play.places/web:<tag>`; host **`3005→3000`** |
| **0b Isolation** | §10 |
| **1 Compose** | App-repo `docker-compose.prod.yml` |
| **2 CI → GHCR** | `.github/workflows/ghcr.yml` |
| **3 Env** | §5; secrets in Portainer only |
| **4 DB** | Only if an ADR exists; otherwise skip |
| **5 Portainer** | Stack `where2play`; Recreate + Pull |
| **6 DNS** | Apex → `38.55.192.140`; grey until LE |
| **7 NPM** | `http://where2play-web:3000`; Force SSL; Save after recreate |
| **8 Smoke** | §9 |

---

## 13. Cross-links

| Doc | Role |
| --- | --- |
| [`../../workspace-specs/6.deployment-plan.md`](../../workspace-specs/6.deployment-plan.md) | Family plan |
| [`README.md`](./README.md) | Specs + mock-up |
| [`../../2.what2eat/2eat-specs/6.deployment-plan.md`](../../2.what2eat/2eat-specs/6.deployment-plan.md) | Sister thin-app plan (Postgres + no product `OPENAI_*`) |
| `0.2.release-bot/svr_hk_vps_3/hk_vps_3_setting.md` | Inventory §4.7 |
