---
name: voice
description: Cards of how you actually write in each channel and to each person, measured from your own sends, and a check that stops a draft that doesn't sound like you. Use for "voice card", "check this draft", "does this sound like me".
---

# Voice

Describing someone's voice doesn't reproduce it. This measures it. It reads the messages you sent, per channel and per person, and writes a card: how long your sends run, how often you split one thought into several messages, whether you greet or sign off, casing, punctuation, particles, the words you open with. Then every draft gets checked against the card before you see it.

## Where your sends come from
- WhatsApp: read straight from the bridge's local database (`voice.whatsappDb`). Free.
- Telegram, Discord, Google Chat, Teams, email: the brief logs each of your sends it already read into `_usage/local.nosync/sends/inbox.jsonl`. No extra reads.
- A one-time backfill seeded each channel with your last ~150 sends.

Text stays in `_usage/local.nosync/sends/`. The cards in `Personal/voice/` hold numbers, openers and phrases only.

## The check
`node check.js --channel discord --to "Gee" "the draft"`. It picks the most specific card (that person, else the channel) and names what's off: "you open with a greeting 6% of the time on discord; this draft opens with Hi Gee". Two or more measures outside your usual range, on a card built from 30+ sends, returns exit 2: rewrite from your last 10-20 sends in that thread and check again. It never rewrites anything itself.

The same check runs as a hook on draft and send tools (the Claude Code adapter wires it). Bypass one session with `DISABLE_VOICE_CHECK=1`.

## Commands
- `node build.js`: read new WhatsApp sends, take in the inbox, rebuild every card (the nightly usage rollup runs this)
- `node collect-whatsapp.js [--all]`: WhatsApp only
- `node check.js --channel <c> [--to name] "draft"`: check one draft
