---
name: voice
description: Cards of how you write per channel and per person, and a check that stops drafts that don't sound like you. Now runs from inkprint; this routine forwards to it. Use for "voice card", "check this draft", "does this sound like me".
---

# Voice

Voice moved into inkprint along with usage. Cards live in `Personal/voice/` in your vault and are rebuilt nightly. To check a draft:

```bash
node .helm/helm/routines/voice/check.js --channel discord --to "Gee" "the draft"
```

Exit 2 means it's out of your range in that channel: rewrite from your last sends in that thread and check again. The hook on draft and send tools is installed by `npx inkprint`.
