#!/usr/bin/env python3
"""UI E2E: Plan takeoff + intake + skeleton make. Servers must already be up."""
from __future__ import annotations

import json
import time
from pathlib import Path

from db_helpers import BASE, delete_user
from playwright.sync_api import sync_playwright

EMAIL = "e2e.make.issue@where2play.place"
PASSWORD = "testpass123"
OUT_DIR = Path(
    "/Users/ethanhuang/code/places-workspace/1.places-agent/agent-specs/e2e-test-results"
)
SHOT = OUT_DIR / "make-itinerary-issue.png"
UI_JSON = OUT_DIR / "_last-ui-e2e.json"


def click_locale_cn(page) -> None:
    btn = page.locator('[data-testid="locale-CN"]')
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(400)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    delete_user(EMAIL)
    notes: dict = {"events": [], "ui": {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(30000)

        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        click_locale_cn(page)
        page.fill('[data-testid="field-name"]', "E2E Make")
        page.fill('[data-testid="field-email"]', EMAIL)
        loc = page.locator('[data-testid="field-location"]')
        if loc.count():
            loc.fill("Lisbon")
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        interest = page.locator('[data-testid="interest-tourist_attraction"]')
        if interest.count():
            interest.click()
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan**", timeout=30000)
        click_locale_cn(page)
        page.wait_for_selector('[data-testid="plan-form"]')

        page.fill('[data-testid="plan-dest"]', "里斯本")
        page.fill('[data-testid="plan-start-date"]', "2026-09-10")
        page.fill('[data-testid="plan-days"]', "4")
        page.fill('[data-testid="plan-party"]', "2")
        page.select_option('[data-testid="plan-budget"]', "mid")
        page.click('[data-testid="plan-submit"]')
        page.wait_for_selector('[data-testid="plan-nav"]')

        # b hotel
        page.fill('[data-testid="plan-nav-input"]', "Hills Hotel Lisboa")
        page.click('[data-testid="plan-nav-send"]')
        page.wait_for_timeout(800)
        # c time default
        page.fill('[data-testid="plan-nav-input"]', "")
        page.click('[data-testid="plan-nav-send"]')
        page.wait_for_timeout(800)
        # d e f chips
        for _ in range(3):
            chips = page.locator(".plan-nav__quick button")
            if chips.count() == 0:
                page.click('[data-testid="plan-nav-send"]')
            else:
                chips.first.click()
            page.wait_for_timeout(900)
        # g wait must-see then send default (empty)
        page.wait_for_timeout(2500)
        if page.locator('[data-testid="plan-nav-send"]').count():
            page.click('[data-testid="plan-nav-send"]')
        page.wait_for_timeout(800)
        # h other
        if page.locator('[data-testid="plan-nav-send"]').count():
            page.click('[data-testid="plan-nav-send"]')

        t0 = time.time()
        deadline = t0 + 180
        while time.time() < deadline:
            err = page.locator('[data-testid="plan-error"]')
            skel = page.locator('[data-testid="plan-thread-skeleton"]')
            elapsed = page.locator('[data-testid="plan-make-elapsed"]')
            notes["ui"]["elapsed_visible"] = elapsed.inner_text() if elapsed.count() else None
            if err.count() and err.inner_text().strip():
                notes["ui"]["error"] = err.inner_text().strip()
                break
            if skel.count():
                notes["ui"]["skeleton_preview"] = skel.inner_text()[:2000]
                break
            page.wait_for_timeout(500)
        notes["ui"]["wait_s"] = round(time.time() - t0, 1)
        notes["ui"]["thread"] = page.locator('[data-testid="plan-nav-thread"]').inner_text()[:3000]
        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()

    UI_JSON.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(notes["ui"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
