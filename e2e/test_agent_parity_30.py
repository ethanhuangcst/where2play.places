#!/usr/bin/env python3
"""Agent parity stub — delegates to places-agent e2e script (plan-46 §5.5)."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[2]
AGENT_SCRIPT = WORKSPACE / "places-agent" / "scripts" / "e2e-places-agent.py"

# Makefile --only lisbon,rome,prague → harness --only <int id>
CITY_IDS: dict[str, int] = {
    "lisbon": 1,
    "paris": 2,
    "tokyo": 3,
    "rome": 4,
    "bangkok": 5,
    "barcelona": 6,
    "new york": 7,
    "new-york": 7,
    "istanbul": 8,
    "singapore": 9,
    "seoul": 10,
    "prague": 11,
}


def resolve_only_ids(raw: str) -> list[int]:
    ids: list[int] = []
    for part in raw.split(","):
        token = part.strip()
        if not token:
            continue
        if token.isdigit():
            ids.append(int(token))
            continue
        key = token.lower().replace("_", " ")
        mapped = CITY_IDS.get(key) or CITY_IDS.get(key.replace(" ", "-"))
        if mapped is None:
            raise SystemExit(f"unknown city for --only: {token!r} (need id or known name)")
        ids.append(mapped)
    return ids


def main() -> int:
    parser = argparse.ArgumentParser(description="Run agent 30-city parity via places-agent harness")
    parser.add_argument("--only", default="", help="Comma-separated city ids or names")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    if not AGENT_SCRIPT.is_file():
        print(f"missing agent script: {AGENT_SCRIPT}", file=sys.stderr)
        return 2

    agent_root = str(AGENT_SCRIPT.parent.parent)
    if args.only:
        try:
            only_ids = resolve_only_ids(args.only)
        except SystemExit as e:
            print(str(e), file=sys.stderr)
            return 2
        if not only_ids:
            print("empty --only", file=sys.stderr)
            return 2
        rc = 0
        for scenario_id in only_ids:
            cmd = [sys.executable, str(AGENT_SCRIPT), "--only", str(scenario_id)]
            child = subprocess.call(cmd, cwd=agent_root)
            if child != 0 and rc == 0:
                rc = child
        return rc

    cmd = [sys.executable, str(AGENT_SCRIPT)]
    if args.limit:
        cmd.extend(["--limit", str(args.limit)])
    return subprocess.call(cmd, cwd=agent_root)


if __name__ == "__main__":
    raise SystemExit(main())
