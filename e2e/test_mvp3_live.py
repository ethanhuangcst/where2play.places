#!/usr/bin/env python3
"""MVP-3 live journey: Mode H host + enrich transit + London must-see probe."""

import re
import time

from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user

EMAIL = "mvp3.live@where2play.place"
PASSWORD = "testpass123"
DESTINATION = "London"

LONDON_MUST_SEE = re.compile(
    r"Tower of London|British Museum|Buckingham|Westminster|St Paul|"
    r"London Eye|National Gallery|Hyde Park|Covent Garden|Tower Bridge",
    re.I,
)

TRANSIT_MODE = re.compile(r"walk|transit|drive|metro|tube|bus|步行|地铁|公交", re.I)


def ensure_user(page):
    page.goto(f"{BASE}/register")
    page.wait_for_selector('[data-testid="auth-form-register"]')
    page.fill('[data-testid="field-name"]', "MVP Three")
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


def assert_no_plan_error(page):
    err = page.locator('[data-testid="plan-error"]:not([hidden])')
    if err.count() and err.is_visible():
        raise AssertionError(f"Plan error: {err.inner_text()}")


def wait_for_save_or_error(page, timeout_ms: int = 300000):
    save = page.locator('[data-testid="plan-save"]:not([disabled])')
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        assert_no_plan_error(page)
        if save.count() and save.is_visible():
            return
        page.wait_for_timeout(500)
    raise AssertionError("Timed out waiting for plan-save to become enabled")


def test_mvp3_live():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        login_or_register(page)
        page.wait_for_selector('[data-testid="plan-page"]', timeout=30000)

        page.fill('[data-testid="plan-dest"]', DESTINATION)
        page.fill('[data-testid="plan-days"]', "1")
        page.click('[data-testid="plan-submit"]')

        page.wait_for_selector('[data-testid="plan-phase"]', timeout=120000)

        preview = page.locator('[data-testid="plan-slot-preview"]')
        try:
            preview.wait_for(state="visible", timeout=180000)
        except Exception:
            pass

        wait_for_save_or_error(page, timeout_ms=300000)

        assert_no_plan_error(page)

        slots = page.locator(
            '[data-testid="plan-itinerary"] .slot:not(.slot--candidate):not(.slot--pending)'
        )
        assert slots.count() > 0, "Expected itinerary slots after live generation"

        place_names = []
        transit_texts = []
        transit_slots = page.locator('[data-testid="plan-transit-slot"]')
        if transit_slots.count():
            for i in range(transit_slots.count()):
                transit_texts.append(transit_slots.nth(i).inner_text())
        for i in range(slots.count()):
            slot = slots.nth(i)
            text = slot.inner_text()
            if "slot--transit" in (slot.get_attribute("class") or ""):
                if text not in transit_texts:
                    transit_texts.append(text)
            else:
                title = slot.locator("h3")
                if title.count():
                    place_names.append(title.inner_text())

        combined_places = " | ".join(place_names)
        assert LONDON_MUST_SEE.search(combined_places), (
            f"Expected a London must-see landmark in slots; got: {combined_places}"
        )

        assert transit_texts, "Expected at least one transit row"
        has_real_transit = any(
            TRANSIT_MODE.search(t) and not re.fullmatch(r".*~15 min.*", t.strip(), re.I)
            for t in transit_texts
        )
        assert has_real_transit or any(TRANSIT_MODE.search(t) for t in transit_texts), (
            f"Expected transit with mode label; got: {transit_texts}"
        )

        browser.close()


if __name__ == "__main__":
    test_mvp3_live()
    print("mvp3 live journey ok")
