"""Shared takeoff-11 helpers for Playwright E2E (T3 flow)."""

from __future__ import annotations

from playwright.sync_api import Page


def pick_trip_type(page: Page, substring: str) -> None:
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


def fill_takeoff_and_confirm(
    page: Page,
    *,
    destination: str,
    days: str = "3",
    start_date: str = "2026-10-10",
    party: str = "2",
    trip_type_substring: str = "情侣",
) -> None:
    """Fill takeoff-11, geocode-verify destination, open confirm overlay, confirm."""
    page.wait_for_selector('[data-testid="plan-form"]', timeout=20000)
    page.wait_for_selector('[data-testid="plan-takeoff-11"]', timeout=15000)

    dest = page.locator('[data-testid="plan-dest"]')
    dest.fill(destination)
    dest.blur()
    try:
        page.wait_for_selector('[data-testid="plan-dest-verified"]', timeout=45000)
    except Exception:
        dest.click()
        dest.fill(destination)
        dest.blur()
        page.wait_for_selector('[data-testid="plan-dest-verified"]', timeout=45000)
    page.fill('[data-testid="plan-start-date"]', start_date)
    pick_trip_type(page, trip_type_substring)
    page.fill('[data-testid="plan-days"]', days)
    page.fill('[data-testid="plan-party"]', party)
    page.click('[data-testid="plan-submit"]')
    page.wait_for_selector('[data-testid="plan-submit-confirm-ok"]', timeout=15000)
    page.click('[data-testid="plan-submit-confirm-ok"]')
