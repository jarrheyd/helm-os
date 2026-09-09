# Connectors

The OS reads whatever you connect, and skips what you do not. It cannot install these for you; you add each as an MCP server in your runner, then name it in `os.config.json`. Wire only the ones you use.

## Where they go
- Claude Code: add each MCP server with `claude mcp add ...`, or in your Claude config.
- Codex: add each under `[mcp_servers.<name>]` in `~/.codex/config.toml`.

Then list what matters in your config: the `connectors` block (email, chatSurfaces, meetingSources, ticketBoards) and your `projects` rows point at these.

## Common ones
- Email: a Gmail or Outlook MCP. The brief reads your inbox and drafts replies (draft only, never sends).
- Chat: Telegram, WhatsApp, Discord, Slack, Teams, Google Chat, iMessage. Each is its own MCP. The chats sweep reads every one you connect and gives you a per-channel digest of what moved.
- Meetings: your note-taker (Tactiq, Read AI, Pocket, or similar). The brief pulls transcripts, writes a minute file, and indexes it.
- Trackers: Jira, Wrike, Linear, or another. The project runner reads and writes tickets here, and the write-ledger stops it double-writing.

## What "connected" means
The brief only covers a channel you actually connected. If you skip WhatsApp, there is no WhatsApp in your brief. Breadth is yours to set: connect the channels you live in, name them in the config, and the same engine reads them all.
