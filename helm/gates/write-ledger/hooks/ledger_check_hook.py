#!/usr/bin/env python3
"""
PreToolUse gate: block a tracker write that duplicates a prior one.

Matches tracker create/comment tools (see ledger_lib CREATE/COMMENT_SUFFIXES).
On a duplicate it prints the reason to stderr and exits 2 (block) when
LEDGER_ENFORCE=1; in shadow mode (default) it logs what it would have blocked to
.ledger-shadow.jsonl and exits 0. Any error exits 0 so a real write is never
broken by this gate. Bypass a session with DISABLE_ANTI_SLOP_HOOK=1.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ledger_lib as L  # noqa: E402


def main():
    if L.bypassed():
        sys.exit(0)
    try:
        data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool = data.get("tool_name", "")
    op = L.op_for(tool)
    if op is None:
        sys.exit(0)
    ti = data.get("tool_input", {}) or {}

    try:
        fields = L.create_fields(ti) if op == "create" else L.comment_fields(ti)
        reason = L.find_duplicate(op, fields)
    except Exception:
        sys.exit(0)

    if not reason:
        sys.exit(0)

    if L.enforcing():
        sys.stderr.write(
            "Write-ledger BLOCKED a duplicate %s: %s.\n"
            "The item already exists. Comment on the existing issue or skip.\n"
            "Override this session with DISABLE_ANTI_SLOP_HOOK=1.\n" % (op, reason)
        )
        sys.exit(2)

    # shadow mode: record the would-be block, do not stop the write
    L.append_row(L.shadow_path(), {
        "would_block": True, "op": op, "tool": tool, "reason": reason,
        "fields": {k: v for k, v in fields.items() if k != "content_hash"},
    })
    sys.exit(0)


if __name__ == "__main__":
    main()
