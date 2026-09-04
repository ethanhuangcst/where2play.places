#!/usr/bin/env bash
# Gate: app/mockup.css must contain MVP-10 structural rules synced from
# 2play-specs/ui-mockup/assets/mockup.css (§12 plan-takeoff / plan-nav / constraint-grid).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC_CSS="$ROOT/2play-specs/ui-mockup/assets/mockup.css"
APP_CSS="$ROOT/app/mockup.css"

required_selectors=(
  ".plan-takeoff"
  ".plan-nav"
  ".plan-nav.is-open"
  ".plan-nav__panel"
  ".plan-nav-launch"
  ".constraint-grid"
  ".plan-travel-tips"
  ".plan-nav__quick"
)

fail=0
for sel in "${required_selectors[@]}"; do
  if ! grep -qF "$sel" "$APP_CSS"; then
    echo "FAIL: missing selector in app/mockup.css: $sel"
    fail=1
  fi
done

spec_count=$(grep -cE 'plan-nav|plan-takeoff|constraint-grid|plan-constraints|plan-travel-tips' "$SPEC_CSS" || true)
app_count=$(grep -cE 'plan-nav|plan-takeoff|constraint-grid|plan-constraints|plan-travel-tips' "$APP_CSS" || true)

if [ "$app_count" -lt "$spec_count" ]; then
  echo "FAIL: app/mockup.css MVP-10 rule count ($app_count) < spec ($spec_count)"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "Re-sync: tail -n +2824 2play-specs/ui-mockup/assets/mockup.css >> app/mockup.css"
  exit 1
fi

echo "OK: MVP-10 CSS structural selectors present ($app_count rules)"
