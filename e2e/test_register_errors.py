#!/usr/bin/env python3
from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user

EMAIL = "register.errors@where2play.place"
PASSWORD = "testpass123"


def fill_register_form(page, password=PASSWORD, confirm=None):
    page.fill('[data-testid="field-name"]', "Error Test")
    page.fill('[data-testid="field-email"]', EMAIL)
    page.fill('[data-testid="field-password"]', password)
    page.fill('[data-testid="field-confirm-password"]', confirm if confirm is not None else password)
    page.locator("#age").fill("30")


def test_register_password_short_shows_field_error():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        fill_register_form(page, password="abc", confirm="abc")
        page.click('[data-testid="register-submit"]')
        page.wait_for_selector('[data-field-error="password"]')
        assert page.locator('[data-field-error="password"]').is_visible()
        assert page.locator('[data-testid="auth-form-error"]').count() == 0
        browser.close()


def test_register_email_taken_shows_field_error():
    delete_user(EMAIL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        fill_register_form(page)
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan")

        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        fill_register_form(page)
        page.click('[data-testid="register-submit"]')
        page.wait_for_selector('[data-field-error="email"]')
        assert page.locator('[data-field-error="email"]').is_visible()
        browser.close()


if __name__ == "__main__":
    test_register_password_short_shows_field_error()
    test_register_email_taken_shows_field_error()
    print("register error tests ok")
