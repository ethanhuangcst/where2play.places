#!/usr/bin/env python3
"""MVP-2 live journey: takeoff-11 Plan → save → saved list → detail → unsave."""

from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user

EMAIL = "mvp2.live@where2play.place"
PASSWORD = "testpass123"
DESTINATION = "杭州"


def ensure_user(page):
    page.goto(f"{BASE}/register")
    page.wait_for_selector('[data-testid="auth-form-register"]')
    page.fill('[data-testid="field-name"]', "MVP Two")
    page.fill('[data-testid="field-email"]', EMAIL)
    loc = page.locator('[data-testid="field-location"]')
    if loc.count():
        loc.fill("Clerkenwell, London")
    page.fill('[data-testid="field-password"]', PASSWORD)
    page.fill('[data-testid="field-confirm-password"]', PASSWORD)
    for testid in ("interest-tourist_attraction", "interest-restaurant"):
        chip = page.locator(f'[data-testid="{testid}"]')
        if chip.count():
            chip.click()
    page.click('[data-testid="register-submit"]')
    page.wait_for_url("**/plan**", timeout=30000)


def login_or_register(page):
    delete_user(EMAIL)
    ensure_user(page)


def test_mvp2_live():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        login_or_register(page)
        loc_btn = page.locator('[data-testid="locale-CN"]')
        if loc_btn.count():
            loc_btn.first.click()
            page.wait_for_timeout(300)
        page.wait_for_selector('[data-testid="plan-page"]', timeout=30000)
        page.wait_for_selector('[data-testid="plan-form"]', timeout=20000)
        page.wait_for_selector('[data-testid="plan-takeoff-11"]', timeout=15000)

        page.fill('[data-testid="plan-dest"]', DESTINATION)
        page.locator('[data-testid="plan-dest"]').blur()
        page.wait_for_selector('[data-testid="plan-dest-verified"]', timeout=20000)
        page.fill('[data-testid="plan-start-date"]', "2026-10-10")
        page.fill('[data-testid="plan-days"]', "3")
        page.fill('[data-testid="plan-party"]', "2")
        page.click('[data-testid="plan-submit"]')
        page.wait_for_selector('[data-testid="plan-submit-confirm-ok"]', timeout=15000)
        page.click('[data-testid="plan-submit-confirm-ok"]')

        page.wait_for_selector('[data-testid="plan-save"]:not([disabled])', timeout=300000)
        err = page.locator('[data-testid="plan-error"]:not([hidden])')
        if err.count() and err.is_visible():
            raise AssertionError(f"Plan error: {err.inner_text()}")

        slots = page.locator('[data-testid="plan-itinerary"] .slot')
        assert slots.count() > 0, "Expected itinerary slots after live generation"

        close_nav = page.locator('[data-testid="plan-nav-close"]')
        if close_nav.count():
            close_nav.click()
            page.wait_for_timeout(300)
        page.locator('[data-testid="plan-save"]').click(force=True)
        page.wait_for_selector('[data-testid="plan-save-notice"]', timeout=15000)

        page.goto(f"{BASE}/saved")
        page.wait_for_selector('[data-testid="trip-card"]', timeout=30000)
        page.click('[data-testid="trip-card"]')
        page.wait_for_selector('[data-testid="saved-detail-page"]', timeout=30000)
        page.wait_for_selector(".slot", timeout=30000)

        page.click('[data-testid="saved-unsave"]')
        page.wait_for_selector('[data-testid="saved-unsave-dialog"]')
        page.click('[data-testid="saved-unsave-confirm"]')
        page.wait_for_selector('[data-testid="saved-empty"]', timeout=30000)

        browser.close()


if __name__ == "__main__":
    test_mvp2_live()
    print("mvp2 live journey ok")
