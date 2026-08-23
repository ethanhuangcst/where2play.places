#!/usr/bin/env python3
"""Stream POST /api/plan via browser fetch and print event types."""
import time

from db_helpers import BASE, delete_user
from playwright.sync_api import sync_playwright

EMAIL = "probe.plan@where2play.place"
PASSWORD = "testpass123"


def main():
    delete_user(EMAIL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{BASE}/register")
        page.wait_for_selector('[data-testid="auth-form-register"]')
        page.fill('[data-testid="field-name"]', "Probe")
        page.fill('[data-testid="field-email"]', EMAIL)
        page.fill('[data-testid="field-location"]', "Clerkenwell, London")
        page.fill('[data-testid="field-password"]', PASSWORD)
        page.fill('[data-testid="field-confirm-password"]', PASSWORD)
        page.locator('[data-testid="interest-tourist_attraction"]').click()
        page.click('[data-testid="register-submit"]')
        page.wait_for_url("**/plan**", timeout=30000)

        start = time.time()
        events = page.evaluate(
            """async () => {
              const res = await fetch('/api/plan', {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/x-ndjson',
                },
                body: JSON.stringify({
                  destination: 'London',
                  days: 1,
                  startDate: new Date().toISOString().slice(0, 10),
                  locale: 'en',
                  interests: ['tourist_attraction', 'restaurant'],
                }),
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
            }"""
        )
        for ev in events:
            elapsed = time.time() - start
            et = ev.get("type", "?")
            extra = ""
            if et == "error":
                extra = f" key={ev.get('key')}"
            if et == "phase":
                extra = f" phase={ev.get('phase')}"
            print(f"+{elapsed:7.1f}s {et}{extra}")
        print(f"total {time.time() - start:.1f}s events={len(events)}")
        browser.close()


if __name__ == "__main__":
    main()
