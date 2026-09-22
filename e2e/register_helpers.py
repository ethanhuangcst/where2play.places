#!/usr/bin/env python3
"""Shared register helpers for where2play Playwright E2E."""

from __future__ import annotations

from playwright.sync_api import Page


def pick_nationality(
    page: Page,
    test_id: str = "register-nationality",
    code: str = "CHN",
) -> None:
    """Select an ISO nationality code from the combobox (BUG-002)."""
    root = page.locator(f'[data-testid="{test_id}"]')
    root.locator(f'[data-testid="{test_id}-input"]').click()
    page.locator(f'[data-testid="{test_id}-option"][data-value="{code}"]').click()
    assert root.get_attribute("data-value") == code
