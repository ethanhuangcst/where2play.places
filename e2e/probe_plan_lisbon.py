#!/usr/bin/env python3
"""plan-14 live probe: Lisbon 1-day, timeFrom 09:30, couple trip.

Asserts the first block start_time lands within timeFrom ± 5min (AC3).
"""
import time

from db_helpers import BASE, delete_user
from playwright.sync_api import sync_playwright

EMAIL = "probe.lisbon@where2play.place"
PASSWORD = "testpass123"

BODY = {
    "destination": "里斯本",
    "days": 1,
    "startDate": "2026-09-20",
    "locale": "zh",
    "dailyStart": "Hills Hotel Lisboa",
    "dailyEnd": "Hills Hotel Lisboa",
    "timeFrom": "9:30",
    "timeTo": "20:00",
    "tripType": "情侣出游",
    "pace": "适中",
    "budget": "中等",
    "partySize": 2,
    "interests": ["老城", "海边"],
    "constraints": "不吃辣",
}


def main():
    delete_user(EMAIL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        page.fill('[data-testid="field-name"]', "Probe")
        page.fill('[data-testid="field-email"]', EMAIL)
        page.fill('[data-testid="field-location"]', "Lisbon")
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.locator('[data-testid="interest-tourist_attraction"]').click()
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan**", timeout=30000)

        start = time.time()
        events = page.evaluate(
            """async (body) => {
              const res = await fetch('/api/plan', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
                body: JSON.stringify(body),
              });
              if (!res.ok) return [{ type: 'http_error', status: res.status }];
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              let buf = '';
              const out = [];
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let nl = buf.indexOf('\\n');
                while (nl >= 0) {
                  const line = buf.slice(0, nl).trim();
                  buf = buf.slice(nl + 1);
                  if (line) out.push(JSON.parse(line));
                  nl = buf.indexOf('\\n');
                }
              }
              const tail = buf.trim();
              if (tail) out.push(JSON.parse(tail));
              return out;
            }""",
            BODY,
        )

        first_block_start = None
        first_block_name = None
        windows = []
        for ev in events:
            elapsed = time.time() - start
            et = ev.get("type", "?")
            extra = ""
            if et == "error":
                extra = f" key={ev.get('key')}"
            if et == "phase":
                extra = f" phase={ev.get('phase')}"
            if et == "slot_preview" and ev.get("window") and ev.get("kind") in ("place", "meal"):
                w = ev["window"]
                windows.append(w)
                if first_block_start is None:
                    first_block_start = w.split("–")[0]
                    first_block_name = ev.get("name")
            print(f"+{elapsed:7.1f}s {et}{extra}")

        print(f"\ntotal {time.time() - start:.1f}s events={len(events)}")
        print(f"first_block: {first_block_name} @ {first_block_start}")
        print(f"windows: {windows[:6]}")

        ok = False
        if first_block_start:
            h, m = first_block_start.split(":")
            mins = int(h) * 60 + int(m)
            ok = abs(mins - (9 * 60 + 30)) <= 5
        print(f"AC3 first block within 09:30±5min: {'PASS' if ok else 'FAIL'}")
        browser.close()


if __name__ == "__main__":
    main()
