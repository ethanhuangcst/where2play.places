#!/usr/bin/env python3
"""MVP-2 live journey: plan progressive → save → saved list → detail → unsave."""

from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user

EMAIL = "mvp2.live@where2play.place"
PASSWORD = "testpass123"
DESTINATION = "London"


def ensure_user(page):
    page.goto(f"{BASE}/register")
    page.wait_for_selector('[data-testid="auth-form-register"]')
    page.fill('[data-testid="field-name"]', "MVP Two")
    page.fill('[data-testid="field-email"]', EMAIL)
    page.fill('[data-testid="field-location"]', "Clerkenwell, London")
    page.fill('[data-testid="field-password"]', PASSWORD)
    page.fill('[data-testid="field-confirm-password"]', PASSWORD)
    page.locator('[data-testid="interest-tourist_attraction"]').click()
    page.locator('[data-testid="interest-restaurant"]').click()
    page.click('[data-testid="register-submit"]')
    page.wait_for_url("**/plan**", timeout=30000)


def login_or_register(page):
    delete_user(EMAIL)
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("domcontentloaded")
    if page.locator('[data-testid="auth-form-login"]').count():
        page.fill('[data-testid="field-email"]', EMAIL)
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.click('[data-testid="login-submit"]')
        try:
            page.wait_for_url("**/plan**", timeout=5000)
        except Exception:
            ensure_user(page)
    else:
        ensure_user(page)


def test_mvp2_live():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        login_or_register(page)
        page.wait_for_selector('[data-testid="plan-page"]', timeout=30000)

        page.wait_for_function(
            """() => {
              const a = document.querySelector('[data-testid="plan-interest-tourist_attraction"]');
              const b = document.querySelector('[data-testid="plan-interest-restaurant"]');
              return a?.classList.contains('is-on') && b?.classList.contains('is-on');
            }""",
            timeout=15000,
        )

        page.fill('[data-testid="plan-dest"]', DESTINATION)
        page.fill('[data-testid="plan-days"]', "1")
        page.click('[data-testid="plan-submit"]')

        page.wait_for_selector('[data-testid="plan-phase"]', timeout=120000)
        page.wait_for_selector('[data-testid="plan-save"]:not([disabled])', timeout=300000)

        err = page.locator('[data-testid="plan-error"]:not([hidden])')
        if err.count() and err.is_visible():
            raise AssertionError(f"Plan error: {err.inner_text()}")

        slots = page.locator('[data-testid="plan-itinerary"] .slot:not(.slot--candidate):not(.slot--pending)')
        assert slots.count() > 0, "Expected itinerary slots after live generation"

        page.click('[data-testid="plan-save"]')
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
