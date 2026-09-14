#!/usr/bin/env python3
"""Probe: trip-type combo cannot open; assistant notices bubble style; deviation copy."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_helpers import BASE, delete_user

from playwright.sync_api import sync_playwright

EMAIL = "e2e.t3ui.probe@where2play.place"
PASSWORD = "testpass123"
SHOT = Path("/tmp/t3-ui-probe.png")


def main() -> None:
    delete_user(EMAIL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.set_default_timeout(30000)

        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        page.fill('[data-testid="field-name"]', "T3 UI Probe")
        page.fill('[data-testid="field-email"]', EMAIL)
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan**", timeout=30000)
        page.wait_for_selector('[data-testid="plan-form"]')

        # Issue 1: trip type combo cannot open
        combo = page.locator('[data-testid="plan-trip-type"]')
        print("combo count:", combo.count())
        toggle = page.locator('[data-testid="plan-trip-type-toggle"]')
        print("toggle count:", toggle.count())
        if toggle.count():
            toggle.first.click()
            page.wait_for_timeout(300)
            opts = page.locator('[data-testid="plan-trip-type-option"]')
            print("options visible after toggle:", opts.count())
        else:
            combo.first.click()
            page.wait_for_timeout(300)
            print("combo html head:", combo.first.evaluate("el => el.outerHTML.slice(0, 400)"))

        page.screenshot(path=str(SHOT), full_page=False)
        print("shot:", SHOT)
        browser.close()


if __name__ == "__main__":
    main()
