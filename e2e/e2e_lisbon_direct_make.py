#!/usr/bin/env python3
"""Direct HTTP make_itinerary (no 2play UI). Same Lisbon 4d + hotel as UI E2E."""
from __future__ import annotations

import json
import os
import time
import urllib.request
from pathlib import Path

OUT = Path(
    "/Users/ethanhuang/code/places-workspace/1.places-agent/agent-specs/e2e-test-results"
)
ENV = Path("/Users/ethanhuang/code/places-workspace/3.where2play/.env.local")
AGENT_ENV = Path("/Users/ethanhuang/code/places-workspace/1.places-agent/.env.local")


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, _, v = s.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def slim(cards: list) -> list:
    keep = (
        "name",
        "location",
        "provider",
        "rating",
        "category",
        "user_requested",
        "must_see",
        "sources",
    )
    slimmed = []
    for c in cards:
        if not isinstance(c, dict):
            continue
        o = {k: c[k] for k in keep if k in c}
        if "name" in o:
            slimmed.append(o)
    return slimmed


def summarize(sk: dict | None) -> dict:
    days = (sk or {}).get("days") or []
    per = []
    for d in days:
        stops = d.get("stops") or []
        kinds = [s.get("kind") for s in stops]
        per.append(
            {
                "day_index": d.get("day_index"),
                "day_theme": d.get("day_theme"),
                "n_stops": len(stops),
                "kinds": kinds,
                "names": [s.get("name") for s in stops],
            }
        )
    stay_only = bool(per) and all(
        k and all(x == "stay" for x in k) for k in (p["kinds"] for p in per)
    )
    return {"n_days": len(per), "stay_only": stay_only, "days": per}


def post(base: str, key: str, tool: str, body: dict, timeout: int) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{base}/v1/{tool}",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode()
            return res.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw) if raw else {"error": raw}
        except json.JSONDecodeError:
            return e.code, {"error": raw[:2000]}


