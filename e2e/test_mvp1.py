#!/usr/bin/env python3
from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user

EMAIL = "mvp1.test@where2play.place"
PASSWORD = "testpass123"


def test_mvp1_journey():
    delete_user(EMAIL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        page.wait_for_selector('[data-testid="home-headline"]')
        page.click('[data-testid="home-register"]')
        page.wait_for_selector('[data-testid="auth-form-register"]')

        page.fill('[data-testid="field-name"]', "MVP One")
        page.fill('[data-testid="field-email"]', EMAIL)
        page.locator("#age").fill("30")
        page.fill('[data-testid="field-location"]', "Clerkenwell, London")
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.locator('[data-testid="interest-museum"]').click()
        page.locator('[data-testid="interest-park"]').click()
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan")
        assert "password=" not in page.url
        page.wait_for_selector('[data-testid="plan-placeholder"]')
        page.wait_for_selector('[data-testid="header-hello"]')

        page.click('[data-testid="nav-profile"]')
        page.wait_for_selector('[data-testid="profile-page"]')
        page.wait_for_selector('[data-testid="profile-interests"]')
        assert page.locator('[data-testid="interest-museum"].is-on').count() == 1
        page.locator('[data-testid="interest-spa"]').click()
        page.click('[data-testid="profile-save"]')
        page.wait_for_selector("[data-profile-saved]")

        page.click('[data-testid="nav-logout"]')
        page.wait_for_url("**/")

        page.goto(f"{BASE}/login")
        page.wait_for_selector('[data-testid="auth-form-login"]')
        page.fill('[data-testid="field-email"]', EMAIL)
        page.fill('[data-testid="field-password"]', PASSWORD)
        with page.expect_response(
            lambda r: "/api/auth/login" in r.url and r.request.method == "POST",
            timeout=15000,
        ) as resp_info:
            page.locator('[data-testid="login-submit"]').click()
        assert resp_info.value.status == 200, resp_info.value.text()
        assert "password=" not in page.url
        page.wait_for_selector('[data-testid="plan-placeholder"]', timeout=30000)

        page.goto(f"{BASE}/profile")
        page.wait_for_selector('[data-testid="profile-interests"]')
        page.wait_for_function(
            """() => {
              const museum = document.querySelector('[data-testid="interest-museum"]');
              const spa = document.querySelector('[data-testid="interest-spa"]');
              return museum?.classList.contains('is-on') && spa?.classList.contains('is-on');
            }""",
            timeout=15000,
        )

        page.goto(BASE)
        page.click('[data-testid="locale-CN"]')
        page.wait_for_selector('[data-testid="home-headline"]')
        assert page.locator('[data-testid="family-footer"]').is_visible()

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mobile.goto(BASE)
        mobile.wait_for_selector('[data-testid="home-headline"]')
        assert mobile.locator('[data-testid="family-footer"]').is_visible()
        mobile.click('[data-testid="home-register"]')
        mobile.wait_for_selector('[data-testid="auth-form-register"]')
        # Gender optional: skip gender, still can fill required fields
        assert mobile.locator("#gender option").count() >= 1

        browser.close()


if __name__ == "__main__":
    test_mvp1_journey()
    print("mvp1 journey ok")
