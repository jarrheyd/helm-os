#!/usr/bin/env python3
"""
PostToolUse recorder: append a successful tracker write to the ledger.

Runs after the write, so the create response carries the new issue key, which a
PreToolUse hook could not know. A create records source_ref -> external_id; a
comment records external_id plus content_hash. Any error exits 0. This hook only
appends state and never blocks.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ledger_lib as L  # noqa: E402


def _looks_successful(tool_response):
    if tool_response is None:
        return True  # no signal; assume the tool returned normally
    if isinstance(tool_response, dict):
        if tool_response.get("isError") or tool_response.get("error"):
            return False
    blob = tool_response if isinstance(tool_response, str) else json.dumps(tool_response)
    low = blob.lower()
    if '"iserror": true' in low or '"error"' in low[:200]:
        return False
    return True


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
    resp = data.get("tool_response")

    if not _looks_successful(resp):
        sys.exit(0)

    try:
        if op == "create":
            f = L.create_fields(ti)
            ext = L.recover_external_id(resp, ti)
            L.append_row(L.ledger_path(), {
                "op": "create", "tool": tool, "target": f["target"],
                "source_ref": f["source_ref"], "summary_norm": f["summary_norm"],
                "external_id": ext,
            })
        else:
            f = L.comment_fields(ti)
            if not f.get("is_update"):
                L.append_row(L.ledger_path(), {
                    "op": "comment", "tool": tool,
                    "external_id": f["external_id"],
                    "content_hash": f["content_hash"],
                    "source_ref": f["source_ref"],
                })
    except Exception:
        sys.exit(0)
    sys.exit(0)


if __name__ == "__main__":
    main()
