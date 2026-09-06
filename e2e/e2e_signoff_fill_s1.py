#!/usr/bin/env python3
"""Smoke: intake → skeleton card (no preview title) → at least one fill line. Servers must be up."""
from __future__ import annotations

import json
import time
from pathlib import Path

from db_helpers import BASE, delete_user
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

EMAIL = "e2e.signoff.fill@where2play.place"
PASSWORD = "testpass123"
OUT_DIR = ROOT.parent / "specs" / "agent-specs" / "e2e-test-results"
SHOT = OUT_DIR / "signoff-fill-s1-ui.png"
UI_JSON = OUT_DIR / "_last-signoff-fill-ui.json"


def click_locale_cn(page) -> None:
    btn = page.locator('[data-testid="locale-CN"]')
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(400)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    delete_user(EMAIL)
    notes: dict = {"ui": {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(30000)

        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        click_locale_cn(page)
        page.fill('[data-testid="field-name"]', "E2E Fill S1")
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
        page.fill('[data-testid="plan-start-date"]', "2026-10-10")
        page.fill('[data-testid="plan-days"]', "2")
        page.fill('[data-testid="plan-party"]', "2")
        page.select_option('[data-testid="plan-budget"]', "mid")
        page.click('[data-testid="plan-submit"]')
        page.wait_for_selector('[data-testid="plan-nav"]')

        page.fill('[data-testid="plan-nav-input"]', "Hills Hotel Lisboa")
        page.click('[data-testid="plan-nav-send"]')
        page.wait_for_timeout(800)
        for _ in range(5):
            chips = page.locator(".plan-nav__quick button")
            if chips.count() == 0:
                page.click('[data-testid="plan-nav-send"]')
            else:
                chips.first.click()
            page.wait_for_timeout(900)
        page.wait_for_timeout(2000)
        if page.locator('[data-testid="plan-nav-send"]').count():
            page.click('[data-testid="plan-nav-send"]')
        page.wait_for_timeout(600)
        if page.locator('[data-testid="plan-nav-send"]').count():
            page.click('[data-testid="plan-nav-send"]')

        t0 = time.time()
        deadline = t0 + 240
        saw_skel = False
        saw_fill = False
        while time.time() < deadline:
            err = page.locator('[data-testid="plan-error"]')
            skel = page.locator('[data-testid="plan-thread-skeleton"]')
            thread = page.locator('[data-testid="plan-nav-thread"]').inner_text()
            send = page.locator('[data-testid="plan-nav-send"]')
            if err.count() and err.inner_text().strip():
                notes["ui"]["error"] = err.inner_text().strip()
                break
            if skel.count():
                saw_skel = True
                skel_text = skel.inner_text()
                notes["ui"]["skeleton_has_preview_title"] = "骨架预览" in skel_text
            if "正在安排" in thread or "Arranging" in thread or "现在开始为您规划每日行程细节" in thread:
                saw_fill = True
            if send.count() and saw_fill:
                notes["ui"]["send_disabled_during_fill"] = send.is_disabled()
            if saw_skel and saw_fill:
                break
            page.wait_for_timeout(500)

        notes["ui"]["wait_s"] = round(time.time() - t0, 1)
        notes["ui"]["saw_skel"] = saw_skel
        notes["ui"]["saw_fill"] = saw_fill
        notes["ui"]["thread"] = page.locator('[data-testid="plan-nav-thread"]').inner_text()[:4000]
        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()

    UI_JSON.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(notes["ui"], ensure_ascii=False, indent=2))
    if not saw_skel or not saw_fill:
        raise SystemExit(1)
    if notes["ui"].get("skeleton_has_preview_title"):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
