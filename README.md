# helm-os

Run your own OS on your own Claude Code or Cursor. This repo is the framework. Your data stays in your own vault.

## The idea

Two layers. Helm is the framework in this repo: the routines, the gates, the setup interview. It is identical for everyone and updates here. Log is your own data: your clients, channels, people, and voice. It lives in your vault, never in this repo.

The test for where anything belongs: would a stranger's copy be identical? If yes it is Helm and ships here. If no it is Log and stays in your vault. A leak check (`npm run leak-check`) enforces it before every push.

## What it does

- A daily brief that sweeps your email, calendar, chats, and meetings into one read, morning and evening.
- Project and account tracking: one generic pod-runner watches each project you define in config.
- A write ledger that stops the OS re-creating tickets or repeating comments it already made, on any tracker connector.

## Install

You need Node and a harness (Claude Code or Cursor). Setup runs an interview that builds your config and vault:

```
npx helm-os init
```

It asks your role, connects one comms source to learn your voice, detects your connectors, and asks your cadence. It writes `os.config.json` and a fresh vault, then runs a first brief.

Recommended add-on: the skills at `jarrheyd/skills` (deslop, qa-review, product-review). Not required.

## Layout

```
helm/        the framework: routines, pods, gates, lib, config schema, vault template
adapters/    wire the framework into Claude Code or Cursor
install/     the setup interview
```

## Config

Your `os.config.json` is the single seam. Its schema is `helm/config.schema.json`; a filled example is `helm/templates/os.config.example.json`. It names your identity, schedule, connectors, pods, and voice. The framework reads every user-specific value from it, so the same code runs for anyone.

## License

MIT.
