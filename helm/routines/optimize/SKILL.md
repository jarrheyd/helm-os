---
name: optimize
description: Weekly OS upkeep. Enforces the retention contract so the vault stays lean, once a week.
---

# Optimize

Runs once a week to keep the OS from rotting. It reads your retention contract and enforces every cap: rotates over-cap files to the archive, closes settled decisions, and clears genuine junk. Without this pass the hot files grow forever and the OS slows down, which is the exact failure the retention contract exists to prevent.

## What it does
1. Read `_meta/retention.md`, the authoritative list of what is capped and how.
2. Rotate each over-cap file: move the older content to `_archive/`, never delete anything substantive, and keep the live file inside its window. State files are rewritten to current, never grown by appended dated blocks.
3. Close settled decisions into `_decisions/closed/`.
4. Delete only genuine junk, and only from logs and ledgers. Anything uncertain is archived, not deleted.
5. Report what moved, with byte counts.

Reference files (people, profile, voice guides, templates) are exempt from age; they are never flagged on their timestamp alone.
