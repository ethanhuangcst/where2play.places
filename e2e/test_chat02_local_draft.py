#!/usr/bin/env python3
"""MVP-4 story chat-02: localStorage draft survives refresh; logout clears."""

import json

from playwright.sync_api import sync_playwright

from db_helpers import BASE, delete_user

EMAIL = "chat02.draft@where2play.place"
PASSWORD = "testpass123"

MIN_PLAN_CURRENT = {
    "ok": True,
    "criteria": {
        "destination": "London",
        "days": 1,
        "startDate": "2026-08-23",
        "interests": ["tourist_attraction"],
    },
    "itinerary": {
        "title": "London",
        "destination": "London",
        "days": [
            {
                "dayIndex": 1,
                "highlights": {"label": "Day 1", "title": "London", "tags": []},
                "slots": [
                    {
                        "kind": "place",
                        "start": "09:00",
                        "end": "11:00",
                        "placeKind": "attraction",
                        "name": "British Museum",
                        "summary": "Museum visit",
                    }
                ],
            }
        ],
    },
}

CHAT_DONE_NDJSON = (
    '{"type":"token","text":"Saved locally"}\n'
    '{"type":"done","reply":"Saved locally"}\n'
)


def ensure_user(page):
    page.goto(f"{BASE}/register")
    page.wait_for_selector('[data-testid="auth-form-register"]')
    page.fill('[data-testid="field-name"]', "Chat Two")
    page.fill('[data-testid="field-email"]', EMAIL)
    page.fill('[data-testid="field-location"]', "Clerkenwell, London")
    page.fill('[data-testid="field-password"]', PASSWORD)
    page.fill('[data-testid="field-confirm-password"]', PASSWORD)
    page.locator('[data-testid="interest-tourist_attraction"]').click()
    page.click('[data-testid="register-submit"]')
    page.wait_for_url("**/plan**", timeout=30000)


def login_user(page):
    page.goto(f"{BASE}/login")
    page.wait_for_selector('[data-testid="auth-form-login"]')
    page.fill('[data-testid="field-email"]', EMAIL)
    page.fill('[data-testid="field-password"]', PASSWORD)
    page.click('[data-testid="login-submit"]')
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


def stub_plan_current(page):
    body = json.dumps(MIN_PLAN_CURRENT)

    def handler(route):
        if route.request.method == "GET":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=body,
            )
        else:
            route.continue_()

    page.route("**/api/plan/current", handler)


def stub_chat(page):
    def handler(route):
        route.fulfill(
            status=200,
            content_type="application/x-ndjson",
            body=CHAT_DONE_NDJSON,
        )

    page.route("**/api/chat", handler)


def test_chat02_local_draft():
    user_msg = "Keep this draft after refresh"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        login_or_register(page)
        stub_plan_current(page)
        stub_chat(page)
        page.reload()
        page.wait_for_selector('[data-testid="plan-page"]', timeout=30000)
        page.wait_for_selector('[data-testid="plan-chat"]', timeout=15000)
        page.wait_for_selector('[data-testid="chat-draft-hint"]', timeout=15000)

        page.fill('[data-testid="chat-input"]', user_msg)
        page.click('[data-testid="chat-send"]')
        page.wait_for_selector(f'text="{user_msg}"', timeout=15000)
        page.wait_for_selector('text="Saved locally"', timeout=15000)

        page.reload()
        page.wait_for_selector('[data-testid="chat-transcript"]', timeout=15000)
        transcript = page.locator('[data-testid="chat-transcript"]').inner_text()
        assert user_msg in transcript, f"Draft missing after refresh: {transcript}"
        assert "Saved locally" in transcript

        page.click('[data-testid="nav-logout"]')
        page.wait_for_url(f"{BASE}/**", timeout=15000)

        login_user(page)
        stub_plan_current(page)
        page.reload()
        page.wait_for_selector('[data-testid="chat-transcript"]', timeout=15000)
        after_logout = page.locator('[data-testid="chat-transcript"]').inner_text()
        assert user_msg not in after_logout, f"Draft should clear on logout: {after_logout}"

        browser.close()


if __name__ == "__main__":
    test_chat02_local_draft()
    print("chat-02 local draft journey ok")
