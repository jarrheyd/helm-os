#!/usr/bin/env python3
"""
Seed the write-ledger from existing open tickets, so a re-run does not recreate
a ticket that already exists.

Reads a JSON array on stdin, each item: {external_id, summary, target, source_ref?}.
Appends one create row per item (skipping external_ids already recorded). The
agent fetches open issues per project via the tracker MCP and pipes them here.

Usage: python3 backfill.py < issues.json    (respects WRITE_LEDGER_DIR)
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "hooks"))
import ledger_lib as L  # noqa: E402

def main():
    try:
        items = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, ValueError):
        print("stdin is not valid JSON", file=sys.stderr); sys.exit(1)
    if not isinstance(items, list):
        print("expected a JSON array", file=sys.stderr); sys.exit(1)

    seen = {r.get("external_id") for r in L.read_ledger()
            if r.get("op") == "create" and r.get("external_id")}
    added = 0
    for it in items:
        ext = it.get("external_id")
        if not ext or ext in seen:
            continue
        L.append_row(L.ledger_path(), {
            "op": "create", "tool": "backfill", "target": it.get("target"),
            "source_ref": it.get("source_ref"),
            "summary_norm": L.norm_text(it.get("summary")),
            "external_id": ext,
        })
        seen.add(ext); added += 1
    print("backfilled %d issues into %s" % (added, L.ledger_path()))

if __name__ == "__main__":
    main()
