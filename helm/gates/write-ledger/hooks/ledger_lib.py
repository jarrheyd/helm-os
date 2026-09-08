#!/usr/bin/env python3
"""
Shared library for the write-ledger hooks.

The ledger is a connector-agnostic record of every external tracker write the OS
makes. A create records source_ref -> external_id. A comment records
external_id plus content_hash. The PreToolUse check hook reads it to block a
duplicate; the PostToolUse record hook appends what actually landed.

Design goals: pure stdlib so it runs inside a short hook timeout; it never
raises into the hook (callers default to allow on any error); and it stays
connector-agnostic by trying the known field aliases for each gated tool.

Env:
- WRITE_LEDGER_DIR : dir holding write-ledger.jsonl (default: the vault _meta).
- LEDGER_ENFORCE   : "1" blocks duplicates, "0" (default) shadow-logs only.
- DISABLE_ANTI_SLOP_HOOK : "1" bypasses (shared with the deslop gate).
"""

import hashlib
import json
import os
import re
import time

def _default_ledger_dir():
    # Helm ships no user path. Resolve from the vault the adapter points at.
    vault = os.environ.get("HELM_VAULT")
    if vault:
        return os.path.join(vault, "_meta")
    return os.getcwd()


DEFAULT_LEDGER_DIR = _default_ledger_dir()

# Tool-name suffixes we gate. Matched with endswith so the per-session MCP
# server UUID prefix (mcp__<uuid>__) is irrelevant.
CREATE_SUFFIXES = (
    "createJiraIssue",        # Atlassian connector
    "jira_create_issue",      # mcp-atlassian and similar
    "wrike_create_task",      # Wrike
    "linear_create_issue",    # Linear (future)
    "create_issue",           # generic Linear/other
)
COMMENT_SUFFIXES = (
    "addCommentToJiraIssue",  # Atlassian connector
    "jira_add_comment",       # mcp-atlassian and similar
)

# [src:...] trailer the pod stamps into a description/body so dedupe is exact.
SRC_RE = re.compile(r"\[src:([^\]\s]+)\]")
# A Jira-style issue key, used to recover external_id from a create response.
KEY_RE = re.compile(r"\b([A-Z][A-Z0-9]+-\d+)\b")


def ledger_dir():
    return os.environ.get("WRITE_LEDGER_DIR", DEFAULT_LEDGER_DIR)


def ledger_path():
    return os.path.join(ledger_dir(), "write-ledger.jsonl")


def shadow_path():
    return os.path.join(ledger_dir(), ".ledger-shadow.jsonl")


def enforcing():
    return os.environ.get("LEDGER_ENFORCE", "0") == "1"


def bypassed():
    return os.environ.get("DISABLE_ANTI_SLOP_HOOK", "0") == "1"


def op_for(tool_name):
    n = tool_name or ""
    if n.endswith(COMMENT_SUFFIXES):
        return "comment"
    if n.endswith(CREATE_SUFFIXES):
        return "create"
    return None


def _first(ti, *keys):
    for k in keys:
        v = ti.get(k)
        if v:
            return v
    return None


def norm_text(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def content_hash(body):
    stripped = SRC_RE.sub("", body or "")
    return hashlib.sha1(norm_text(stripped).encode("utf-8", "ignore")).hexdigest()[:16]


def parse_source_ref(*texts):
    for t in texts:
        if not t:
            continue
        s = t if isinstance(t, str) else json.dumps(t)
        m = SRC_RE.search(s)
        if m:
            return m.group(1)
    return None


def create_fields(ti):
    """Return dict for a create: target, summary_norm, source_ref."""
    summary = _first(ti, "summary", "title")
    description = ti.get("description")
    target = _first(ti, "projectKey", "project_key", "folderId", "teamId")
    desc_str = description if isinstance(description, str) else json.dumps(description or "")
    src = parse_source_ref(summary, desc_str, json.dumps(ti.get("additional_fields") or {}))
    return {
        "target": target,
        "summary_norm": norm_text(summary),
        "source_ref": src,
    }


def comment_fields(ti):
    """Return dict for a comment: external_id, content_hash, source_ref, is_update."""
    external_id = _first(ti, "issueIdOrKey", "issue_key", "issueId", "issueKey")
    body = _first(ti, "commentBody", "body", "comment", "text") or ""
    return {
        "external_id": external_id,
        "content_hash": content_hash(body),
        "source_ref": parse_source_ref(body),
        "is_update": bool(ti.get("commentId")),
    }


def read_ledger():
    """Yield ledger rows (dicts), skipping malformed lines. Missing file yields nothing."""
    p = ledger_path()
    try:
        with open(p, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except (json.JSONDecodeError, ValueError):
                    continue
    except OSError:
        return


def find_duplicate(op, fields):
    """
    Return a reason string if this write duplicates a prior ledger row, else None.
    create: same source_ref already mapped to an external_id (the item exists).
    comment: same external_id plus content_hash already recorded (identical body).
    """
    if op == "create":
        src = fields.get("source_ref")
        summ = fields.get("summary_norm")
        for row in read_ledger():
            if row.get("op") != "create":
                continue
            if src and row.get("source_ref") == src and row.get("external_id"):
                return "source %s already created %s" % (src, row.get("external_id"))
            if (not src) and summ and row.get("summary_norm") == summ \
                    and row.get("target") == fields.get("target"):
                return "an issue with this summary already exists (%s)" % (
                    row.get("external_id") or "recorded")
        return None
    if op == "comment":
        if fields.get("is_update"):
            return None  # editing an existing comment is allowed
        ext = fields.get("external_id")
        ch = fields.get("content_hash")
        if not ext:
            return None
        for row in read_ledger():
            if row.get("op") == "comment" and row.get("external_id") == ext \
                    and row.get("content_hash") == ch:
                return "this exact comment is already on %s" % ext
        return None
    return None


def _run_id():
    p = os.path.join(ledger_dir(), ".ea-run-id")
    try:
        with open(p, "r", encoding="utf-8", errors="ignore") as f:
            v = f.read().strip()
            if v:
                return v
    except OSError:
        pass
    return time.strftime("%Y-%m-%d-%H")


def append_row(path, row):
    row.setdefault("ts", time.strftime("%Y-%m-%dT%H:%M:%S%z"))
    row.setdefault("run", _run_id())
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    except OSError:
        pass


def recover_external_id(tool_response, ti):
    """Best-effort pull of the created issue key/id from a PostToolUse response."""
    if isinstance(tool_response, dict):
        for k in ("key", "issueKey", "issue_key", "id", "issueId"):
            v = tool_response.get(k)
            if isinstance(v, str) and v:
                return v
    blob = tool_response if isinstance(tool_response, str) else json.dumps(tool_response or "")
    m = KEY_RE.search(blob)
    if m:
        return m.group(1)
    return None
