---
name: portfolio-health
description: A daily read across every project, from a health and risk lens. Report-only, never writes to a tracker.
---

# Portfolio health

A breadth-first read across every project in your config, once a day. It answers one question: what is at risk. It never advances a cursor or writes to a tracker; it reads the projects' own status files and their channels.

## What it does
1. Read every project's `status.md` and roll them into one view.
2. Apply the staleness floor. Each project's config sets how many weekdays of silence are allowed before it is flagged, even with no detected activity. In a sales pursuit silence is itself the signal, so those floors are tighter.
3. Flag what is trending down, gone quiet past its floor, or carrying a commitment at risk.
4. Compose a short health read: what needs attention, what is trending, what went quiet. Lead with the projects closest to trouble.

## State drives the floor
A project's state (active, sales, maintenance, paused, closed) sets its default floor, and the config can override per project. A closed project still has its channels read, so a surprise message from a finished client still surfaces; closed only turns the floor off. State changes only on real evidence in a channel, never on silence, because silence-driven demotion is a death spiral.
