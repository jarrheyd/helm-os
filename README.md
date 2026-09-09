# helm-os

The OS I run my day on, as a framework you can clone and make your own. It sweeps my inbox, chats, meetings and trackers into one brief a few times a day, tracks every project I point it at, and refuses to spam a tracker with something it already wrote.

It's a framework, not a service. You clone it into your own vault, run the setup, and from there it's yours to change. Your data, your config and anything you edit live in your vault. This repo is the shared starting point and the updates you can pull when you want them.

## What it does

- **the brief**: morning, noon and evening it reads your email, chats, meetings and tracker boards and hands you one thing to read, grouped by project, leading with what needs you.
- **project tracking**: one runner watches every project you list in your config - its channels, its intake, its status. Add a project by adding a row, not by writing code.
- **no double-writes**: a ledger remembers every ticket and comment it made, and a hook blocks a duplicate before it happens, on any tracker connector. This is the part that stops the OS opening a second ticket for something it already filed.

## Setup

You need Node, a runner, and the MCP connectors for whatever you want it to read - your email, chats, trackers. Claude Code runs it fully. Codex runs it too, with two gaps: no per-tool hook, so the write-ledger check runs inside the routine instead of blocking the write, and no scheduler, so you cron or launchd `codex exec`.

1. Clone it:

```bash
git clone https://github.com/jarrheyd/helm-os
```

2. Name your OS and lay down your vault:

```bash
node helm-os/install/os-init/scaffold.js --name "Your Name"
```

That makes a `Your Name OS` folder next to you, with a starter config and the empty vault. Rename it later with `install/os-init/rename.js`.

3. Fill in your config. Open `os.config.json` in that folder and set what's yours: your connectors (email, chat channels, tracker boards), your projects (one row each - its channels, its type, how tight its staleness floor), and your schedule slots. The shape is `helm/config.schema.json`; a filled example is `helm/templates/os.config.example.json`.

4. Wire your runner. Point `HELM_VAULT` at your OS folder, then run the adapter:

```bash
HELM_VAULT="/path/to/Your Name OS" node helm-os/adapters/claude-code/install.js   # Claude Code
HELM_VAULT="/path/to/Your Name OS" node helm-os/adapters/codex/install.js         # Codex
```

Claude Code gets the write-ledger hooks and the scheduled runs. Codex gets a launchd job on your slots.

5. Or let os-init do steps 2 to 4 for you. In Claude Code, run the `os-init` skill: it interviews you, learns your voice from one of your real channels, writes the config, and wires the runner. The steps above are the same thing by hand.

Good alongside it: [jarrheyd/skills](https://github.com/jarrheyd/skills) - deslop, qa-review, product-review. Not required.


## Your data stays yours

The repo ships no one's data - a leak-check (`npm run leak-check`) fails the build if a real name, client or id ever lands in it. Your own copy, in your vault, holds everything: your config, your projects, your voice, and whatever you change. You own that copy and can diverge from the repo whenever you like.

## Layout

```
helm/routines      the daily brief and the project health read
helm/projects      the one runner every project uses
helm/gates         the write-ledger that blocks double-writes
helm/lib           the config loader and the one place the vault layout lives
helm/templates     the vault you start from, plus an example config
adapters/          wire it into Claude Code or Codex
install/os-init    the setup interview
tests/             node:test, run with npm test
```

## License

MIT.
