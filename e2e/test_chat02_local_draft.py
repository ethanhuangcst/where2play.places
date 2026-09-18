#!/usr/bin/env python3
"""MVP-4 story chat-02: localStorage draft survives refresh; logout clears.

Deferred until MVP-T9 (in-page chat via PlanAssistantNav). PlanChatPanel is not
mounted on plan-page; rewrite this E2E when 2play-plan-90e lands.
"""

import sys

DEFER_MSG = (
    "chat-02 E2E deferred to MVP-T9: PlanChatPanel removed from plan-page; "
    "draft tests will target plan-nav composer + localStorage."
)


def test_chat02_local_draft():
    print(f"SKIP: {DEFER_MSG}")
    sys.exit(0)


if __name__ == "__main__":
    test_chat02_local_draft()
