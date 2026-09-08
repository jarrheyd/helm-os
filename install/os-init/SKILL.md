---
name: os-init
description: Set up a new OS. An interview that builds your config and vault, then runs a first brief.
---

# os init

This stands up your OS. It asks a short, fixed set of questions and only digs deeper when an answer is unclear. It ends by writing your `os.config.json` and vault, then running a first brief so you see the value immediately.

## The interview
1. Your role and your day to day. This seeds your profile and picks sensible defaults for what the OS tracks.
2. One comms source to connect now. It reads a sample of your recent sent messages and seeds your voice profile from how you actually write, never from a description.
3. Your connectors. It detects what you have available and asks which trackers and which channels matter. Absent ones are simply skipped.
4. Your projects. Each becomes a project row: its channels, its type, and how tight its staleness floor should be.
5. Your cadence. Morning, evening, or both, and whether you want an audio brief. Audio is worth it on a commute or hands-busy, and costs a few minutes and some tokens per run.

## What it writes
It writes `os.config.json` to your vault and lays down the vault from the template: your brain, index, follow-ups, retention and taxonomy contracts, a project template, and a voice-profile skeleton seeded from your samples. Then it runs the adapter for your harness to wire the schedule and the write-ledger gate, runs a doctor check, and composes a first brief.

## Add-ons
The skills at jarrheyd/skills (deslop, qa-review, product-review) are offered as a recommended add-on. They are not required and the OS runs without them.
