---
name: codex-adapter
description: Wire helm-os into Codex. Same framework and config; Codex enforces the ledger in the routine and schedules through launchd.
---

# Codex adapter

Wires the framework into Codex. Run `node adapters/codex/install.js` after your config exists. The framework, your config, and your vault are identical to the Claude Code setup; two things differ because Codex differs.

## The write-ledger runs in the routine, not as a hook
Claude Code blocks a duplicate write with a per-tool hook. Codex has no per-tool-call hook, only a turn-level notify, so it cannot block a write before it happens. The dedup still holds: the routine checks the ledger and finds-or-creates before it writes, which is the portable backstop the ledger was built around. You get the same no-double-write guarantee, enforced one layer up.

## Scheduling through launchd
Codex has no scheduler. The adapter writes a launchd job that runs `codex exec` on your config's slots (macOS). Load it with `launchctl load ~/Library/LaunchAgents/com.helm-os.ea.plist`. On Linux, use a cron entry that runs `codex exec` on the same slots. `--remove` takes the job back out.

## Connectors
Codex reads MCP servers from `~/.codex/config.toml` under `[mcp_servers.*]`. Point the same connectors your config names at Codex there, so the routine can reach your email, chats, and trackers.

## Parity
The same config runs the same routines on both. Codex runs the routine sequentially rather than fanning out, so a big sweep is slower, and the ledger is enforced in the routine rather than at the tool. Everything else behaves the same.
