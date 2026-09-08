---
name: claude-code-adapter
description: Wire helm-os into Claude Code. Registers the scheduled runs and the write-ledger hooks from your config.
---

# Claude Code adapter

Wires the framework into Claude Code. Run `node adapters/claude-code/install.js` after your config exists. It does two things, both driven by your config.

## Hooks
It adds the write-ledger gate to your Claude Code settings: a PreToolUse check that blocks a duplicate tracker write and a PostToolUse recorder that logs what landed. If you enabled deslop in your config and the skill is installed, it wires that gate too. It backs up your settings first and never removes a hook it did not add.

## Schedule
It registers the EA run and portfolio-health on the cron from your config's schedule field, pointing each at this repo's routines with `HELM_VAULT` set to your vault. The runs read the mode from the local clock, so the same cron works in any timezone.

## Undo
Run `node adapters/claude-code/install.js --remove` to take out the hooks and scheduled runs it added, leaving the rest of your settings untouched.
