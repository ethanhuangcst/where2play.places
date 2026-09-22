#!/usr/bin/env python3
"""TC-M10-E2E-06: Plan structure gate — constraints + travel-tips after assistant takeover."""

from __future__ import annotations

import os
import re
import sys

from playwright.sync_api import sync_playwright

from takeoff_helpers import fill_takeoff_and_confirm
from register_helpers import pick_nationality

BASE = os.environ.get("W2P_BASE_URL", "http://localhost:3030")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{BASE}/register", wait_until="networkidle", timeout=60000)

        email = f"mvp10-structure-{os.getpid()}@example.com"
        page.fill('[data-testid="field-name"]', "Structure Test")
        page.fill('[data-testid="field-email"]', email)
        page.fill('[data-testid="field-age"]', "30")
        pick_nationality(page)
        page.fill('[data-testid="field-password"]', "password123")
        page.fill('[data-testid="field-confirm-password"]', "password123")
        page.click('[data-testid="register-submit"]')
        page.wait_for_url(re.compile(r".*/plan"), timeout=60000)

        page.wait_for_selector('[data-testid="plan-page"]', timeout=30000)
        locale_cn = page.locator('[data-testid="locale-CN"]')
        if locale_cn.count():
            locale_cn.first.click()
            page.wait_for_timeout(400)
        fill_takeoff_and_confirm(
            page,
            destination="杭州",
            days="3",
            party="2",
            trip_type_substring="情侣",
        )

        page.wait_for_selector('[data-testid="plan-constraints"]', timeout=15000)
        page.wait_for_selector('[data-testid="plan-nav"]', timeout=15000)
        # plan-travel-tips requires agent tips event (MVP-T10); not part of this app-only gate.

        takeoff = page.locator(".plan-takeoff")
        assert takeoff.count() == 0

        nav = page.locator(".plan-nav.is-open")
        assert nav.count() == 1
        nav_style = nav.evaluate(
            "el => ({ position: getComputedStyle(el).position, display: getComputedStyle(el).display })"
        )
        assert nav_style["position"] == "fixed"
        assert nav_style["display"] == "flex"

        grid = page.locator(".constraint-grid")
        assert grid.count() == 1
        grid_cols = grid.evaluate("el => getComputedStyle(el).gridTemplateColumns")
        assert grid_cols and "px" in grid_cols

        assert page.locator(".plan-board__stack").count() == 0
        assert page.locator('[data-testid="plan-nav-terminate"]').count() == 1
        assert page.locator('[data-testid="plan-nav-default"]').count() == 0

        browser.close()
    print("TC-M10-E2E-06: structure gate passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
