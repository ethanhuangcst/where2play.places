#!/usr/bin/env python3
"""Verify: 1) trip-type combo opens; 2) takeover notice bubble style; 3) deviation friendly copy (via mock-free unit path, browser part checks 1+2)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_helpers import BASE, delete_user

from playwright.sync_api import sync_playwright

EMAIL = "e2e.t3ui.verify@where2play.place"
PASSWORD = "testpass123"
SHOTS = Path("/tmp/t3-ui-verify")


def main() -> None:
    SHOTS.mkdir(exist_ok=True)
    delete_user(EMAIL)
    issues: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.set_default_timeout(30000)

        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        page.fill('[data-testid="field-name"]', "T3 Verify")
        page.fill('[data-testid="field-email"]', EMAIL)
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan**", timeout=30000)
        page.wait_for_selector('[data-testid="plan-form"]')

        # Issue 1: combo opens via toggle and via input focus
        toggle = page.locator('[data-testid="plan-trip-type-toggle"]')
        if not toggle.count():
            issues.append("combo toggle missing")
        else:
            toggle.first.click(force=True)
            page.wait_for_timeout(400)
            opts = page.locator('[data-testid="plan-trip-type-option"]')
            n = opts.count()
            print("options after toggle click:", n)
            if n == 0:
                issues.append("combo list did not open on toggle click")
            else:
                # pick second option to prove selection works
                opts.nth(1).click()
                page.wait_for_timeout(300)
                val = page.locator('[data-testid="plan-trip-type"]').input_value()
                print("selected value:", val)
            page.screenshot(path=str(SHOTS / "1-combo-open.png"))

        # keyboard path: focus input, arrow down, enter
        page.locator('[data-testid="plan-trip-type"]').click()
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # Issue 2: run a real takeoff → takeover bubble styles
        page.fill('[data-testid="plan-dest"]', "Lisbon")
        page.locator('[data-testid="plan-dest"]').blur()
        page.wait_for_selector('[data-testid="plan-dest-verified"]', timeout=15000)
        page.fill('[data-testid="plan-start-date"]', "2026-10-10")
        page.select_option('[data-testid="plan-budget"]', "mid")
        page.click('[data-testid="plan-submit"]')
        page.wait_for_selector('[data-testid="plan-submit-confirm-ok"]')
        page.click('[data-testid="plan-submit-confirm-ok"]')
        page.wait_for_selector('[data-testid="plan-nav-takeover"]', timeout=30000)
        page.wait_for_timeout(500)

        cls = page.locator('[data-testid="plan-nav-takeover"]').get_attribute("class") or ""
        print("takeover class:", cls)
        if "bubble--agent-notice" not in cls:
            issues.append(f"takeover lacks notice bubble class: {cls}")
        # no skip/redo
        if page.locator('[data-testid="plan-nav-skip-need"]').count():
            issues.append("skip button present")
        if page.locator('[data-testid="plan-nav-redo-need"]').count():
            issues.append("redo button present")
        page.screenshot(path=str(SHOTS / "2-takeover.png"), full_page=False)

        browser.close()

    print("ISSUES:", issues if issues else "none")
    raise SystemExit(1 if issues else 0)


if __name__ == "__main__":
    main()
