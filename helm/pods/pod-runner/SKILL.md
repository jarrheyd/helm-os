---
name: pod-runner
description: Run one pod's sweep from its config row. The generic runner behind every project the OS watches.
---

# Pod runner

One runner drives every pod. Given a pod key, it reads that pod's row from your config and follows the pod-template contract. The EA run fires it for any pod with pending intake; you can also run it directly for one pod.

## What it does
1. Read the pod's config row: its channels, type, state, ledger tag, and status file.
2. Read the pod's `intake.md` first and process every row. Meeting-sourced rows become ticket writes the same run, in your voice, first person, only what is quoteable from the source. Every write passes the write-ledger gate, so nothing is created twice.
3. Sweep the pod's channels for what moved since the last run, reading each thread in context.
4. Rewrite the dated status block at the top of the pod's `status.md`.
5. Report anything pending on you to the shared ledger with the pod's source tag.

## Bespoke pods
A pod whose row has a `bespoke` path follows that file where it applies, on top of this contract. Use it for a project that needs logic the generic runner does not cover. A pod with a `presence` field also gets a daily draft nudge in the evening so you stay present in that relationship.

## The contract
The full behavior contract, including how pods share history through the vault and the rule against double-writing, is in `_meta/pod-template.md`.
