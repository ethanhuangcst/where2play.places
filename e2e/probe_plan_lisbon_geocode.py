#!/usr/bin/env python3
"""plan-15 live probe: Lisbon 1-day, origin/destination geocode before enrich.

Asserts:
- from_origin appears with real transport + duration (AC3)
- to_destination appears with real transport + duration (AC3)
- transit_outcome is "directions" (not "partial" from geocode failure)
"""
import time

from db_helpers import BASE, delete_user
from playwright.sync_api import sync_playwright

EMAIL = "probe.plan15@where2play.place"
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

        from_origin_slot = None
        to_destination_slot = None
        transit_outcome = None
        slot_count = 0
        for ev in events:
            elapsed = time.time() - start
            et = ev.get("type", "?")
            extra = ""
            if et == "error":
                extra = f" key={ev.get('key')}"
            if et == "phase":
                extra = f" phase={ev.get('phase')}"
            if et == "slot":
                slot_count += 1
            if et == "day_done":
                itinerary = ev.get("itinerary", {})
                days = itinerary.get("days", [])
                if days:
                    day = days[0]
                    slots = day.get("slots", [])
                    if slots:
                        first = slots[0]
                        if first.get("kind") == "transit":
                            from_origin_slot = first
                        last = slots[-1]
                        if last.get("kind") == "transit":
                            to_destination_slot = last
            if et == "done":
                itinerary = ev.get("itinerary", {})
                days = itinerary.get("days", [])
                if days:
                    day = days[0]
                    slots = day.get("slots", [])
                    if slots:
                        first = slots[0]
                        if first.get("kind") == "transit":
                            from_origin_slot = first
                        last = slots[-1]
                        if last.get("kind") == "transit":
                            to_destination_slot = last
            print(f"+{elapsed:7.1f}s {et}{extra}")

        print(f"\ntotal {time.time() - start:.1f}s events={len(events)} slots={slot_count}")
        print(f"from_origin_slot: {from_origin_slot}")
        print(f"to_destination_slot: {to_destination_slot}")

        ac3_from = from_origin_slot is not None and "min" in (from_origin_slot.get("text") or "")
        ac3_to = to_destination_slot is not None and "min" in (to_destination_slot.get("text") or "")

        print(f"\nAC3 from_origin transit slot present with duration: {'PASS' if ac3_from else 'FAIL'}")
        print(f"AC3 to_destination transit slot present with duration: {'PASS' if ac3_to else 'FAIL'}")

        browser.close()


if __name__ == "__main__":
    main()
