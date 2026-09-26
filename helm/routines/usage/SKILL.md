---
name: usage
description: How you work with AI, from your own Claude Code and Codex transcripts. Now runs from inkprint (npx inkprint); this routine forwards to it. Use for "usage", "how do I work", "open the usage page".
---

# Usage

Usage moved into its own install, inkprint, so it works with or without helm-os. Run it once from your OS folder:

```bash
HELM_VAULT="/path/to/Your Name OS" npx inkprint
```

It keeps its data in your vault (`_usage/`), reads your `os.config.json` `usage` block, installs a nightly job and the voice check, and opens the page. The scripts in this folder forward to it, so older paths keep working. Details: https://github.com/jarrheyd/inkprint
