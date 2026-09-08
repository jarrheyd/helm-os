#!/usr/bin/env python3
"""Standalone test for the write-ledger hooks. Run: python3 test_write_ledger.py"""
import json, os, subprocess, sys, tempfile

HOOKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hooks")
CHECK = os.path.join(HOOKS, "ledger_check_hook.py")
RECORD = os.path.join(HOOKS, "ledger_record_hook.py")

# real per-session tool names use an mcp__<uuid>__ prefix; test the suffix match
ATL = "mcp__3be877d3-c012-4ee0-b443-23f5cf7a5bee__"
PB = "mcp__jira-generic__"

passed = 0
failed = 0

def run(script, payload, env):
    p = subprocess.run(["python3", script], input=json.dumps(payload),
                       capture_output=True, text=True, env=env)
    return p.returncode, p.stderr

def check(name, cond):
    global passed, failed
    if cond:
        passed += 1
        print("  ok  ", name)
    else:
        failed += 1
        print("  FAIL", name)

def env_for(d, enforce):
    e = dict(os.environ)
    e["WRITE_LEDGER_DIR"] = d
    e["LEDGER_ENFORCE"] = "1" if enforce else "0"
    e.pop("DISABLE_ANTI_SLOP_HOOK", None)
    return e

def ledger_rows(d):
    p = os.path.join(d, "write-ledger.jsonl")
    if not os.path.exists(p):
        return []
    return [json.loads(l) for l in open(p) if l.strip()]

with tempfile.TemporaryDirectory() as d:
    enf = env_for(d, enforce=True)
    shadow = env_for(d, enforce=False)

    # 1. fresh Atlassian create -> allowed (exit 0), nothing in ledger yet (check is read-only)
    create = {"tool_name": ATL+"createJiraIssue",
              "tool_input": {"cloudId":"c","projectKey":"HH","issueTypeName":"Task",
                             "summary":"Add export button to reports",
                             "description":"from telegram\n\n[src:tg:DEMO:12345]"}}
    rc, _ = run(CHECK, create, enf)
    check("fresh create allowed", rc == 0)

    # record it (simulate the write returning a key)
    rec = dict(create); rec["tool_response"] = {"key":"HH-482"}
    rc, _ = run(RECORD, rec, enf)
    rows = ledger_rows(d)
    check("create recorded with external_id", any(r.get("op")=="create" and r.get("external_id")=="HH-482" and r.get("source_ref")=="tg:DEMO:12345" for r in rows))

    # 2. same source_ref again -> blocked (exit 2)
    rc, err = run(CHECK, create, enf)
    check("duplicate create blocked (enforce)", rc == 2 and "duplicate" in err.lower())

    # 2b. same duplicate in shadow -> allowed but logged
    rc, _ = run(CHECK, create, shadow)
    sh = os.path.join(d, ".ledger-shadow.jsonl")
    check("duplicate create shadow allows + logs", rc == 0 and os.path.exists(sh))

    # 3. fresh comment on HH-482 -> allowed
    cmt = {"tool_name": ATL+"addCommentToJiraIssue",
           "tool_input": {"cloudId":"c","issueIdOrKey":"HH-482",
                          "commentBody":"Moved to In Progress, ETA Friday."}}
    rc, _ = run(CHECK, cmt, enf)
    check("fresh comment allowed", rc == 0)
    rc, _ = run(RECORD, cmt, enf)

    # 4. identical comment again -> blocked
    rc, err = run(CHECK, cmt, enf)
    check("duplicate comment blocked (enforce)", rc == 2)

    # 5. a DIFFERENT comment on same issue -> allowed
    cmt2 = dict(cmt); cmt2 = {"tool_name": ATL+"addCommentToJiraIssue",
           "tool_input": {"cloudId":"c","issueIdOrKey":"HH-482",
                          "commentBody":"Client approved the copy."}}
    rc, _ = run(CHECK, cmt2, enf)
    check("distinct comment allowed", rc == 0)

    # 6. editing an existing comment (commentId present) -> allowed even if identical
    edit = {"tool_name": ATL+"addCommentToJiraIssue",
            "tool_input": {"cloudId":"c","issueIdOrKey":"HH-482","commentId":"1001",
                           "commentBody":"Moved to In Progress, ETA Friday."}}
    rc, _ = run(CHECK, edit, enf)
    check("comment edit allowed", rc == 0)

    # 7. jira-generic-jira create with src trailer, then dup -> blocked
    pb = {"tool_name": PB+"jira_create_issue",
          "tool_input": {"project_key":"PRTL","issue_type":"Task",
                         "summary":"UAT fix login",
                         "description":"x\n[src:mtg:dsu-2026-09-08]"}}
    run(RECORD, {**pb, "tool_response":{"key":"PRTL-77"}}, enf)
    rc, _ = run(CHECK, pb, enf)
    check("generic-jira duplicate create blocked", rc == 2)

    # 8. an unrelated tool is ignored (exit 0, no effect)
    other = {"tool_name":"Write","tool_input":{"file_path":"x.md","content":"hi"}}
    rc, _ = run(CHECK, other, enf)
    check("non-tracker tool ignored", rc == 0)

    # 9. a create with NO src trailer but same summary+target -> soft-blocked
    nosrc = {"tool_name": PB+"jira_create_issue",
             "tool_input": {"project_key":"PRTL","issue_type":"Task","summary":"UAT fix login"}}
    rc, _ = run(CHECK, nosrc, enf)
    check("summary-match soft block", rc == 2)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
