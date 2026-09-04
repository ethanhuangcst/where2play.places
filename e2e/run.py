#!/usr/bin/env python3
"""where2play E2E runner."""

from __future__ import annotations

import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENT_ROOT = ROOT.parent / "1.places-agent"
DEFAULT_DB_URL = "postgresql://where2play:where2play@localhost:5435/where2play"


def e2e_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("W2P_BASE_URL", "http://localhost:3030")
    env.setdefault("SESSION_SECRET", "e2e-session-secret-32chars-minimum!!")
    env.setdefault("FEATURE_EMAIL", "false")
    env.setdefault("PUBLIC_BASE_URL", "http://localhost:3030")
    env.setdefault("APP_URL", "http://localhost:3030")
    env.setdefault("DATABASE_URL", DEFAULT_DB_URL)
    return env


def app_dev_cmd(*, plan_slot_stage_ms: int | None = None) -> str:
    parts = [f"DATABASE_URL={DEFAULT_DB_URL}"]
    if plan_slot_stage_ms is not None:
        parts.append(f"PLAN_SLOT_STAGE_MS={plan_slot_stage_ms}")
    parts.append("npm run dev")
    return " ".join(parts)


def agent_ready() -> bool:
    try:
        with urllib.request.urlopen("http://localhost:3010/v1/health", timeout=2) as resp:
            return resp.status < 500
    except Exception:
        return False


def app_ready() -> bool:
    try:
        with urllib.request.urlopen("http://localhost:3030/", timeout=2) as resp:
            return resp.status < 500
    except Exception:
        return False


def run(script: str) -> int:
    return subprocess.call(
        [sys.executable, str(ROOT / "e2e" / script)], cwd=ROOT, env=e2e_env()
    )


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: run.py mvp1|mvp2-live|mvp3-live", file=sys.stderr)
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
        env = e2e_env()
        cmd = (
            f"python3 scripts/with_server.py "
            f'--server "app|{app_dev_cmd()}|http://localhost:3030/" '
            f'-- sh -c "{chain}"'
        )
        return subprocess.call(cmd, shell=True, cwd=ROOT, env=env)
    agent_dev = (
        f"cd {AGENT_ROOT} && NODE_ENV=development PORT=3010 "
        f"npx tsx --env-file=.env.local server.ts"
    )

    if target == "mvp2-live":
        env = e2e_env()
        agent_server = ""
        if not agent_ready():
            agent_server = (
                f'--server "agent|{agent_dev}|http://localhost:3010/v1/health" '
            )
        app_server = ""
        if not app_ready():
            app_server = f'--server "app|{app_dev_cmd()}|http://localhost:3030/" '
        cmd = (
            f"python3 scripts/with_server.py "
            f"{agent_server}"
            f"{app_server}"
            f"-- python3 e2e/test_mvp2_live.py"
        )
        return subprocess.call(cmd, shell=True, cwd=ROOT, env=env)
    if target == "mvp3-live":
        env = e2e_env()
        agent_server = ""
        if not agent_ready():
            agent_server = (
                f'--server "agent|{agent_dev}|http://localhost:3010/v1/health" '
            )
        app_server = ""
        if not app_ready():
            app_server = (
                f'--server "app|{app_dev_cmd(plan_slot_stage_ms=0)}|http://localhost:3030/" '
            )
        cmd = (
            f"python3 scripts/with_server.py "
            f"{agent_server}"
            f"{app_server}"
            f"-- python3 e2e/test_mvp3_live.py"
        )
        return subprocess.call(cmd, shell=True, cwd=ROOT, env=env)
    if target == "chat02":
        env = e2e_env()
        app_server = ""
        if not app_ready():
            app_server = f'--server "app|{app_dev_cmd()}|http://localhost:3030/" '
        cmd = (
            f"python3 scripts/with_server.py "
            f"{app_server}"
            f"-- python3 e2e/test_chat02_local_draft.py"
        )
        return subprocess.call(cmd, shell=True, cwd=ROOT, env=env)
    if target == "mvp10-structure":
        env = e2e_env()
        app_server = ""
        if not app_ready():
            app_server = f'--server "app|{app_dev_cmd()}|http://localhost:3030/" '
        cmd = (
            f"python3 scripts/with_server.py "
            f"{app_server}"
            f"-- python3 e2e/test_mvp10_structure.py"
        )
        return subprocess.call(cmd, shell=True, cwd=ROOT, env=env)
    print(f"Unknown target: {target}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
