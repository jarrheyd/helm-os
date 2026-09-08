---
name: cursor-adapter
description: Wire helm-os into Cursor. Same framework, wired to Cursor's hooks and an external scheduler.
---

# Cursor adapter

Wires the framework into Cursor. Run `node adapters/cursor/install.js` after your config exists. The framework and your config are identical to the Claude Code setup; only the wiring differs.

## Hooks
It writes the write-ledger gate into Cursor's hook config, the same check-and-record pair, so a duplicate tracker write is blocked on Cursor too.

## Schedule
Cursor has no built-in scheduler, so the adapter installs a system scheduler entry (launchd on macOS, cron on Linux) that invokes the routine headless on your config's cron. The routine picks its mode from the local clock exactly as it does under Claude Code.

## Parity
The same config runs the same routines on both harnesses. What Cursor lacks today is the subagent fan-out a big sweep uses, so a long sweep runs serially and slower. Everything else behaves the same.
