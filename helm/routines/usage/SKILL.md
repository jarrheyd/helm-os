---
name: usage
description: How you work with AI, from your own Claude Code and Codex transcripts. Live local page, nightly day and week files, a rolling profile. Use for "usage", "how do I work", "open the usage page", "how did I sound this week".
---

# Usage

Reads the transcripts Claude Code and Codex already keep on disk and shows you how you work with AI: when, on what, in which words, in what mood, and where you change by project or person. It all runs on this machine.

## Open it
`node <vault>/.helm/helm/routines/usage/serve.js --open` starts the page at `http://127.0.0.1:4747` and updates it as you send messages. Close the terminal and it stops.

## What runs on its own
- nightly at 23:00, `rollup.js`: catches up on new transcript lines, writes `_usage/days/<date>.md`, `_usage/weeks/<week>.md`, refreshes `_usage/profile.md` once a week, and saves a snapshot page to `_usage/local.nosync/dashboard.html`.
- on the 1st, `tone.js recalibrate`: a small model labels 50 fresh messages; if the local classifier has drifted under 80% agreement on tense / flat / upbeat, it retrains and rescores.

Both are plain `node` on launchd (the adapters install them), so no agent session starts.

## Where things go
- `_usage/events/`: one line per message you or your OS sent, plus token and tool counts. Numbers only, no text. Safe to sync.
- `_usage/local.nosync/`: word counts, people tags, tone scores, the tone model and its labels. Built from your words, so the folder name keeps it out of iCloud.
- `_usage/model/spend.jsonl`: every model call this routine made and its tokens.

## You vs your OS
A message counts as yours when you typed it. Scheduled runs, subagents, chip preambles and anything that opens with a `usage.osPrefixes` phrase count as the OS. Run `node spotcheck.js` to see 20 of each and check the split.

## Setting up tone
`node tone.js teach` has a small model label about 1,500 of your messages (Claude Code messages through `claude -p`, Codex ones through `codex exec`, never crossed). `node tone.js train` fits the local classifier and reports how often it agrees with the labels on messages it never saw. Then `node ingest.js --rebuild` scores everything. After that, scoring is free. Set `usage.model: false` to skip all model calls; you still get every number.

## Commands
- `node ingest.js [--rebuild]`: read new transcript lines (or everything again)
- `node report.js`: short summary in the terminal
- `node rollup.js [--no-model]`: the nightly job, on demand
- `node spotcheck.js [n]`: sample the you / OS split
- `node schedule.js [--remove]`: install or remove the launchd jobs
