#!/usr/bin/env python3
from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user, seed_reset_token

EMAIL = "reset.flow@where2play.place"
OLD_PASSWORD = "testpass123"
NEW_PASSWORD = "newpass456"
RESET_TOKEN = "e2e-reset-token-valid-001"
EXPIRED_TOKEN = "e2e-reset-token-expired-002"


def register_user(page):
    page.goto(f"{BASE}/register")
    page.wait_for_selector('[data-testid="auth-form-register"]')
    page.fill('[data-testid="field-name"]', "Reset Flow")
    page.fill('[data-testid="field-email"]', EMAIL)
    page.fill('[data-testid="field-location"]', "Clerkenwell, London")
    page.fill('[data-testid="field-password"]', OLD_PASSWORD)
    page.fill('[data-testid="field-confirm-password"]', OLD_PASSWORD)
    page.click('[data-testid="register-submit"]')
    page.wait_for_url("**/plan")


def login(page, email: str, password: str):
    page.goto(f"{BASE}/login")
    page.wait_for_selector('[data-testid="auth-form-login"]')
    page.fill('[data-testid="field-email"]', email)
    page.fill('[data-testid="field-password"]', password)
    with page.expect_response(
        lambda r: "/api/auth/login" in r.url and r.request.method == "POST",
        timeout=15000,
    ) as resp_info:
        page.locator('[data-testid="login-submit"]').click()
    assert resp_info.value.status == 200
    assert "password=" not in page.url


def test_reset_set_password_flow():
    delete_user(EMAIL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        register_user(page)

        page.goto(f"{BASE}/reset-password")
        page.wait_for_selector('[data-testid="auth-form-reset"]')
        page.fill('[data-testid="field-email"]', EMAIL)
        page.locator('[data-testid="reset-submit"]').click()
        page.wait_for_selector("[data-sent]")
        assert "password=" not in page.url

        seed_reset_token(EMAIL, RESET_TOKEN)
        page.goto(f"{BASE}/set-password?token={RESET_TOKEN}")
        page.wait_for_selector('[data-testid="auth-form-set-password"]')
        page.fill('[data-testid="field-password"]', NEW_PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', NEW_PASSWORD)
        page.locator('[data-testid="set-password-submit"]').click()
        page.wait_for_selector("[data-set-done]:not([hidden])")

        login(page, EMAIL, NEW_PASSWORD)
        page.wait_for_selector('[data-testid="plan-placeholder"]', timeout=30000)
        browser.close()


def test_expired_reset_token_shows_error():
    delete_user(EMAIL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        register_user(page)
        seed_reset_token(EMAIL, EXPIRED_TOKEN, expired=True)

        page.goto(f"{BASE}/set-password?token={EXPIRED_TOKEN}")
        page.wait_for_selector('[data-testid="auth-form-set-password"]')
        page.fill('[data-testid="field-password"]', NEW_PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', NEW_PASSWORD)
        page.locator('[data-testid="set-password-submit"]').click()
        page.wait_for_selector("[data-set-error-session]")
        assert page.locator("[data-set-error-session]").is_visible()
        browser.close()


if __name__ == "__main__":
    test_reset_set_password_flow()
    test_expired_reset_token_shows_error()
    print("reset/set-password tests ok")
