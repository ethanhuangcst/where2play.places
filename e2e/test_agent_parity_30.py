#!/usr/bin/env python3
"""Agent parity stub — delegates to places-agent e2e script (plan-46 §5.5)."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AGENT_SCRIPT = ROOT.parent / "1.places-agent" / "scripts" / "e2e-places-agent.py"


def main() -> int:
    parser = argparse.ArgumentParser(description="Run agent 30-city parity via places-agent harness")
    parser.add_argument("--only", default="", help="Comma-separated city ids or names")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    if not AGENT_SCRIPT.is_file():
        print(f"missing agent script: {AGENT_SCRIPT}", file=sys.stderr)
        return 2
    cmd = [sys.executable, str(AGENT_SCRIPT)]
    if args.only:
        cmd.extend(["--only", args.only])
    if args.limit:
        cmd.extend(["--limit", str(args.limit)])
    return subprocess.call(cmd, cwd=str(AGENT_SCRIPT.parent.parent))


if __name__ == "__main__":
    raise SystemExit(main())
