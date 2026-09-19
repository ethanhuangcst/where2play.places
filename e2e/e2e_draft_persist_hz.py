#!/usr/bin/env python3
"""ADR-073 / 2play-plan-105: filled draft survives 我的行程 → 行程规划 (Hangzhou / AMAP)."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from db_helpers import BASE, delete_user
from playwright.sync_api import sync_playwright

EMAIL = "e2e.draft.persist.hz@where2play.place"
PASSWORD = "testpass123"
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT.parent / "specs" / "agent-specs" / "e2e-test-results"
UI_JSON = OUT_DIR / "_last-draft-persist-hz.json"


def click_locale_cn(page) -> None:
    btn = page.locator('[data-testid="locale-CN"]')
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(400)


def pick_trip_type(page, substring: str) -> None:
    trip_type = page.locator('[data-testid="plan-trip-type"]')
    if not trip_type.count():
        return
    trip_type.first.click()
    page.wait_for_timeout(400)
    opts = page.locator('[data-testid="plan-trip-type-option"]')
    n = opts.count()
    for i in range(n):
        if substring in opts.nth(i).inner_text():
            opts.nth(i).click()
            page.wait_for_timeout(200)
            return
    if n:
        opts.first.click()


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    delete_user(EMAIL)
    issues: list[str] = []
    notes: dict = {"ui": {}, "issues": issues}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.set_default_timeout(30000)

        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        click_locale_cn(page)
        page.fill('[data-testid="field-name"]', "Draft Persist HZ")
        page.fill('[data-testid="field-email"]', EMAIL)
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.click('[data-testid="register-submit"]')
        page.wait_for_url(re.compile(r".*/plan"), timeout=60000)
        click_locale_cn(page)
        page.wait_for_selector('[data-testid="plan-form"]')

        page.fill('[data-testid="plan-dest"]', "杭州")
        page.locator('[data-testid="plan-dest"]').blur()
        page.wait_for_selector('[data-testid="plan-dest-verified"]', timeout=25000)
        page.fill('[data-testid="plan-start-date"]', "2026-10-10")
        pick_trip_type(page, "情侣")
        page.fill('[data-testid="plan-days"]', "1")
        page.fill('[data-testid="plan-party"]', "2")
        page.select_option('[data-testid="plan-budget"]', "mid")
        page.select_option('[data-testid="plan-pace"]', "medium")
        page.select_option('[data-testid="plan-transit"]', "transit_walk")
        page.click('[data-testid="plan-submit"]')
        page.wait_for_selector('[data-testid="plan-submit-confirm-ok"]', timeout=15000)
        page.click('[data-testid="plan-submit-confirm-ok"]')
        page.wait_for_selector('[data-testid="plan-nav-takeover"]', timeout=30000)

        t0 = time.time()
        deadline = t0 + 300
        anchor_name = ""
        while time.time() < deadline:
            err = page.locator('[data-testid="plan-error"]')
            if err.count() and err.inner_text().strip():
                issues.append(f"plan-error: {err.inner_text().strip()[:200]}")
                break
            complete = page.locator('[data-testid="plan-thread-complete"]')
            itin = page.locator('[data-testid="plan-itinerary"]')
            if complete.count() and itin.count():
                text = itin.inner_text()
                for line in text.splitlines():
                    line = line.strip()
                    if len(line) >= 2 and line not in ("D1", "DAY 1", "Day 1"):
                        anchor_name = line[:80]
                        break
                if anchor_name:
                    break
            page.wait_for_timeout(800)

        notes["ui"]["wait_s"] = round(time.time() - t0, 1)
        notes["ui"]["anchor_name"] = anchor_name
        if not anchor_name:
            issues.append("filled itinerary anchor not captured within 300s")

        if not issues:
            page.click('[data-testid="nav-saved"]')
            page.wait_for_selector('[data-testid="saved-page"]', timeout=15000)
            page.click('[data-testid="nav-plan"]')
            page.wait_for_selector('[data-testid="plan-page"]', timeout=15000)
            page.wait_for_timeout(1500)

            itin = page.locator('[data-testid="plan-itinerary"]')
            if not itin.count():
                issues.append("plan-itinerary missing after return from saved")
            else:
                after = itin.inner_text()
                notes["ui"]["after_nav"] = after[:2000]
                if anchor_name not in after and anchor_name[:20] not in after:
                    issues.append("itinerary content lost after saved round-trip")
            fill_spine = page.locator('[data-testid="plan-thread-fill-timeline"]')
            complete = page.locator('[data-testid="plan-thread-complete"]')
            if not fill_spine.count() and not complete.count():
                issues.append("assistant fill spine or complete line missing after return")

        browser.close()

    UI_JSON.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(notes, ensure_ascii=False, indent=2))
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
