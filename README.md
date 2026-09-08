# helm-os

The OS I run my day on, as a framework you can clone and make your own. It sweeps my inbox, chats, meetings and trackers into one brief a few times a day, tracks every project I point it at, and refuses to spam a tracker with something it already wrote.

It's a framework, not a service. You clone it into your own vault, run the setup, and from there it's yours to change. Your data, your config and anything you edit live in your vault. This repo is the shared starting point and the updates you can pull when you want them.

## What it does

- **the brief**: morning, noon and evening it reads your email, chats, meetings and tracker boards and hands you one thing to read, grouped by project, leading with what needs you.
- **project tracking**: one runner watches every project you list in your config - its channels, its intake, its status. Add a project by adding a row, not by writing code.
- **no double-writes**: a ledger remembers every ticket and comment it made, and a hook blocks a duplicate before it happens, on any tracker connector. This is the part that stops the OS opening a second ticket for something it already filed.

## Install

You need Node and a harness. Claude Code runs it fully. Cursor runs it too, minus the scheduled runs - set those up with cron or launchd.

Clone it into your vault and set up:

```bash
git clone https://github.com/jarrheyd/helm-os
node helm-os/install/os-init/scaffold.js <your-vault-dir>
```

os-init interviews you: your role, one channel to learn your voice from, your connectors, your projects, and how often you want a brief. It writes your config, lays down your vault, and wires the write-ledger gate for whichever one you run.

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
adapters/          wire it into Claude Code or Cursor
install/os-init    the setup interview
tests/             node:test, run with npm test
```

## License

MIT.
