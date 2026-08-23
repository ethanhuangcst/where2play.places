#!/usr/bin/env python3
"""Probe agent /v1/* route registration (no secrets)."""
import json
import urllib.error
import urllib.request

BASE = "http://localhost:3010"
PATHS = [
    "search_places",
    "plan_itinerary",
    "discover_places",
    "arrange_day",
    "enrich_arrange_transit",
]


def post(path: str) -> tuple[int, str, str]:
    req = urllib.request.Request(
        f"{BASE}/v1/{path}",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read(200).decode("utf-8", errors="replace")
            return resp.status, resp.headers.get("Content-Type", ""), body
    except urllib.error.HTTPError as e:
        body = e.read(200).decode("utf-8", errors="replace")
        return e.code, e.headers.get("Content-Type", ""), body


def main() -> int:
    try:
        with urllib.request.urlopen(f"{BASE}/v1/health", timeout=5) as resp:
            print(f"health: {resp.status}")
    except Exception as exc:
        print(f"FAIL health: {exc}")
        return 1

    failed = False
    for path in PATHS:
        status, ctype, body = post(path)
        snippet = body.replace("\n", " ")[:70]
        print(f"{path}: status={status} ctype={ctype.split(';')[0]} body={snippet!r}")
        if status == 404 and "text/html" in ctype:
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
