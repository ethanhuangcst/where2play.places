#!/usr/bin/env python3
"""T3 live signoff: Hangzhou 3d takeoff-11 → assistant → skeleton.

Servers must already be up (or started via with_server).
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from db_helpers import BASE, delete_user
from playwright.sync_api import sync_playwright

EMAIL = "e2e.t3.skeleton.hz@where2play.place"
PASSWORD = "testpass123"
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT.parent / "specs" / "agent-specs" / "e2e-test-results"
SHOT = OUT_DIR / "signoff-hangzhou-3d-t3-ui.png"
UI_JSON = OUT_DIR / "_last-t3-skeleton-hz.json"


def click_locale_cn(page) -> None:
    btn = page.locator('[data-testid="locale-CN"]')
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(400)


def pick_trip_type(page, substring: str) -> None:
    toggle = page.locator('[data-testid="plan-trip-type-toggle"]')
    if toggle.count():
        toggle.first.click(force=True)
        page.wait_for_timeout(400)
    opts = page.locator('[data-testid="plan-trip-type-option"]')
    n = opts.count()
    for i in range(n):
        text = opts.nth(i).inner_text()
        if substring in text:
            opts.nth(i).click()
            page.wait_for_timeout(200)
            return
    if n:
        opts.first.click()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    delete_user(EMAIL)
    notes: dict = {"ui": {}, "issues": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.set_default_timeout(30000)

        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        click_locale_cn(page)
        page.fill('[data-testid="field-name"]', "T3 Hangzhou")
        page.fill('[data-testid="field-email"]', EMAIL)
        loc = page.locator('[data-testid="field-location"]')
        if loc.count():
            loc.fill("Hangzhou")
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        interest = page.locator('[data-testid="interest-tourist_attraction"]')
        if interest.count():
            interest.click()
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan**", timeout=30000)
        click_locale_cn(page)
        page.wait_for_selector('[data-testid="plan-form"]')
        page.wait_for_selector('[data-testid="plan-takeoff-11"]')

        page.fill('[data-testid="plan-dest"]', "杭州")
        page.locator('[data-testid="plan-dest"]').blur()
        page.wait_for_selector('[data-testid="plan-dest-verified"]', timeout=20000)
        page.fill('[data-testid="plan-start-date"]', "2026-10-10")
        pick_trip_type(page, "情侣")
        page.fill('[data-testid="plan-days"]', "3")
        page.fill('[data-testid="plan-party"]', "2")
        page.select_option('[data-testid="plan-budget"]', "luxury")
        page.select_option('[data-testid="plan-pace"]', "relaxed")
        origin = page.locator('[data-testid="plan-origin"]')
        if origin.count():
            origin.fill("SFEEL设计师酒店(杭州西湖武林广场店)")
            origin.blur()
            page.wait_for_timeout(1500)
            overlay = page.locator('[data-testid="plan-origin-overlay"]')
            if overlay.count():
                first_btn = overlay.locator("ul button").first
                if first_btn.count():
                    first_btn.click()
                else:
                    skip = page.locator('[data-testid="plan-origin-skip"]')
                    if skip.count():
                        skip.click()
        start_time = page.locator('[data-testid="plan-start-time"]')
        if start_time.count():
            start_time.fill("09:00")
        page.select_option('[data-testid="plan-transit"]', "drive_walk")

        page.click('[data-testid="plan-submit"]')
        page.wait_for_selector('[data-testid="plan-submit-confirm-ok"]', timeout=15000)
        page.click('[data-testid="plan-submit-confirm-ok"]')
        page.wait_for_selector('[data-testid="plan-nav-takeover"]', timeout=30000)

        if page.locator('[data-testid="plan-nav-skip-need"]').count():
            notes["issues"].append("skip button present")
        if page.locator('[data-testid="plan-nav-redo-need"]').count():
            notes["issues"].append("redo button present")

        t0 = time.time()
        deadline = t0 + 180
        skeleton_text = ""
        thread_text = ""
        while time.time() < deadline:
            err = page.locator('[data-testid="plan-error"]')
            if err.count() and err.inner_text().strip():
                notes["ui"]["error"] = err.inner_text().strip()
                notes["issues"].append(f"plan-error: {notes['ui']['error']}")
                break
            skel = page.locator('[data-testid="plan-thread-skeleton"]')
            if skel.count():
                skeleton_text = skel.inner_text()
                notes["ui"]["skeleton_preview"] = skeleton_text[:2500]
                break
            thread = page.locator('[data-testid="plan-nav-thread"]')
            if thread.count():
                thread_text = thread.inner_text()
                if "DAY 1" in thread_text and ("景点" in thread_text or "attraction" in thread_text.lower()):
                    notes["ui"]["filled_thread"] = True
                    break
            page.wait_for_timeout(500)

        notes["ui"]["wait_s"] = round(time.time() - t0, 1)
        thread = page.locator('[data-testid="plan-nav-thread"]')
        if thread.count():
            thread_text = thread.inner_text()
            notes["ui"]["thread"] = thread_text[:3500]
        if not skeleton_text and not notes["ui"].get("filled_thread"):
            notes["issues"].append("skeleton/filled itinerary not visible within 180s")
        combined = f"{skeleton_text}\n{thread_text}"
        if "family_kids" in combined:
            notes["issues"].append("raw trip_type slug family_kids in UI")
        if "扩大至" in combined or "expand_radius" in combined:
            notes["issues"].append("false expand_radius copy on Hangzhou")
        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()

    UI_JSON.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"shot": str(SHOT), **notes}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if notes["issues"] else 0)


if __name__ == "__main__":
    main()
