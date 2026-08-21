#!/usr/bin/env python3
"""Shared E2E database helpers for where2play."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_URL = "postgresql://where2play:where2play@localhost:5435/where2play"
BASE = os.environ.get("W2P_BASE_URL", "http://localhost:3030")


def delete_user(email: str) -> None:
    subprocess.run(
        ["psql", DB_URL, "-c", f'DELETE FROM "User" WHERE email=\'{email}\';'],
        cwd=ROOT,
        check=False,
        capture_output=True,
    )


def seed_reset_token(email: str, token: str, *, expired: bool = False) -> None:
    env = {**os.environ, "DATABASE_URL": DB_URL}
    result = subprocess.run(
        [
            "npx",
            "tsx",
            str(ROOT / "e2e" / "seed_reset_token.ts"),
            email,
            token,
            "expired" if expired else "valid",
        ],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr or "seed_reset_token failed")
