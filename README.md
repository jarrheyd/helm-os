# 🚢 helm-os

The OS I run my day on, as a framework you can clone and make your own. It sweeps my inbox, chats, meetings and trackers into one brief a few times a day, tracks every project I point it at, and refuses to spam a tracker with something it already wrote.

It's a framework, not a service. You clone it into your own vault, run the setup, and from there it's yours to change. Your data, your config and anything you edit live in your vault. This repo is the shared starting point and the updates you can pull when you want them.

## What it does

- **the brief**: morning, noon and evening it reads your email, chats, meetings and tracker boards and hands you one thing to read, grouped by project, leading with what needs you.
- **project tracking**: one runner watches every project you list in your config - its channels, its intake, its status. Add a project by adding a row, not by writing code.
- **no double-writes**: a ledger remembers every ticket and comment it made, and a hook blocks a duplicate before it happens, on any tracker connector. This is the part that stops the OS opening a second ticket for something it already filed.
- **usage**: reads the Claude Code and Codex transcripts already on your disk and shows you how you work with AI - when, on what, in which words, in what mood, and where you change by project or person. A live page on localhost, plus day and week files every night. It splits what you typed from what your OS did, keeps anything built from your words in a `.nosync` folder, and scores tone with a small classifier it trains once, so per-message scoring costs no tokens.

## Setup

You need Node, a runner, and the MCP connectors for whatever you want it to read - your email, chats, trackers. Claude Code runs it fully. Codex runs it too, with two gaps: no per-tool hook, so the write-ledger check runs inside the routine instead of blocking the write, and no scheduler, so it schedules `codex exec` through launchd.

1. Clone it, just to run setup:

```bash
git clone https://github.com/jarrheyd/helm-os helm-os-setup
```

2. Name your OS and lay it down. This creates a `Your Name OS` folder with your config, your vault, and the framework copied inside it (under `.helm/`), so the folder is self-contained:

```bash
node helm-os-setup/install/os-init/scaffold.js --name "Your Name"
```

3. Fill in your config. Open `os.config.json` in that folder and set what's yours: your connectors (email, chat channels, tracker boards), your projects (one row each - its channels, its type, how tight its staleness floor), and your schedule slots. The shape is `.helm/helm/config.schema.json`; a filled example is `.helm/helm/templates/os.config.example.json`.

4. Wire your runner, from inside your OS folder:

```bash
OS="/path/to/Your Name OS"
HELM_VAULT="$OS" node "$OS/.helm/adapters/claude-code/install.js"   # Claude Code: hooks + scheduled runs
HELM_VAULT="$OS" node "$OS/.helm/adapters/codex/install.js"         # Codex: launchd schedule
```

5. Delete the clone. Everything lives in your OS folder now:

```bash
rm -rf helm-os-setup
```

## Using it

Open Claude Code or Codex with your OS folder as the working directory, or point it there in what you do. Its `CLAUDE.md` orients the assistant: it reads your `brain.md` first and knows the triggers ("brief me", "project health"). The scheduled brief runs on its own on the cadence you set; you do not need the app open for it.

Faster path: in Claude Code, run the `os-init` skill from the clone instead of steps 2 to 4. It interviews you, grills where an answer is thin, detects the connectors you already have, writes the config, and wires the runner. Then delete the clone.

To see your usage page, run `node "$OS/.helm/helm/routines/usage/serve.js" --open` with `HELM_VAULT` set. The first open reads every transcript you have (a minute or so); after that it only reads what's new. For mood, run `node tone.js teach` then `node tone.js train` once, from the same folder. The adapters schedule the nightly rollup as a plain `node` job. Details in `helm/routines/usage/SKILL.md`.

Good alongside it: [jarrheyd/skills](https://github.com/jarrheyd/skills) - deslop, qa-review, product-review. Not required.


## Your data stays yours

The repo ships no one's data - a leak-check (`npm run leak-check`) fails the build if a real name, client or id ever lands in it. Your own copy, in your vault, holds everything: your config, your projects, your voice, and whatever you change. You own that copy and can diverge from the repo whenever you like.

## Layout

```
helm/routines      the daily brief, the project health read, weekly upkeep, and usage
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
