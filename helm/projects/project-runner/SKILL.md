---
name: project-runner
description: Run one project's sweep from its config row. The generic runner behind every project the OS watches.
---

# Project runner

One runner drives every project. Given a project key, it reads that project's row from your config and follows the project-template contract. The daily brief fires it for any project with pending intake; you can also run it directly for one project.

## What it does
1. Read the project's config row: its channels, type, state, ledger tag, and status file.
2. Read the project's `intake.md` first and process every row. Meeting-sourced rows become ticket writes the same run, in your voice, first person, only what is quoteable from the source. Every write passes the write-ledger gate, so nothing is created twice.
3. Sweep the project's channels for what moved since the last run, reading each thread in context.
4. Rewrite the dated status block at the top of the project's `status.md`.
5. Report anything pending on you to the shared ledger with the project's source tag.

## Bespoke projects
A project whose row has a `bespoke` path follows that file where it applies, on top of this contract. Use it for a project that needs logic the generic runner does not cover. A project with a `presence` field also gets a daily draft nudge in the evening so you stay present in that relationship.

## The contract
The full behavior contract, including how projects share history through the vault and the rule against double-writing, is in `_meta/project-template.md`.
