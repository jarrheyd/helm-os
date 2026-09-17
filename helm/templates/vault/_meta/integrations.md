# Integrations

How the OS reaches your tools, and what it assumes.

## Access
The OS works through the MCP connectors you set up in your runner. It assumes it can reach them, so it tries the tool before it ever says it cannot. If a connector is down or unauthorized, it says so once with the exact error and works from what it has, never silently treating an unreachable channel as quiet.

## Drafts, not sends
Email and chat are read-only for the OS. Anything it would send comes back as a draft for you to send. Ticket systems are the working surface, so it writes to them in your voice, first person, and every write passes the write-ledger so it never files the same thing twice.

## Schedule
Your run schedule lives in `os.config.json`, in the schedule block, and the adapter registers it. The run reads its mode from the local clock, so the same schedule works in any timezone.

## Keys
The OS never takes a key from you. Anything that needs one, like the Gemini key for audio, is read from your environment. You set it; the OS reads it and never prints it.

## Docs and Sheets review
Review chips comment and suggest inside the file as you. No API creates a suggested edit, and API comments land unanchored, so this runs in your logged-in Chrome. A built-in browser pane that is not signed in to Google will not work.
- Suggesting mode: Cmd+Option+Shift+X, then check for the "You're suggesting" toast.
- Suggested edits: Find and replace (Cmd+Shift+H) with a unique phrase. Check the count reads "1 of 1", then click Replace, never Replace all.
- Comments: find the phrase in that dialog, close the dialog with its X (the match stays selected), click the floating add-comment icon, screenshot to confirm the comment box has focus, type, then Cmd+Return.
- Sheets: Name box, type the cell ref, Enter, confirm the formula bar shows that cell's value, then Cmd+Option+M, confirm the comment box, type, Cmd+Return.
- Never press Cmd+A or type until a screenshot shows the dialog field or comment box has focus. A stray keystroke in the doc can replace the whole document as one suggestion. Cmd+Z with focus in the doc restores it; reject any stray suggestion card with its X.
- Verify by scrolling the doc and checking each suggestion card and comment is there, with no stray header or text suggestions. The comment sidebar can show "Suggestion was deleted" on live cards, so don't trust it alone.
