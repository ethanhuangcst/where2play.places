#!/usr/bin/env python3
"""where2play E2E runner."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: run.py mvp1", file=sys.stderr)
        return 2
    target = sys.argv[1]
    if target == "mvp1":
        scripts = [
            "e2e/test_mvp1.py",
            "e2e/test_register_errors.py",
            "e2e/test_login_failed.py",
            "e2e/test_reset_set_password.py",
        ]
        chain = " && ".join(f"python3 {s}" for s in scripts)
        env = os.environ.copy()
        env.setdefault("W2P_BASE_URL", "http://localhost:3030")
        # Dev cookie signing for E2E when .env.local SESSION_SECRET is empty (protect-eng: do not write env files).
        env.setdefault("SESSION_SECRET", "e2e-session-secret-32chars-minimum!!")
        env.setdefault("FEATURE_EMAIL", "false")
        env.setdefault("PUBLIC_BASE_URL", "http://localhost:3030")
        env.setdefault("APP_URL", "http://localhost:3030")
        env.setdefault(
            "DATABASE_URL",
            "postgresql://where2play:where2play@localhost:5435/where2play",
        )
        cmd = (
            f"python3 scripts/with_server.py "
            f'--server "app|npm run dev|http://localhost:3030/" '
            f'-- sh -c "{chain}"'
        )
        return subprocess.call(cmd, shell=True, cwd=ROOT, env=env)
    print(f"Unknown target: {target}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
