#!/usr/bin/env python3
"""Verify assistant thread UX: takeover notice bubble + plan-progress beads after takeoff."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_helpers import BASE, delete_user
from register_helpers import pick_nationality

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
        pick_nationality(page)
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan**", timeout=30000)
        page.wait_for_selector('[data-testid="plan-form"]')

        # Live takeoff → takeover + progress beads
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

        progress = page.locator('[data-testid="plan-nav-progress"]')
        if progress.count():
            beads = page.locator(".plan-progress__bead")
            labels = page.locator(".plan-progress__label")
            hints = page.locator(".plan-progress__hint")
            if beads.count() < 1:
                issues.append("plan-progress beads missing during framework generation")
            if labels.count() < 1 or hints.count() < 1:
                issues.append("plan-progress label/hint missing")
            elif labels.first.inner_text().strip() == hints.first.inner_text().strip():
                issues.append("plan-progress label equals hint (mashed copy)")
        else:
            issues.append("plan-nav-progress missing after takeover")

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
