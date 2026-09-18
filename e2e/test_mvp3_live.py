#!/usr/bin/env python3
"""MVP-3 live journey (T3): takeoff-11 → agent skeleton+fill → itinerary + transit."""

import re
import time

from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user
from takeoff_helpers import fill_takeoff_and_confirm

EMAIL = "mvp3.live@where2play.place"
PASSWORD = "testpass123"
DESTINATION = "London"

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


def wait_for_plan_done(page, timeout_ms: int = 300000):
    """Wait for T3 fill completion: save enabled or assistant complete bubble."""
    save = page.locator('[data-testid="plan-save"]:not([disabled])')
    complete = page.locator('[data-testid="plan-thread-complete"]')
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        assert_no_plan_error(page)
        if save.count() and save.is_visible():
            return "save"
        if complete.count() and complete.is_visible():
            return "complete"
        page.wait_for_timeout(500)
    raise AssertionError(
        "Timed out waiting for plan-save or plan-thread-complete after T3 generation"
    )


def test_mvp3_live():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        login_or_register(page)
        page.wait_for_selector('[data-testid="plan-page"]', timeout=30000)

        fill_takeoff_and_confirm(
            page,
            destination=DESTINATION,
            days="1",
            party="2",
            trip_type_substring="Couple",
        )

        page.wait_for_selector('[data-testid="plan-nav-takeover"]', timeout=120000)
        wait_for_plan_done(page, timeout_ms=300000)

        assert_no_plan_error(page)

        slots = page.locator(
            '[data-testid="plan-itinerary"] .slot:not(.slot--candidate):not(.slot--pending)'
        )
        assert slots.count() > 0, "Expected itinerary slots after live T3 generation"

        transit_texts = []
        transit_slots = page.locator('[data-testid="plan-transit-slot"]')
        if transit_slots.count():
            for i in range(transit_slots.count()):
                transit_texts.append(transit_slots.nth(i).inner_text())

        assert transit_texts, "Expected at least one transit row"
        assert any(TRANSIT_MODE.search(t) for t in transit_texts), (
            f"Expected transit with mode label; got: {transit_texts}"
        )

        browser.close()


if __name__ == "__main__":
    test_mvp3_live()
    print("mvp3 live journey ok")
