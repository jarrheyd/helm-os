---
name: ea-run
description: The scheduled EA run. Reads the user's config, picks the mode from the local clock, and invokes the EA workflow with that config.
---

# EA run

This is the scheduled entry point. The adapter registers it on the cron in your config. Each run does three things.

## 1. Load the config
Read `os.config.json` from the vault. Its path comes from the `HELM_VAULT` or `HELM_CONFIG` environment the adapter sets. Parse it. This object is passed to the workflow as `args.config`, and every user-specific value the workflow needs (schedule, connectors, projects, areas, voice) comes from it. If the config cannot be read, stop and say so; do not run against defaults.

## 2. Pick the mode
Run `date '+%H %Z'` for the device-local hour, which is the clock the cron fired on. Look that hour up in the config's `schedule.slots` to get the mode (morning, capture, or evening). If the hour is not a slot, this is a manual trigger: run morning, a full brief. Read the last lines of the run log to see which slots already ran today, and cover the gap since the last entry, not since a stale timestamp. A lock file guards against a second run stacking on a slow one.

## 3. Invoke the workflow
Call the Workflow tool on `ea-workflow.js` with args `{ mode, now, sinceHint, config }`, where `now` is the current timestamp in the config's timezone and `config` is the parsed `os.config.json`. The workflow runs the sweeps, fires the projects, and composes the brief or a silent receipt. Its `output` is the run's result.

If the Workflow tool is unavailable, fall back to running the sweep, work, and compose stages in sequence against the same config, and return the brief or the receipt line.

## Standing rules
Draft only on chat and email; tickets are auto-write in the user's voice. Every external write passes the write-ledger gate. Never claim done without the tool response. The workflow carries the detail; this wrapper only resolves the mode and hands off.
