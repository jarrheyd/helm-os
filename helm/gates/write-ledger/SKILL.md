---
name: write-ledger
description: Connector-agnostic dedupe gate for external tracker writes. Blocks a create or comment that duplicates one the OS already made.
---

# Write ledger

The OS writes to trackers on its own during sweeps. Without a memory of what it already did, a re-run opens a second ticket for the same request or repeats a comment. The write ledger is that memory, and a hook enforces it so the guarantee does not depend on any agent remembering the rule.

## How it works

A create records the source reference mapped to the issue it opened. A comment records the issue plus a hash of the body. The ledger is `_meta/write-ledger.jsonl`, append-only, one JSON row per write. It is connector-agnostic: it keys on the source reference and the issue id, not on any one tracker's shape, so it works against any Jira, Wrike, Linear, or other connector the user has.

Two hooks do the work, wired in `settings.json`:

- `ledger_check_hook.py` runs on PreToolUse. It reads the pending write, computes its key, and if the ledger already holds it, blocks with a reason. A create is blocked when its source reference already maps to an issue, or when its summary already exists for that project. A comment is blocked when the identical body is already on that issue. Editing your own earlier comment is allowed.
- `ledger_record_hook.py` runs on PostToolUse. The write has happened, so the response carries the new issue key, which it appends to the ledger. A PreToolUse hook cannot record this, because the write might still fail, which is why recording is a separate hook.

## Shadow and enforce

`LEDGER_ENFORCE=0` is shadow mode, the default. The check hook logs what it would have blocked to `_meta/.ledger-shadow.jsonl` and lets the write through, so you can watch it against the real tracker before trusting it. `LEDGER_ENFORCE=1` makes it block. Set `DISABLE_ANTI_SLOP_HOOK=1` to bypass for one session, the same switch the deslop gate uses.

## Source references

A pod stamps the origin of a request into the ticket description as a trailer on its own line, `[src:<ref>]`, so a later run recognizes the same request. The shapes: `tg:<CHAT>:<msgid>`, `wa:<chat>:<msgid>`, `dc:<channel>:<msgid>`, `mtg:<meeting-id>`, `em:<message-id>`. The ledger is the hard backstop even when a stamp is missing, because it also matches on a normalized summary; the stamp makes the match exact.

## Backfill

The ledger starts empty, so it cannot catch a re-create of a ticket opened before it existed. `backfill.py` seeds it: pipe in a JSON array of open issues, each `{external_id, summary, target, source_ref?}`, and it appends one create row per issue. Fetch the open issues per project through the tracker connector and pipe them in. Run the full backfill for every active project just before flipping enforce on.

## Extraction

This is Helm, not personal data. The hooks, the library, and the backfill script belong in the shared OS framework; only the `write-ledger.jsonl` file is per-user Log. When the OS is extracted into its own repo, these move with it and the Cursor adapter wires the same two hooks.
