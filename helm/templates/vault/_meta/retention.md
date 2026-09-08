# Retention contract: how the OS stays lean

Every recurring-write file has a size or age cap so nothing grows forever. A weekly pass enforces this file; the routine enforces the per-run pieces. If you add a new recurring-write file, give it a row here or it will bloat unnoticed.

## Principles
- Live window is roughly 14 days. Older content rotates to `_archive/` (moved, still greppable), it does not stay in the hot file.
- Move, do not delete, except genuine throwaways. Anything substantive is moved, reversible.
- State files are rewritten to current, never grown by appending dated blocks.
- Reference files (people, profile, glossaries, templates) are exempt from age. Old is correct for these.
- Cap the view, keep the record. Meeting notes and archives are durable, surfaced through an index, not loaded wholesale.

## Per-file contracts

| File | Kind | Cap | Over-cap action |
|---|---|---|---|
| `_meta/ea-runlog.md` | append log | last 14 days | older lines to `_archive/` |
| `_meta/followups.md` | live ledger | open rows only, one table | resolved or idle-14-day rows to `followups-history.md` |
| `_meta/surfaced.md` | chip log | last 14 days | older to `_archive/` |
| `_meta/write-ledger.jsonl` | write record | durable | keep; it is the dedupe memory |
| `_decisions/*.md` | open decisions | open only | settled decisions to `_decisions/closed/` |
| `_today.md` | daily log | today only | morning roll to `_archive/` |
| `brain.md` | thin index | thin | never re-grow tables here |

## Enforcement
- Weekly: walk this table, rotate every over-cap file, verify state files were rewritten, close settled decisions.
- Per run: the morning roll, settled-decision close, and follow-up strike-on-resolution keep the hot files bounded between weekly passes.
