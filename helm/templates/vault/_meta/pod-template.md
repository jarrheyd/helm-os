# Pod template: the contract every project follows

A pod is one project or mission the OS watches. In helm-os a pod is a row in your config, and one generic runner drives it. This file is the contract the runner follows, and the reference when a pod needs bespoke behavior.

## What a pod guards
The emphasis shifts by engagement type, the mechanics do not.

| Type | Guards |
|---|---|
| Product pod (sprints, tickets) | backlog hygiene, sprint scope, refinement questions |
| Fixed-cost project | scope boundary (out-of-scope work is a change request, never absorbed silently), deadline, deliverables |
| Partnership | relationship health, effort accounting, per-product state |
| Account watch | what is pending on your side, deal movement, commitments |

## Files (per pod, in its folder)
| File | Purpose |
|---|---|
| `status.md` | current state, rewritten each run, not appended |
| `intake.md` | queue in: the routine drops items found outside the pod's channels; the pod processes then clears them |

## How pods share history
The vault is the only shared memory. Session history does not carry between runs. Anything that matters, a decision or a client fact, is written to the pod's files in the same run, or it never happened. Every run starts by reading the vault, the pod's status and intake, and the last-swept timestamps.

## Behavior contract
- Chat and email channels are read-only; drafts go to you. Ticket systems are auto-write, in your voice, first person.
- Record the decision, not the person. "Agreed to X", "Descoped Y", never quote or finger-point.
- End every sweep by rewriting a dated status block at the top of `status.md`.
- Reports are concise: lead with what is pending on you and deadlines under three days. Nothing new and nothing at risk means output nothing.
- Never claim done without the tool response. Never invent a commitment.

## Read messages in context, never in isolation
Before flagging anything as unanswered or pending, read the messages before and after it in the same thread. Someone may have already answered, hours later, without a reply-quote. Answered by anyone on the team is answered. If you cannot see the surrounding messages, say the item is unverified and why.

## Write ledger: stamp every ticket, never double-write
Every external tracker write passes the write-ledger gate, so a re-run comments on the existing issue instead of opening a second one. Two rules make it precise.

Stamp the source. When you create a ticket, put the originating reference in the description as a trailer on its own line: `[src:<ref>]`. Use shapes like `tg:<chat>:<msgid>`, `dc:<channel>:<msgid>`, `mtg:<meeting-id>`, `em:<message-id>`.

Check before you create. Before opening a ticket for an intake item, search the tracker for that source reference or a near-identical summary. If it exists, comment on it. The ledger is the hard backstop and blocks an exact duplicate on its own; the search also catches tickets made outside the OS.
