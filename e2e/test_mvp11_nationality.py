#!/usr/bin/env python3
"""Opt-in E2E: nationality combobox on register/profile (TC-M11-38-E2E)."""
import os
import sys

if os.environ.get("W2P_E2E_NATIONALITY") != "1":
    print("SKIP: set W2P_E2E_NATIONALITY=1 to run MVP-11 nationality E2E")
    sys.exit(0)

from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user

EMAIL = "mvp11.nationality@where2play.place"
PASSWORD = "testpass123"


def pick_nationality(page, test_id: str, code: str) -> None:
    root = page.locator(f'[data-testid="{test_id}"]')
    root.locator(f'[data-testid="{test_id}-input"]').click()
    page.locator(f'[data-testid="{test_id}-option"][data-value="{code}"]').click()
    assert root.get_attribute("data-value") == code


def test_mvp11_nationality_e2e():
    delete_user(EMAIL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        page.fill('[data-testid="field-name"]', "Nat User")
        page.fill('[data-testid="field-email"]', EMAIL)
        pick_nationality(page, "register-nationality", "CHN")
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan")

        page.goto(f"{BASE}/profile")
        page.wait_for_selector('[data-testid="profile-nationality"]')
        assert page.locator('[data-testid="profile-nationality"]').get_attribute("data-value") == "CHN"

        pick_nationality(page, "profile-nationality", "USA")
        page.click('[data-testid="profile-save"]')
        page.wait_for_selector("[data-profile-saved]")
        page.reload()
        page.wait_for_selector('[data-testid="profile-nationality"]')
        assert page.locator('[data-testid="profile-nationality"]').get_attribute("data-value") == "USA"

        delete_user("mvp11.skip@where2play.place")
        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        page.fill('[data-testid="field-name"]', "Skip Nat")
        page.fill('[data-testid="field-email"]', "mvp11.skip@where2play.place")
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan")
        page.goto(f"{BASE}/profile")
        page.wait_for_selector('[data-testid="profile-nationality"]')
        assert page.locator('[data-testid="profile-nationality"]').get_attribute("data-value") in (
            None,
            "",
        )

        browser.close()


if __name__ == "__main__":
    test_mvp11_nationality_e2e()
    print("test_mvp11_nationality: PASS")
