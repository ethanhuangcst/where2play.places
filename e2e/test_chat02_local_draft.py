#!/usr/bin/env python3
"""MVP-T9 chat-02: localStorage draft survives refresh on plan-nav composer."""

import json
import sys

from playwright.sync_api import sync_playwright

from takeoff_helpers import fill_takeoff_and_confirm

BASE = "http://localhost:3030"
CHAT_DRAFT_KEY = "w2p.chat.draft"


def test_chat02_local_draft():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(f"{BASE}/auth/register")
        email = f"chat02.{page.evaluate('Date.now()')}@where2play.place"
        page.get_by_label("Email").fill(email)
        page.get_by_label("Name", exact=True).fill("Chat02")
        page.locator('input[name="password"]').first.fill("testpass123")
        page.get_by_label("Confirm password").fill("testpass123")
        page.get_by_role("button", name="Create account").click()
        page.wait_for_url(f"{BASE}/plan**", timeout=60_000)

        fill_takeoff_and_confirm(page, destination="杭州", days=2)
        page.wait_for_selector('[data-testid="plan-thread-complete"]', timeout=300_000)

        composer = page.locator('[data-testid="plan-nav-input"]')
        composer.wait_for(state="visible", timeout=30_000)
        composer.fill("删掉一个景点")
        page.locator('[data-testid="plan-nav-send"]').click()

        page.wait_for_selector('[data-testid="plan-nav-refine-user"]', timeout=120_000)

        draft_raw = page.evaluate(f"localStorage.getItem('{CHAT_DRAFT_KEY}')")
        assert draft_raw, "expected chat draft in localStorage"
        draft = json.loads(draft_raw)
        assert any(m.get("role") == "user" for m in draft)

        page.reload()
        page.wait_for_selector('[data-testid="plan-nav-refine-user"]', timeout=60_000)

        browser.close()


if __name__ == "__main__":
    try:
        test_chat02_local_draft()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
    print("PASS: chat02 local draft")