def main() -> None:
    w = load_env(ENV)
    a = load_env(AGENT_ENV)
    base = (
        w.get("PLACES_AGENT_BASE_URL_LOCAL")
        or w.get("PLACES_AGENT_BASE_URL")
        or "http://127.0.0.1:3010"
    ).rstrip("/")
    key = (
        w.get("PLACES_AGENT_CALLER_KEY_LOCAL")
        or w.get("PLACES_AGENT_CALLER_KEY")
        or a.get("CALLER_KEY")
        or ""
    )
    if not key:
        raise SystemExit("missing caller key")

    hotel = "Hills Hotel Lisboa"
    city = "里斯本"
    locale = "CN"
    providers = ["AMAP", "GOOGLE_MAPS"]
    report: dict = {"base": base, "city": city, "hotel": hotel, "steps": {}}

    t0 = time.time()
    st, geo = post(
        base,
        key,
        "geocode",
        {"query": hotel, "locale": locale, "providers": providers},
        30,
    )
    gdata = geo.get("data") or {}
    report["steps"]["geocode_hotel_name_only"] = {
        "http": st,
        "ok": geo.get("ok"),
        "lat": gdata.get("lat") if isinstance(gdata, dict) else None,
        "lng": gdata.get("lng") if isinstance(gdata, dict) else None,
        "ms": int((time.time() - t0) * 1000),
    }

    t0 = time.time()
    st, disc = post(
        base,
        key,
        "discover_places",
        {
            "city": city,
            "numDays": 4,
            "bounds": {"start": "2024-06-01", "end": "2024-06-04"},
            "origin": {"name": city},
            "locale": locale,
            "providers": providers,
        },
        90,
    )
    ddata = disc.get("data") or {}
    cands = ddata.get("candidates") or {}
    raw_places = cands.get("places") or []
    raw_rests = cands.get("restaurants") or []
    places = slim(raw_places) if raw_places else []
    if not places and raw_places:
        places = raw_places
    rests = slim(raw_rests) if raw_rests else []
    if not rests and raw_rests:
        rests = raw_rests
    trip_id = ddata.get("trip_id")
    revision = ddata.get("revision")
    report["steps"]["discover"] = {
        "http": st,
        "ok": disc.get("ok"),
        "trip_id": trip_id,
        "revision": revision,
        "n_places": len(places),
        "n_restaurants": len(rests),
        "ms": int((time.time() - t0) * 1000),
        "outcome": disc.get("outcome"),
    }

    def run_make(label: str, origin: dict, tid: str | None, rev: int | None) -> dict:
        t = time.time()
        body = {
            "city": city,
            "numDays": 4,
            "candidates": {"places": places, "restaurants": rests},
            "locale": locale,
            "providers": providers,
            "origin": origin,
            "pace": "relaxed",
            "must_include": [],
        }
        if tid:
            body["trip_id"] = tid
        if isinstance(rev, int) and rev > 0:
            body["revision"] = rev
        st2, mk = post(base, key, "make_itinerary", body, 180)
        data = mk.get("data") or {}
        sk = data.get("skeleton") if isinstance(data, dict) else None
        out = {
            "http": st2,
            "ok": mk.get("ok"),
            "outcome": mk.get("outcome"),
            "error": (mk.get("error") if isinstance(mk, dict) else None),
            "trip_id": data.get("trip_id") if isinstance(data, dict) else None,
            "revision": data.get("revision") if isinstance(data, dict) else None,
            "ms": int((time.time() - t) * 1000),
            "skeleton_summary": summarize(sk if isinstance(sk, dict) else None),
            "skeleton": sk,
        }
        fetch_id = out["trip_id"] or tid
        if fetch_id:
            _, ft = post(
                base,
                key,
                "fetch_trip_details",
                {
                    "trip_id": fetch_id,
                    "fields": ["skeleton", "constraints", "candidates"],
                    "locale": locale,
                },
                30,
            )
            fdata = (ft.get("data") or {}) if isinstance(ft, dict) else {}
            slice_ = fdata.get("trip") or fdata
            # envelope may nest
            sk2 = None
            origin2 = None
            n_p = n_r = None
            if isinstance(slice_, dict):
                sk2 = slice_.get("skeleton")
                cons = slice_.get("constraints") or {}
                origin2 = cons.get("origin") if isinstance(cons, dict) else None
                c2 = slice_.get("candidates") or {}
                if isinstance(c2, dict):
                    n_p = len(c2.get("places") or [])
                    n_r = len(c2.get("restaurants") or [])
            # ADR-046: data may be { skeleton, constraints, ... } at top
            if sk2 is None and isinstance(fdata, dict):
                sk2 = fdata.get("skeleton")
                cons = fdata.get("constraints") or {}
                if isinstance(cons, dict):
                    origin2 = cons.get("origin")
                c2 = fdata.get("candidates") or {}
                if isinstance(c2, dict):
                    n_p = len(c2.get("places") or [])
                    n_r = len(c2.get("restaurants") or [])
            out["fetch"] = {
                "ok": ft.get("ok") if isinstance(ft, dict) else False,
                "skeleton_summary": summarize(sk2 if isinstance(sk2, dict) else None),
                "origin": origin2,
                "n_places": n_p,
                "n_restaurants": n_r,
            }
        return out

    report["steps"]["make_origin_name_only"] = run_make(
        "name_only",
        {"name": hotel},
        trip_id,
        revision if isinstance(revision, int) else None,
    )

    # Second trip: same pool, origin = UI/AMAP coords (reproduce 2play geocode-first)
    t0 = time.time()
    st, disc2 = post(
        base,
        key,
        "discover_places",
        {
            "city": city,
            "numDays": 4,
            "bounds": {"start": "2024-06-01", "end": "2024-06-04"},
            "origin": {"name": city},
            "locale": locale,
            "providers": providers,
        },
        90,
    )
    d2 = disc2.get("data") or {}
    c2 = d2.get("candidates") or {}
    rp2 = c2.get("places") or []
    rr2 = c2.get("restaurants") or []
    places_b = slim(rp2) if rp2 else rp2
    rests_b = slim(rr2) if rr2 else rr2
    report["steps"]["discover_b"] = {
        "http": st,
        "ok": disc2.get("ok"),
        "trip_id": d2.get("trip_id"),
        "revision": d2.get("revision"),
        "n_places": len(places_b) if isinstance(places_b, list) else 0,
        "ms": int((time.time() - t0) * 1000),
    }
    places = places_b if isinstance(places_b, list) else places
    rests = rests_b if isinstance(rests_b, list) else rests
    ui_origin = {
        "name": hotel,
        "lat": 22.186785,
        "lng": 113.549525,
    }
    live_geo = report["steps"]["geocode_hotel_name_only"]
    if live_geo.get("lat") is not None:
        ui_origin = {
            "name": hotel,
            "lat": live_geo["lat"],
            "lng": live_geo["lng"],
        }
    report["steps"]["make_origin_with_geocode_coords"] = run_make(
        "with_coords",
        ui_origin,
        d2.get("trip_id"),
        d2.get("revision") if isinstance(d2.get("revision"), int) else None,
    )

    OUT.mkdir(parents=True, exist_ok=True)
    raw_path = OUT / "_last-direct-lisbon-make.json"
    raw_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report["steps"][k] for k in report["steps"]}, ensure_ascii=False, indent=2)[:8000])
    print("WROTE", raw_path)


if __name__ == "__main__":
    main()
