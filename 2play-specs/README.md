# where2play — specs

Trip / play product (`where2play.place`). Full requirements and stories are TBD; current design reference is the UI mock-up.

**Deploy (野草云3):** [`6.deployment-plan.md`](./6.deployment-plan.md) — stack `where2play`, host **`3005→3000`**, domain `where2play.place`, upstream `PLACES_AGENT_BASE_URL` / `PLACES_AGENT_CALLER_KEY`.

## Mock-up

| File | Role |
| --- | --- |
| [`ui-mockup/01-home.html`](./ui-mockup/01-home.html) | Public home — plane mark + cruise animation (small contrail), CTAs |
| [`ui-mockup/assets/`](./ui-mockup/assets/) | `play-logo.png` (600×600 transparent), sister logos, CSS/JS |

## places.family footer (shared with what2eat)

Same row contract as what2eat ([`../../2.what2eat/2eat-specs/2.ui-guidline.md`](../../2.what2eat/2eat-specs/2.ui-guidline.md) §4):

```text
places.family:  [logo] where2play.place  ·  [logo] what2eat.food  ·  [logo] places.agent-mate.ai  ·  copyright © Ethan Huang
```

| Rule | Detail |
| --- | --- |
| Label | `places.family:` (colon required) |
| Order | where2play → what2eat → places.agent-mate → copyright |
| Current product | On this host: where2play.place as plain mark (no link, no underline) |
| Sibling links | Underlined; open in a new tab (`target="_blank"` + `rel="noopener noreferrer"`) |
| Logos | Transparent art; no chip fill / no hover highlight |
| Type | Figtree + Fredoka label at **12px** (Latin-stable across locales when i18n lands) |

Visual direction: sky / mustard travel palette in `ui-mockup/assets/mockup.css` — not the what2eat picnic cloth, but the footer **interaction** rules match.
