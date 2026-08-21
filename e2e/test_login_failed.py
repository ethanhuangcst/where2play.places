#!/usr/bin/env python3
from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user

EMAIL = "login.failed@where2play.place"
PASSWORD = "testpass123"


def ensure_user():
    delete_user(EMAIL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        page.fill('[data-testid="field-name"]', "Login Fail Test")
        page.fill('[data-testid="field-email"]', EMAIL)
        page.fill('[data-testid="field-location"]', "Clerkenwell, London")
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan")
        browser.close()


def test_login_failed_shows_error():
    ensure_user()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"{BASE}/login")
        page.wait_for_selector('[data-testid="auth-form-login"]')
        page.fill('[data-testid="field-email"]', EMAIL)
        page.fill('[data-testid="field-password"]', "wrong-password")
        page.locator('[data-testid="login-submit"]').click()
        error = page.locator('[data-error][role="alert"]')
        error.wait_for(state="visible", timeout=10000)
        assert "/login" in page.url
        assert "password=" not in page.url
        browser.close()


if __name__ == "__main__":
    test_login_failed_shows_error()
    print("login failed test ok")
