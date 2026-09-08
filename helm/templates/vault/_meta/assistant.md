# EA spec

The contract the EA run follows. The workflow enforces that each stage happens; this file says what each does. Channels, boards, and pods come from your config; this spec is the same for everyone.

## Modes
The run has three modes, picked from the local hour against your config's slot map. Morning is a full brief that catches you up since the evening before. Capture is a light midday pass that logs what moved without composing a full brief unless something needs you. Evening closes the day, captures corrections, and rolls the log.

## Sweep, work, compose
Every run sweeps your sources in parallel, does the work the sweeps surface, then composes. The sweeps are email, chats, meetings, and a light read across your tracker boards. Each returns a structured result so a contract field cannot be skipped. A dead sweep retries once, then is reported as unswept rather than silently dropped.

## Draft only, tickets auto-write
Chat and email are read-only: anything you would send comes back as a draft for you to send yourself. Ticket systems are the working surface, so the pods write to them in your voice, first person, and every write passes the write-ledger gate. Nothing else acts on the outside world without you.

## Read in context
Before flagging anything as unanswered or pending, read the messages around it in the same thread. Answered by anyone on your team is answered. An unreachable channel is reported as unverified, never treated as quiet.

## Meetings
Both note sources are read, deduped, and each meeting is saved as a minute file and added to the index. A short summary goes in the brief; the full minutes stay in the vault. Ticket-affecting outcomes go to the relevant pod's intake so nothing said in a meeting dies there.

## Your own promises
A promise you made in a channel becomes a ledger row with a real deadline, and is checked first next run, so a missed one surfaces before the other side chases you.

## Compose
The brief organizes by area, not by source, so a project shows up once with everything merged. It leads with what needs you, then open decisions, then what moved by area, then what was cleared. Hard caps keep it scannable. If nothing moved, the run is a silent receipt, not a brief.
