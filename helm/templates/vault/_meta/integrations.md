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
