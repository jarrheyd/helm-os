---
name: os-init
description: Set up a new OS. An interview that builds your config and vault, then runs a first brief.
---

# os init

This stands up your OS. It asks a short, fixed set of questions and grills where it needs to: if an answer is thin or ambiguous - a vague role, a project whose channels are unclear, a voice sample too small to learn from - it asks focused follow-ups one at a time until that piece is concrete, before writing anything. A wrong config is worse than one more question. It ends by writing your `os.config.json` and vault, then running a first brief so you see the value immediately.

## The interview
1. Your name and your role. Your name names the OS: the vault folder defaults to "[Your Name] OS", and you can rename it later. Your role seeds your profile and picks sensible defaults for what the OS tracks.
2. One comms source to connect now. It reads a sample of your recent sent messages and seeds your voice profile from how you actually write, never from a description.
3. Your connectors. If you already run Claude Code or Codex you likely have MCP servers set up, so it reads those first (`node install/os-init/detect-connectors.js`), proposes what it found grouped by kind (email, chat, meetings, trackers), and only asks for what is missing. Absent ones are simply skipped.
4. Your projects. Each becomes a project row: its channels, its type, and how tight its staleness floor should be. It offers a role preset to start from (eng-lead, founder-coo, sales, product-manager) so you edit a real-shaped config instead of a blank one.
5. Your cadence. Morning, evening, or both, and whether you want an audio brief. Audio is worth it on a commute or hands-busy, and costs a few minutes and some tokens per run. If you want audio, set a Gemini API key in your environment (`export GEMINI_TTS_KEY=...`) yourself - the OS reads it from there and never takes the key from you. Without it, audio fails soft and the text brief still runs.

## What it writes
It writes `os.config.json` to your vault and lays down the vault from the template: your brain, index, follow-ups, retention and taxonomy contracts, a project template, and a voice-profile skeleton seeded from your samples. It also copies the framework into the vault under `.helm/`, so the folder is self-contained and you can delete the cloned repo afterward. Then it runs the adapter for your runner to wire the schedule and the write-ledger gate, runs a doctor check, and composes a first brief.

## Add-ons
The skills at jarrheyd/skills (deslop, qa-review, product-review) are offered as a recommended add-on. They are not required and the OS runs without them.
