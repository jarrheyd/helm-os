export const meta = {
  name: 'brief',
  description: 'Daily brief run: parallel sweeps with schema-enforced returns; brief or receipt composed from structured data so contract fields cannot be skipped',
  phases: [
    { title: 'Sweep', detail: 'email + chats + meetings + PM boards, parallel' },
    { title: 'Work', detail: 'frame decisions, produce deliverables' },
    { title: 'Compose', detail: 'brief or silent receipt' },
  ],
}

// args: { mode: 'MORNING'|'CAPTURE'|'EVENING', now: '<ISO local Manila>', sinceHint: '<what window to cover>' }
// SELF-HEALING CLOCK (2026-08-12): args.mode/now arrived undefined for 27 straight stages (the caller
// wasn't passing args), so every run defaulted away from MORNING/EVENING and silently stripped the detailed
// brief - no marked-read recap, no attend-to list, no full resummary. The script cannot call Date (throws in
// workflows), so when args are missing we derive mode+now from an agent that reads the real clock + brain.md.
// args can arrive as an object OR a JSON string (the caller sometimes stringifies it) - tolerate both,
// else args.mode reads undefined and the run wrongly falls through to the clock/CAPTURE default.
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch { A = {} } }
if (!A || typeof A !== 'object') A = {}

// --- Log config (passed in by the scheduled-task wrapper as args.config, read from the user's os.config.json) ---
const C = A.config || {}
const VAULT = (C.paths && C.paths.vaultRoot) || A.vaultRoot || ''
const OWNER = (C.identity && C.identity.name) || 'the principal'
const TZ = (C.identity && C.identity.timezone) || 'UTC'
const SLOTS = (C.schedule && C.schedule.slots) || { '7': 'morning', '19': 'evening' }
const SLOTS_TEXT = (() => { const by = {}; for (const [h,m] of Object.entries(SLOTS)) { (by[m] = by[m] || []).push(String(h).padStart(2,'0')) } return Object.entries(by).map(([m,hs]) => hs.sort().join(',')+'='+m.toUpperCase()).join(' · ') })()
const DISCORD = (C.identityIds && C.identityIds.discord) || {}
const MEETING_SOURCES = (C.connectors && C.connectors.meetingSources) || []
const MEETING_SOURCES_TEXT = MEETING_SOURCES.length ? MEETING_SOURCES.join(', ') : 'your meeting-note sources'
const POCKET_MCP = (C.connectors && C.connectors.pocketUrl) || 'your note-taker MCP'
const BOARDS = (C.connectors && C.connectors.ticketBoards) || []
const BOARDS_TEXT = BOARDS.length ? BOARDS.map(b => b.connector + (b.cloudId ? ' (cloudId '+b.cloudId+')' : '') + ': projects ' + ((b.projectKeys||[]).join(', '))).join('. ') : 'your configured tracker boards'
const PROJECTS = C.projects || []
const AREAS = C.areas || []
const AREAS_TEXT = AREAS.length ? AREAS.map(a => (a.emoji||'•')+' '+a.name).join(' · ') : 'one stable emoji per area, learned from your config'
const CARE_RANKING = C.careRanking || []
const AUDIO_ARTIFACT_URL = (C.audio && C.audio.playerArtifactUrl) || ''
const TRACKER_MODE = (C.writes && C.writes.tracker) === 'auto' ? 'auto' : 'draft'
const TRACKER_RULE = TRACKER_MODE === 'auto'
  ? `Ticket systems (Jira/Wrike/Linear/etc) are auto-write, as ${OWNER}, first person, quoteable only; every write passes the write-ledger gate.`
  : `Ticket systems are DRAFT-ONLY: never write to a tracker. Write the proposed comment or new-ticket text into that project's drafts/ folder for ${OWNER} to review and apply. The write-ledger dedupe still applies so the same thing is never drafted twice.`
const TRACKER_ACTION = TRACKER_MODE === 'auto'
  ? `become ticket writes the SAME run: dated comments / explicit status moves, written AS ${OWNER} (first person, their voice, never third person), only what is quoteable from the source, and every write passes the write-ledger gate`
  : `become DRAFT ticket writes: write the proposed dated comment or new-ticket text into this project's drafts/ folder for ${OWNER} to review and apply, never to the tracker directly; the write-ledger dedupe still applies`
let mode = A.mode
let now = A.now
let since = A.sinceHint || 'since the last successful run'
if (!mode || !now) {
  const clock = await agent(`Determine the brief run's mode and time. Steps:
1. Run bash TWICE: (a) \`date '+%H %Z'\` = the DEVICE-LOCAL hour, which is the clock cron fires on - use THIS to pick the slot; (b) \`TZ=${TZ} date '+%Y-%m-%dT%H:%M:%S%z'\` = your timezone, use THIS as the "now" timestamp for display only.
2. Read the last few lines of ${VAULT}/_meta/ea-runlog.md - it is appended at the end of every run and is the RELIABLE record of which slots already ran today. Trust it OVER the "Last briefed" line in ${VAULT}/brain.md, which can lag days behind (do not compute the catch-up window from a stale "Last briefed").
3. Slot map keyed to the DEVICE-LOCAL hour (all fire at :45 past these local hours): ${SLOTS_TEXT}. This is correct in any timezone because cron always fires on the machine's local clock (2026-08-18 fix: reading Manila instead of device-local shifted every slot by one hour on JST, matched nothing, and forced a heavy MORNING catch-up on every run). No late-night slot - meetings ending after the 19:45 EVENING run roll to the next MORNING. If the device-local hour is NOT a slot (a manual trigger, a wake-up), adopt the mode of the most recent slot NOT yet in today's runlog; several missed → run the most significant once (MORNING > EVENING > CAPTURE), covering the gap since the last runlog entry (NOT since a stale "Last briefed"). After the evening run and before next morning = MORNING.
4. A MANUAL trigger (device-local hour matches no slot and no MORNING in today's runlog) = MORNING, full detailed brief, never a silent capture.
Return the resolved mode, the timezone ISO timestamp as now, and a short sinceHint describing the window this run covers (anchor it to the last runlog entry's time).`,
    { label: 'clock', phase: 'Sweep', effort: 'low',
      schema: { type: 'object', required: ['mode', 'now', 'sinceHint'], properties: {
        mode: { enum: ['MORNING', 'CAPTURE', 'EVENING', 'LATE'] }, now: { type: 'string' }, sinceHint: { type: 'string' } } } })
  mode = mode || clock.mode; now = now || clock.now; since = A.sinceHint || clock.sinceHint
  log(`clock stage resolved mode=${mode} now=${now} (args were ${Object.keys(A).length ? 'partial' : 'absent'})`)
}
const SWEEP_EFFORT = mode === 'CAPTURE' ? 'medium' : 'high'   // CAPTURE = small window, keep it light

// IN-FLIGHT LOCK (2026-08-18, he flagged runs stacking - two firing at 1pm). Write a start marker; the SKILL
// checks it before invoking and a colliding scheduled fire skips a second full run. 15-min TTL is enforced by
// the SKILL (a hung run's lock goes stale and never blocks the next real run). Cleared by the runlog stage at end.
await agent(`Two quick ops:
1. Overwrite ${VAULT}/_meta/.ea-lock with the current device-local timestamp, one line only: run \`date '+%Y-%m-%dT%H:%M:%S%z'\` and write exactly that string to the file.
2. ORPHAN REAP (2026-08-27, his ask - hung sessions pile up MCP bridges; 7 concurrent Telegram sessions is what burned his Telegram login before). Kill stale headless sessions and orphaned MCP chains:
   a. \`ps -eo pid,etime,command | grep "output-format stream-json" | grep -v grep\` - any with etime >= 2 hours (etime has a day part "dd-" or an hours part "hh:mm:ss") is a hung run: kill it, then kill -9 survivors.
   b. Two passes of: \`ps -eo pid,ppid,command | grep -E "gmail-mcp-server|whatsapp-mcp|mcp-remote|npm exec" | grep -v grep | awk '$2==1 {print $1}'\` - these are MCP chains whose session died (reparented to launchd): kill -9 each, wait 1s, repeat (children reparent after the head dies).
   NEVER touch: processes younger than 2h, anything parented to /Applications/Claude.app (the Desktop app's own bridges), or the current session. Report counts killed, zero is fine.`,
  { label: 'lock+reap', phase: 'Sweep', effort: 'low' })

const COMMON = `You are ONE stage of ${OWNER}'s brief run (mode ${mode}, now ${now} Manila, window: ${since}).
Vault: ${VAULT} - iCloud path only, never ~/Documents. Read ${VAULT}/CLAUDE.md and the sections of ${VAULT}/_meta/assistant.md that govern YOUR stage, then do only your stage.
Hard rules: DRAFT-ONLY on chat/email, never send. ${TRACKER_RULE} DECISION CONTRACT (_meta/decisions.md): act freely on reversible internal work, but never assume on anything external, hard to undo, or where scope or voice is unclear - especially an under-scoped ticket or code task. Surface those as a grill-style choice (the question + 2-3 options + your recommended one), never a blank chat prompt; hold any ${OWNER} has not answered, never auto-act, escalate louder if a deadline is about to hurt. One per decision, never re-fire. ASSUME ACCESS (integrations.md Access contract): gcloud is authed, Drive falls back to Chrome, every MCP is his - never output "I don't have access"/"ping your teammate" without an attempted call + its exact error. Never claim an action without a tool response - report failures in the failures field instead. Load MCP tools via ToolSearch as needed. Extremely concise. No em dashes.
DESLOP + VOICE GATE (2026-08-27, hard rule; deslop-skill run made mandatory 2026-09-01 at his ask): every draft, brief line, ticket comment, and message this stage produces passes deslop before it is written or surfaced. If your stage produces ANY draft (email reply, chat suggestion, ticket comment) OR ANY prose he reads (the brief itself, meeting gists, decision lines, area bullets), you MUST actually READ the deslop skill this run - ~/.claude/skills/deslop/SKILL.md and references/copy-slop-dictionary.md - and run its Universal Slop Test against every draft, not recite tells from memory (a rule loaded as background does not fire; the skill is one Read away). the brief's drafts are created through the Gmail connector and chat MCPs, NOT local file writes, so the deslop write-hooks never see them - this in-stage run is the only gate they get. Baseline tells to kill regardless: no em dashes, no banned phrases, no eyebrows/kickers, no "not X it's Y", no two-beat antithesis, no aphorism formulas, no padding, no summary-closing. Deslop is only half: also shape it to how ${OWNER} actually talks (sample his real sends in the target channel first, then Personal/profile.md + _meta/voice-learning.md). Slop-free but voiceless is still a fail.

NEVER OVERWRITE A DRAFT HE WROTE (2026-08-14, hard rule - this run destroyed work). His Lambda draft r1671223983223389102, written by him Aug 13 11:44pm, was judged "broken" (a trailing "I summarized them in this deck:" with no link, a reference to attachments that were not attached) and was COMPLETED IN PLACE. It was not broken, it was unfinished: the deck did not exist yet and he was still building it. The edit replaced his own words and they are unrecoverable - deleted draft revisions do not go to Trash and the API cannot restore them.
- A draft authored by ${OWNER} is READ-ONLY to every stage. Never update_draft, never rewrite, never "complete", never "fix" it. Not even to repair an obvious typo or a dangling sentence.
- An unfinished draft is not a defect. A trailing line, a missing link, a promised attachment that is absent = he is mid-work and the missing piece is coming. Treat it as in progress and leave it alone.
- If a genuine problem in his draft needs saying, say it in the brief as one line ("Lambda draft: deck link is a dangling sentence, attachments referenced but not attached"). The brief is where you tell him. The draft is not.
- The assistant may only create and edit drafts it authored itself, and never a second draft on a thread that already has one of his.

LEDGER HYGIENE (2026-08-14, hard limits - the ledger had reached 816KB / 1155 rows with 5% ever struck, so every stage was reading 200k tokens of mostly-dead state before doing any work, missing the struck rows and re-raising items he had already closed). Compacted to open rows only; everything older or struck is in ${VAULT}/_meta/followups-history.md - grep there before concluding an item was never raised.
- A row is MAX 40 WORDS: the ask, who is waiting, the deadline. No transcript quotes, no background, no restating what earlier rows said. Detail belongs in the source thread or the decision file - link it.
- Close in the same run you find it closed. A resolved row is struck AND moved to followups-history.md immediately, never left sitting.
- One row per item, ever. Movement UPDATES that row in place. Never append a second row for the same thread on a later run - that is what produced 1085 rows for a few hundred real items.
- ${VAULT}/_meta/followups.md holds max ~150 open rows. Over that, archive the oldest resolved-looking rows to history rather than growing the file.
- NEVER APPEND A DATED SECTION (2026-08-21, the ledger re-bloated 76K->310K in 3 days from "## <date> EA <STAGE> stage" headers). New items are ROWS appended to the ONE existing Open table. Zero new "##" headers, zero per-run sections, zero narrative paragraphs - a run that adds a section header to this file has failed.
- READ BUDGET: read ONLY the STANDING CORRECTIONS block + the Open table. Never read followups-history.md unless resolving a specific dispute.`

// REPLY EXECUTION + CORRECTION CAPTURE (2026-08-14). This was a comment for weeks and never ran, so his
// corrections never became state: he told the EA the Zeta SSO outage was done on three consecutive
// days and it was raised red each time; Beta was reported UNSIGNED after he had said twice it was signed
// (the executed signature landed in Discord, not the email thread). Root cause: the sweeps re-derive state from
// raw sources every run and nothing treats his word as terminal. This stage runs BEFORE the sweeps so the
// corrections file is current when they filter against it.
const reply = await agent(`${COMMON}
STAGE: REPLY EXECUTION + CORRECTION CAPTURE. Runs first, before any sweep.
1. Read the last brief and ${OWNER}'s replies since it (this session's transcript, the chip sessions, Telegram Saved Messages). His replies are INSTRUCTIONS, never new items to re-triage.
2. EXECUTE explicit instructions ("done N", "send N", "option A", "snooze"): strike the ledger row, send that one named draft, record the decision, dismiss the chip. One-line confirm each.
3. CORRECTION CAPTURE - the important half. Any statement of his that an item is done, signed, sent, cancelled, superseded, rescheduled, or simply wrong counts as a correction EVEN IF he did not use the word "done" and did not name a ledger row. Plain speech qualifies: "that's already signed", "no need for X anymore", "I moved that to Tuesday", "I've said this three days now". For each one, append a bullet to the "STANDING CORRECTIONS" block at the top of ${VAULT}/_meta/followups.md (create the block under the intro if missing) in the form: "- **<date> - <subject>: <what is true now>.** <one clause of why/where, e.g. the channel the evidence lives on>". Then strike the source rows (~~row~~, status "closed - <reason>") and mirror the one-line version into the corrections line at the top of ${VAULT}/brain.md.
4. His word is TERMINAL and outranks every tool: an email thread, a Drive file, a Jira status or a ledger row that disagrees is stale, not a discrepancy. Never re-open a corrected item, never report the contradiction back to him, never ask him to confirm a correction he already stated.
Return what you executed and every correction you recorded.`,
  { label: 'reply+corrections', phase: 'Sweep', effort: 'medium',
    schema: { type: 'object', required: ['instructions_executed', 'corrections_recorded'], properties: {
      instructions_executed: { type: 'array', items: { type: 'string' } },
      corrections_recorded: { type: 'array', items: { type: 'string' } },
      rows_struck: { type: 'number' } } } })
const corrections = reply ? (reply.corrections_recorded || []) : []
if (corrections.length) log(`corrections recorded this run: ${corrections.length}`)

// The gate itself. Injected into every stage prompt AND the composer - a finding that contradicts a standing
// correction is dropped silently, at the stage that found it, before it can reach a lane or a chip.
const GATE = `
STANDING CORRECTIONS GATE (2026-08-14, mandatory, runs before anything you emit). FIRST read the "STANDING CORRECTIONS" block at the top of ${VAULT}/_meta/followups.md and the corrections line at the top of ${VAULT}/brain.md. Those are ${OWNER}'s own statements and they OUTRANK every source you can query - email, Drive, Jira, Discord, the ledger. Any finding that a correction covers is DROPPED SILENTLY: not a red, not a yellow, not a white, not a chip, not a "for awareness", and never reported back as a discrepancy or a "please confirm". Corrections recorded THIS run, already in force: ${JSON.stringify(corrections)}.
ARCHIVED CORRECTIONS STILL BIND (2026-08-25): the hot block holds only the newest ~40 corrections; older ones live in ${VAULT}/_meta/followups-history.md under "Corrections archive (still authoritative)" and are EQUALLY terminal. Before emitting ANY red/yellow item, signature risk, or "unanswered/undelivered" claim, grep that archive for the item's subject (grep -i "<client/person/deal>" followups-history.md - a targeted grep, never a full read). A hit that covers the finding = drop it silently, same as a hot correction.
SIGNATURE RULE: never call a deal, SOW or contract unsigned on the absence of a signed copy in email or Drive. Executed documents routinely arrive in Discord instead (#ar-billing and the project channel) - Beta and Delta both did. Search for it server-wide (Discord message search on the document/client name) before emitting any signature risk, and say in the item that you checked. Server-wide search, not a channel read.`

const ITEM = { type: 'object', required: ['marker', 'who', 'what'], properties: {
  marker: { enum: ['red', 'yellow', 'white'] }, who: { type: 'string' }, what: { type: 'string' },
  next: { type: 'string' }, age_days: { type: 'number' }, needs_him_within_hours: { type: 'boolean' } } }
const DECISION = { type: 'object', required: ['slug', 'question', 'who_waiting', 'since'], properties: {
  slug: { type: 'string' }, question: { type: 'string' }, who_waiting: { type: 'string' },
  since: { type: 'string' }, deadline: { type: 'string' }, source: { type: 'string' } } }

const EMAIL_SCHEMA = { type: 'object',
  required: ['unread_total', 'marked_read', 'items', 'read_summary', 'decisions', 'drafts_created', 'ledger_rows_written', 'failures'],
  properties: { unread_total: { type: 'number' }, marked_read: { type: 'number' },
    items: { type: 'array', items: ITEM },
    // read_summary: ONE line per email you marked read/FYI, so he sees what it said without reopening it
    // ("Zeta invoice PO-4412 received, no action" / "Google MDF H2 both rejected, FYI"). This is the
    // marked-read recap he asked for and it was silently missing. Empty only if genuinely zero FYIs cleared.
    read_summary: { type: 'array', items: { type: 'string' } },
    decisions: { type: 'array', items: DECISION },
    drafts_created: { type: 'array', items: { type: 'string' } },
    ledger_rows_written: { type: 'number' }, failures: { type: 'array', items: { type: 'string' } } } }

const CHATS_SCHEMA = { type: 'object',
  required: ['channels_swept', 'channels_failed', 'items', 'channel_digests', 'decisions', 'ledger_rows_written', 'failures'],
  properties: { channels_swept: { type: 'array', items: { type: 'string' } },
    channels_failed: { type: 'array', items: { type: 'string' } },
    items: { type: 'array', items: ITEM },
    // channel_digests: the DISCUSSION he wants to see, one entry per channel that actually moved. {channel, digest}
    // where digest is 1-3 plain lines of what was discussed (not just action items) - "Acme<>Eta WA: MJ asked
    // for the revised collage assets, Vianca confirmed Fri delivery." Covers WhatsApp/Telegram/Discord/GChat/iMessage.
    channel_digests: { type: 'array', items: { type: 'object', required: ['channel', 'digest'],
      properties: { channel: { type: 'string' }, digest: { type: 'string' } } } },
    decisions: { type: 'array', items: DECISION },
    ledger_rows_written: { type: 'number' }, failures: { type: 'array', items: { type: 'string' } } } }

// PM delta: a light every-run pass across the boards (2026-08-12, his ask). NOT the heavy project agents - just
// "what changed on a ticket that touches me since last run", so board changes with no email/chat trigger are seen.
const PM_SCHEMA = { type: 'object',
  required: ['boards_checked', 'boards_failed', 'ticket_changes', 'items', 'digest', 'failures'],
  properties: { boards_checked: { type: 'array', items: { type: 'string' } },
    boards_failed: { type: 'array', items: { type: 'string' } },
    // ticket_changes: {ref, board, what_changed} - assigned-to-him, @mentioned, or status-moved since last run
    ticket_changes: { type: 'array', items: { type: 'object', required: ['ref', 'what_changed'],
      properties: { ref: { type: 'string' }, board: { type: 'string' }, what_changed: { type: 'string' } } } },
    items: { type: 'array', items: ITEM },   // the few that genuinely need him -> lanes/chips
    digest: { type: 'string' },              // one short block for the brief's PM line
    failures: { type: 'array', items: { type: 'string' } } } }

const MEET_SCHEMA = { type: 'object',
  required: ['meetings_processed', 'summaries', 'not_captured', 'commitments_ledgered', 'decisions', 'prep_blocks', 'projects_touched', 'failures'],
  properties: { meetings_processed: { type: 'array', items: { type: 'string' } },
    summaries: { type: 'array', items: { type: 'object',
      required: ['title', 'when', 'area', 'gist', 'file'],
      properties: { title: { type: 'string' }, when: { type: 'string' }, area: { type: 'string' },
        gist: { type: 'string' },        // 1-2 short lines: what was settled + what it changes. NOT minutes.
        his_actions: { type: 'array', items: { type: 'string' } },
        file: { type: 'string' } } } },
    not_captured: { type: 'array', items: { type: 'string' } },
    commitments_ledgered: { type: 'number' }, decisions: { type: 'array', items: DECISION },
    prep_blocks: { type: 'array', items: { type: 'string' } },
    projects_touched: { type: 'array', items: { type: 'string' } },
    // items: his open Pocket action items (+ meeting actions owed by him) that need him soon -> surface in NEEDS YOU
    items: { type: 'array', items: ITEM },
    failures: { type: 'array', items: { type: 'string' } } } }

phase('Sweep')
// MORNING VAULT ROLL - ENFORCED (2026-08-17, he flagged _today.md broke 11 days: 422KB blob headed Aug 6,
// capture piling into an unusable file he could not read). This is the #1 "capture doesn't reach him" failure.
// Enforce it exactly like mark-read: a MORNING run that did not roll has failed.
if (mode === 'MORNING') {
  await agent(`MORNING VAULT ROLL. Check the first line of ${VAULT}/_today.md. If its date is NOT today (${now}), the daily roll is overdue and MUST run now:
1. Copy the whole current _today.md to ${VAULT}/_archive/today-log-<its-header-date>-to-<yesterday>.md (nothing lost, findable).
2. Move the most recent 1-2 days of dated sections into a FRESH _today.md headed "# Today: <today> (<weekday>)", with a one-line link to the archive at the top.
3. Also roll _yesterday.md if stale.
Verify the new _today.md header reads today's date and the file is small (<40KB). If already dated today, do nothing. Return one line: rolled or already-fresh.`,
    { label: 'vault-roll', phase: 'Sweep', effort: 'low' })
}
// RETRY-ONCE WRAPPER (2026-08-25, his flag: "even the email FYIs i dont see anymore" - the email sweep died
// on an API error and parallel() nulled it, so the whole surface silently vanished from the brief). A dead
// sweep gets ONE full retry; if it dies again the stage is reported as UNSWEPT in failures, never silent.
const sweepFailures = []
const withRetry = (name, thunk) => async () => {
  let r = await thunk()
  if (!r) { log(`[${name}] died - retrying once`); r = await thunk() }
  if (!r) sweepFailures.push(`${name} sweep DEAD after retry - that whole surface (its FYIs, reds, digests) is UNSWEPT this run, not quiet`)
  return r
}
const [email, chats, meetings, pm] = await parallel([
  withRetry('email', () => agent(`${COMMON}${GATE}
MANDATORY CROSS-SURFACE RESOLUTION CHECK (2026-08-12, he flagged this: items he had already answered were reported as pending). NO red/yellow item is emitted until you have checked, for that item: (a) Gmail SENT - search_threads with in:sent scoped to the recipient/subject since the ask; (b) Google Chat (google-chat-ro) - he answers on a different surface than the one asked on, ML/TQA/PM spaces especially; (c) his authored Discord messages; (d) Telegram/WhatsApp outbound. An item he answered ANYWHERE is a ⚪ cleared line, never a 🔴. State in the item that the check ran. This applies to his own promised deliverables too: a draft sitting unsent does NOT mean undelivered - he may have sent the same thing by chat.
STAGE: EMAIL. Use the claude.ai Gmail connector (search_threads/get_thread/create_draft with replyToMessageId/unlabel UNREAD) - the npm gmail server ONLY for attachment downloads, never its send/delete/draft tools. Follow assistant.md "Email rules" exactly for mode ${mode}: fetch scope per mode. UNREAD SWEEP MUST BE EXHAUSTIVE (hardened 2026-08-16 - a run stated 201 unread and only paged ~78 threads): keep calling search_threads with the returned nextPageToken until no token remains, then RECONCILE threads-seen against unread_total. Short → keep paging; if the connector caps, split by date windows (is:unread before:/after:) and by label until every unread thread is accounted for. Reporting a total you did not actually page through is a failure - put the exact shortfall in failures[] rather than implying full coverage. Then: resolution check before any red/yellow, mark every white read IN THIS RUN, auto-draft templates, thread drafts, write ledger rows and vault deltas yourself. ANY doc/deck/PDF shared or @-tagged to him for review, or containing questions to him: OPEN it (Drive connector, or Chrome browser fallback on gdrive 403 - do not skip), produce the substantive review + draft answers to each question, land it in the project reviews/ folder + a chip. Capture his OWN sent-mail promises ('will send today', a committed date) as owner=${OWNER} ledger rows with resolved deadlines - verified first next run. Decision-shaped asks (a judgment call only ${OWNER} can make) go in the decisions field, not as red items. BEFORE emitting a decision, ls ${VAULT}/_decisions/ and grep the ledger for 'decision framed' - anything already framed is NOT emitted again (it is a white item at most).
POPULATE read_summary EVERY run, and make each line SPECIFIC + DISAMBIGUATING (2026-08-12, he flagged generic FYI titles are useless: "which LeadCo proposal - we have 5 in discussion"): one line per FYI/email marked read, carrying the concrete detail that identifies THAT exact item - the specific entity/variant, the number/amount, the actual decision or status. "Mu: LeadCo GWS renewal proposal, 300 users, [amount if stated], FY[X] - no action" NOT "LeadCo proposal". "Google Cloud: collections notice on Acme Inc AND approval-overdue on the Beta V2 SOW specifically" NOT "GCP notice". Enough that he clears it without opening. Pure noise (OTP, promo blasts, newsletters) can be one line total ("+3 noise: KMC wellness, 2 OTP"). Do NOT leave empty when marked_read > 0.`,
    { label: 'sweep:email', phase: 'Sweep', schema: EMAIL_SCHEMA, effort: SWEEP_EFFORT })),
  withRetry('chats', () => agent(`${COMMON}${GATE}
Apply the MANDATORY CROSS-SURFACE RESOLUTION CHECK above to every red/yellow you emit - his Google Chat and Gmail sent are the two surfaces that most often already carry the answer.
STAGE: CHATS. FULL CHANNEL COVERAGE EVERY RUN (2026-08-12, his rule: "every scan should scan all the tools, all messaging channels, not just start and end"). Every mode including CAPTURE sweeps ALL of: Discord - SERVER-WIDE SEARCH ONLY, exactly two calls: authored (authorId ${DISCORD.authorId}) + mentions (mentions ${DISCORD.authorId}) on guild ${DISCORD.guildId}, then a ~50-message context window around each hit (widened from 20, 2026-08-26). NEVER read Discord channel by channel, never walk a watchlist, never touch discord-state.md (his rule 2026-08-16). Reading a named channel is project research for a PM/project dig only, never triage. A 403 on some channel is NOT a coverage gap and never appears in the brief; the only Discord failure worth reporting is the server-wide search itself failing, Telegram all-unreads with project carve-outs, WhatsApp via whatsapp-ro, iMessage unreads, Google Chat (resolve space IDs first), Messenger via the logged-in Chrome (actually attempt it, start the browser session if needed - "not attempted" is a failure now, not a default). List every channel group you actually swept and every one that failed with the exact error - an unswept surface is never "quiet". Capture his own sent messages TWO ways: (a) voice learning; (b) SELF-COMMITMENTS - any promise he made ('will send today', 'I'll get this tomorrow', 'by EOD', a promised deliverable/date) becomes a ledger row owner=${OWNER} with the deadline resolved to a real date. These are verified FIRST next run: no evidence he delivered by the deadline = a NOW-lane red + chip, fired BEFORE the recipient chases him (assistant.md 'His own promises'). Decision-shaped asks go in the decisions field - but FIRST ls ${VAULT}/_decisions/ + grep ledger for 'decision framed'; already-framed decisions are never re-emitted.
POPULATE channel_digests EVERY run (2026-08-12, he flagged he could not see the WhatsApp/Telegram/Discord discussion): one {channel, digest} per channel that actually moved - 1-3 plain lines of what was DISCUSSED, not just action items, so he sees the conversation without opening the app. Client channels and active project threads always get a digest when they moved; pure noise channels are skipped. This is separate from items (action-worthy) - a channel can have a digest and no items.`,
    { label: 'sweep:chats', phase: 'Sweep', schema: CHATS_SCHEMA, effort: SWEEP_EFFORT })),
  withRetry('meetings', () => agent(`${COMMON}${GATE}
STAGE: MEETINGS. Follow assistant.md "Meetings": your meeting sources (${MEETING_SOURCES_TEXT}), anything ended in the window, dedup, process into vault + ledger. Calendar meetings recorded in neither source go in not_captured. For calendar meetings starting within ~2h that are substantive, write the PREP block text into prep_blocks. Decisions made IN meetings that still need ${OWNER} go in decisions.
SAVE + INDEX EVERY MEETING (2026-08-17, he flagged "I cant find my meeting notes"): for each processed meeting, WRITE a full minute file to ${VAULT}/_meetings/YYYY-MM-DD-<slug>.md (ONE place - root _meetings/, not scattered in project folders; tag the project inside the file) - attendees, decisions, actions with owners, and the plain-language summary. THEN append a row to ${VAULT}/_meetings/INDEX.md (the browsable log: | date | meeting | project | [open](path) |, newest first). A meeting digested but not saved-and-indexed is a FAILURE - capture without a findable file is the exact thing he flagged. Return the saved file paths in meetings_processed.
BRIEF SUMMARIES (2026-08-20, his ask: "summarize the meetings every triage - no need for full minutes ... but full minutes should be in my OS"). The full minute file above stays exactly as is - that is the OS record. IN ADDITION, for every meeting processed this run, return a "summaries" entry: title, when (time Manila), area (project), gist = ONE or TWO short lines in his voice covering what was settled and what it changes, plus his_actions = only what HE owes (owner ${OWNER}), each <= ~10 words, empty array if none. Gist is headline altitude - no attendee lists, no ticket numbers, no agenda replay, no "we discussed". A meeting he did NOT join is not summarised; it goes to not_captured.
PM/BA SYNC (assistant.md "PM/BA execution"): for every processed meeting, extract each ticket-affecting outcome (scope change, decision, blocker, new request, status stated out loud) into that project's intake.md as a row quoting what was said + which ticket it touches, and list the project's project-map key in projects_touched. The project agent writes the tickets - your job is that nothing said in a meeting dies in the vault.
POCKET SOURCE (2026-08-20, his ask - Pocket is now a triage source). your note-taker (${POCKET_MCP}) is his AI note-taker. Load its tools via ToolSearch ("select:search_pocket_actionitems,search_pocket_conversations,query_pocket_meetings,get_pocket_conversation,list_pocket_folders"), then for the run window ${since}:
- Treat Pocket meetings/notes like any other meeting source above: pull recent conversations/meetings (query_pocket_meetings / search_pocket_conversations), DEDUP against Tactiq/Read AI (the same meeting from two sources is ONE minute file, not two), save + index the minute file, and add a summaries entry. Only meetings he actually joined.
- Pull his OPEN action items (search_pocket_actionitems). Each one assigned to ${OWNER} becomes a ledger row (owner ${OWNER}, deadline resolved to a real date) exactly like a meeting commitment; the ones that genuinely need him soon ALSO go in items[] as 🔴/🟡 so they surface in NEEDS YOU. Skip any action item already struck in the ledger or already marked done in Pocket (resolution-check first). If he has clearly completed one elsewhere, you may update_pocket_actionitem to done and note it - never invent completion.
- FAIL-SOFT: if Pocket tools do not load or return 401/needs-auth (not yet connected), put ONE line in failures ("Pocket not connected - authenticate via /mcp") and continue. Never break the run over Pocket.`,
    { label: 'sweep:meetings', phase: 'Sweep', schema: MEET_SCHEMA, effort: SWEEP_EFFORT })),
  withRetry('pm', () => agent(`${COMMON}${GATE}
STAGE: PM DELTA (2026-08-12, his rule "every scan should scan all the tools" - PM boards were only caught via notification email + event-driven projects; this closes that seam). A LIGHT read-only pass, NOT the heavy project agents (those still fire on movement/intake). Across every reachable PM board, find only what CHANGED since the last run and touches ${OWNER}:
- Boards: ${BOARDS_TEXT}. Load each connector via ToolSearch.
- For each board run ONE cheap query for tickets updated since the last brief run (~2-3h, or since yesterday 8pm on the MORNING run) that are: assigned to ${OWNER}, @mention him, OR changed status/priority. JQL like: assignee was/is currentUser() OR comment ~ ${OWNER}, updated >= "-3h", ORDER BY updated. Do NOT pull whole backlogs - just the delta.
- ticket_changes: one row per changed ticket {ref, board, what_changed}. items: ONLY the few that genuinely need him (a ticket newly assigned to him, a blocker on his call, an approval overdue) as ITEM rows so they hit the lanes/chips - most changes are just awareness, not items. digest: one short block naming the notable moves for the brief. Board unreachable/403 = a boards_failed entry with the exact error, never silent. READ-ONLY: never comment or transition here (the projects own writes).`,
    { label: 'sweep:pm', phase: 'Sweep', schema: PM_SCHEMA, effort: SWEEP_EFFORT })),
])

const S = [email, chats, meetings, pm].filter(Boolean)
const allItems = S.flatMap(r => r.items || [])
const failures = sweepFailures.concat(S.flatMap(r => r.failures || [])).concat(chats ? chats.channels_failed || [] : [])
const reds = allItems.filter(i => i.marker === 'red')
const urgentReds = reds.filter(i => i.needs_him_within_hours)   // NOW lane
const soon = reds.filter(i => !i.needs_him_within_hours).concat(allItems.filter(i => i.marker === 'yellow'))
const later = allItems.filter(i => i.marker === 'white' && i.next)   // real but not time-pressured -> parked, not nagged
const chipworthy = urgentReds.concat(reds.filter(i => !i.needs_him_within_hours)).slice(0, 5)  // reds get chips; the chip is the interface
const preps = meetings ? meetings.prep_blocks || [] : []

phase('Work')
const seen = new Set()
const decisions = S.flatMap(r => r.decisions || []).filter(d => {
  const k = d.slug.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
const capped = decisions.slice(0, 3)
if (decisions.length > 3) log(`decision framing capped at 3: deferred ${decisions.slice(3).map(d => d.slug).join(', ')}`)
const framed = await parallel(capped.map(d => () =>
  agent(`${COMMON}${GATE}
STAGE: DECISION FRAME. Decision detected: ${JSON.stringify(d)}.
FIRST: ls ${VAULT}/_decisions/ - if ANY existing file covers this decision (regardless of slug wording), return file_written:'' and dropped_reason:'already framed: <file>'. Do not rewrite or duplicate it. THEN run the resolution check (assistant.md) - if already decided or superseded anywhere, write NO file and return the evidence in dropped_reason. Otherwise write ${VAULT}/_decisions/ file per the Work-routing frame: question as the actual call / real options incl. decline / what the vault knows with dates+amounts / recommendation WITH reason / cost of waiting as a date. [GAP: ...] for missing facts, never invent numbers. Update the matching ledger row to "decision framed -> path". Try spawn_task for a chip (its prompt must start with the standing verify-at-open + one-word-done preamble: re-check the item as of NOW before presenting; 'done' as first message = strike ledger + delete file + update status, one-line confirm). Record whether it worked.`,
    { label: `decide:${d.slug}`, phase: 'Work', effort: 'high',
      schema: { type: 'object', required: ['file_written', 'spawn'], properties: {
        file_written: { type: 'string' }, dropped_reason: { type: 'string' },
        recommendation: { type: 'string' }, spawn: { enum: ['ok', 'unavailable', 'failed'] } } } })))
const files = framed.filter(Boolean).filter(f => f.file_written)
const spawnState = framed.filter(Boolean).map(f => f.spawn).includes('ok') ? 'ok'
  : (framed.length ? `unavailable (${framed.filter(Boolean)[0]?.spawn || 'none attempted'})` : 'n/a (no decisions this run)')

// POD FIRING (replaces pm-dispatcher, retired 2026-08-05): fire the project agent for any project whose intake.md
// has pending rows after the sweeps, or that a sweep flagged as moved. Cap 3/run, nearest-deadline first.
const touchedKeys = [...new Set(S.flatMap(r => (r.items || []).map(i => i.what.match(/→ (\w[\w-]*) intake/) ? RegExp.$1 : null)).filter(Boolean)
  .concat(meetings ? meetings.projects_touched || [] : []))]
const PROJECT_BY_KEY = Object.fromEntries(PROJECTS.map(p => [p.key, p]))
const toFire = touchedKeys.filter(k => PROJECT_BY_KEY[k]).slice(0, 3)
if (toFire.length) await parallel(toFire.map(k => () => {
  const project = PROJECT_BY_KEY[k]
  const projectOpts = { label: `project:${k}`, phase: 'Work', effort: 'medium' }
  if (project.agentType) projectOpts.agentType = project.agentType
  return agent(`Run the project sweep for "${project.label || k}" now (fired by the brief run at ${now}; window ${since}). You are the generic project-runner following _meta/project-template.md. Sweep this project's channels: ${JSON.stringify(project.channels || [])}. Process this project's intake.md FIRST - meeting-sourced rows ${TRACKER_ACTION}. Report nudges to the shared ledger with source tag ${project.ledgerTag || k}; keep your own cursors.${project.bespoke ? ' A bespoke override for this project lives at ' + project.bespoke + ' - follow it where it applies.' : ''}`,
    projectOpts)
}))
if (touchedKeys.length > 3) log(`project firing capped: ran ${toFire.join(',')} - deferred ${touchedKeys.filter(k => !toFire.includes(k)).join(',')}`)

// DRAFT OUTCOME CAPTURE (2026-08-16, OS opt). draft-log.md recorded what was WRITTEN and never went back to
// see what happened to it: 15 outcomes on file, 11 "unsent", 5 "sent-edited", ZERO "sent as-is" - not because
// his edits are heavy, but because nothing ever checked. Voice quality was therefore unmeasurable and
// send-flow could never graduate. This closes the loop. EVENING only - one pass a day is enough.
let draftOutcomes = null
if (mode === 'EVENING') {
  draftOutcomes = await agent(`${COMMON}${GATE}
STAGE: DRAFT OUTCOME CAPTURE. Read ${VAULT}/_meta/draft-log.md. Take every draft logged in the LAST 7 DAYS that does not already carry an "OUTCOME" verdict.

For each one, find out what actually happened to it:
1. Email drafts - search Gmail \`in:sent\` scoped by the draft's threadId, or by recipient + subject. Compare what he SENT against the drafted body.
2. Chat drafts (WhatsApp/Telegram/Discord/GChat) - no sent folder; read the channel and find the message he actually posted.

Write exactly ONE verdict onto that draft's line in draft-log.md, appended in place:
- \`OUTCOME as-is <date>\` - sent, wording materially unchanged. Whitespace or a greeting tweak is NOT a change.
- \`OUTCOME edited <date> - <one line on WHAT he changed>\`. That diff is the highest-value signal the voice loop gets; also append it to ${VAULT}/_meta/voice-learning.md.
- \`OUTCOME ignored <date> - <surface>\` - he answered the same thing elsewhere without using the draft, OR it has sat unsent more than 7 days with no send anywhere.
- \`OUTCOME superseded <date>\` - the need went away.
- Under 7 days old and still genuinely pending: leave it open, do not force a verdict.

ALSO: reconcile the other direction. Any draft you can see was created in the last 7 days but was NEVER LOGGED (check this run's and recent runs' outputs, and ${VAULT}/_meta/ea-runlog.md) gets a backfilled line in draft-log.md marked \`BACKFILLED\`. An unlogged draft is invisible to the correction loop - three were lost that way on Aug 13-14.

Return the tally. Be honest: a draft you could not resolve counts as unresolved, never as as-is.`,
    { label: 'draft-outcomes', phase: 'Work', effort: 'medium',
      schema: { type: 'object', required: ['as_is', 'edited', 'ignored', 'unresolved', 'tally_line'], properties: {
        as_is: { type: 'number' }, edited: { type: 'number' }, ignored: { type: 'number' },
        superseded: { type: 'number' }, unresolved: { type: 'number' }, backfilled: { type: 'number' },
        edit_patterns: { type: 'array', items: { type: 'string' } },
        tally_line: { type: 'string', description: 'one line: as-is/edited/ignored, N of M drafts resolved' } } } })
  if (draftOutcomes) log(`draft outcomes: ${draftOutcomes.tally_line}`)
}

// EOD PRESENCE (optional, per project): for any project that opted into a daily presence nudge (a `presence` field in
// config), draft 1-2 natural messages from the day's real context so ${OWNER} stays visibly present in that
// relationship. Draft-only, they post themselves. This generalizes what was a single hardcoded client ritual.
if (mode === 'EVENING') {
  const presenceProjects = PROJECTS.filter(p => p.presence)
  if (presenceProjects.length) await parallel(presenceProjects.map(project => () =>
    agent(`${COMMON}${GATE}
STAGE: EOD PRESENCE for "${project.label || project.key}". Goal: ${OWNER} should say something in ${(project.presence && project.presence.channel) || 'the project channel'} most days, to stay present in the relationship. Make that effortless.
1. Read TODAY's context for this project: today's dated section of ${VAULT}/_today.md, this project's status file (${project.statusFile || 'its status.md'}), and the channel itself (recent messages - what did the contact say, is anything unanswered, did something ship tonight, a win, a question worth asking).
2. Draft 1-2 NATURAL message options in ${OWNER}'s register for that channel (warm, concise, first person, the way they actually talk to this contact - reference _meta/voice-learning.md; never a bulletin, never a themed card). ALWAYS PROACTIVE - pull the angle from the project's real intelligence (adoption, sentiment, an upcoming ship, a trend), never manufacture internal noise.
3. spawn_task a chip whose prompt begins with the standing preamble from ${VAULT}/_meta/chip-preamble.md verbatim ([CREATED_TIME]=${now}) so opening it re-reads the channel live first. Body: the 1-2 drafted options + the one-line hook. DRAFT-ONLY - ${OWNER} edits and posts themselves. Log the draft to ${VAULT}/_meta/draft-log.md so the outcome loop tracks it.
Return whether a chip was spawned and the angle you chose.`,
      { label: `presence:${project.key}`, phase: 'Work', effort: 'medium',
        schema: { type: 'object', required: ['chip_spawned', 'angle'], properties: {
          chip_spawned: { type: 'boolean' }, angle: { type: 'string' }, reason: { type: 'string' } } } })))
}

// PER-RUN RETENTION (2026-08-18, enforce _meta/retention.md between the weekly optimizer passes). Two bounded-file
// duties: close settled decisions so the open list stays real, and rebuild brain.md's auto-threads block from the
// live dashboard so it is fresh AND capped (never a hand-frozen table again - that is what rotted the OS).
// MORNING/EVENING only - cheap, once or twice a day; the weekly optimizer does the deeper sweep.
if (mode === 'MORNING' || mode === 'EVENING') {
  await parallel([
    () => agent(`${COMMON}${GATE}
STAGE: DECISION RECONCILE (retention.md). ls ${VAULT}/_decisions/*.md (NOT the closed/ subfolder). For each open decision file, resolution-check it against the STANDING CORRECTIONS block (top of ${VAULT}/_meta/followups.md and ${VAULT}/brain.md), the ledger, and the source thread. If his word or a tool proves it decided / superseded / moot: move the file to ${VAULT}/_decisions/closed/ (mkdir -p first), prepending one line "CLOSED ${now}: <what was decided or why moot>". His word is TERMINAL - never re-open, never ask him to confirm a close. Leave genuinely-open files untouched. To bound cost, reconcile at most 25 files this run (oldest first); the weekly optimizer clears any remainder. Return counts.`,
      { label: 'decisions-reconcile', phase: 'Work', effort: 'medium',
        schema: { type: 'object', required: ['closed', 'still_open'], properties: {
          closed: { type: 'number' }, still_open: { type: 'number' },
          closed_slugs: { type: 'array', items: { type: 'string' } } } } }),
    () => agent(`${COMMON}
STAGE: BRAIN THREADS REFRESH (retention.md). Regenerate the auto-threads block in ${VAULT}/brain.md so its at-a-glance project view stays fresh and BOUNDED. Source of truth: ${VAULT}/Acme/portfolio-health.md (current project state) + the open rows in ${VAULT}/_meta/followups.md (what is pending on him). Between the markers <!--THREADS:START--> and <!--THREADS:END--> in brain.md, OVERWRITE the block with ONE line per active project: "**<Project>** - <one clause of current state> · you: <the single live ask, or '-'>". <=14 words a line, only genuinely active projects, most-recently-moved first, cap 15 lines. Plain language, no jargon, no adjectives (his rules). Do NOT append, do NOT touch anything outside the markers; if the markers are missing, do nothing and say so. Return the line count.`,
      { label: 'brain-threads', phase: 'Work', effort: 'low',
        schema: { type: 'object', required: ['lines_written'], properties: {
          lines_written: { type: 'number' }, note: { type: 'string' } } } }),
  ])
}

phase('Compose')
const marked = (email ? email.marked_read : 0)
const ledgered = S.reduce((n, r) => n + (r.ledger_rows_written || r.commitments_ledgered || 0), 0)
const resolvedSince = allItems.filter(i => i.what && /resolved|handled by|superseded/i.test(i.what)).length
// Run telemetry: appended to _meta/ea-runlog.md for the Friday optimizer ONLY. NEVER shown to ${OWNER} (he cut it 2026-08-06 - it had become a failure wall). Mark-read still happens in the email stage; this is just the record of it.
const pmMoved = pm ? (pm.ticket_changes || []).length : 0
const logline = `${now} ${mode}: ${allItems.length} new · ${marked} FYIs read · ${ledgered} ledger · unread ${email ? email.unread_total : '?'} · pm ${pmMoved} · decisions ${files.length} · spawn ${spawnState}${draftOutcomes ? ` · drafts ${draftOutcomes.tally_line}` : ''}${failures.length ? ` · FAILED: ${failures.join('; ')}` : ''}`

// SURFACE URGENT WORK IN THE CLAUDE APP (2026-08-06: Telegram self-notify retired - he lives in the Claude app).
// Two mechanisms: a chip per urgent item (contextual, one click opens a loaded session) + ONE PushNotification line.
// Runs when there's urgent work OR on MORNING/EVENING (to REPOPULATE the tray - chip task_ids die on app
// restart, so 2026-08-11's 55 open rows show zero chips until re-spawned). Fix for "no chips are showing".
const repopulate = mode === 'MORNING' || mode === 'EVENING'
if (chipworthy.length || repopulate) {
  await agent(`${COMMON}${GATE}
STAGE: SURFACE. ${repopulate ? `REPOPULATE-AND-SURFACE run (${mode}). ` : ''}Urgent red items this run (max 5, NOW-lane first): ${JSON.stringify(chipworthy)} - the chip is what he actually reads, so it must be self-sufficient. Push-notify ONLY the NOW-lane count.
${repopulate ? `R. REPOPULATE THE TRAY FIRST (chip ids do not survive app restart, so open work shows no chip until re-spawned): read ${VAULT}/_meta/surfaced.md, and for EVERY row still "open" whose underlying item is NOT resolved (resolution-check each against the ledger + _decisions/ first, strike the dead ones), spawn_task a fresh chip and update that row's task_id + chipped date. This is idempotent housekeeping - the goal is the tray matches the open ledger, capped at ~15 most-urgent so it is not a wall. Dedup: one chip per distinct item, never two for the same thread.
R2. FRAMED-DECISION SUPPRESSION (2026-08-13, he flagged repeat chips for things already discussed): before respawning ANY row, ls ${VAULT}/_decisions/ and grep it for the row's subject. A row whose decision is already framed in a file gets NO chip - it belongs in the brief's ⚖️ DECISIONS list, which he answers by replying. Same for rows that are a yes/no, an ack, or a "reply done". Strike them from the repopulate set, do not spawn. The tray is working sessions only.
R3. CARRY-OVER CAP: a row already chipped in a PREVIOUS run and unchanged since (same ask, same deadline, no new message on the thread) is a carry-over. Respawn at most 5 carry-overs, nearest-deadline first, and mark the row "carried <date>". Everything else stays open in surfaced.md with no chip. New items this run always outrank carry-overs for tray slots.
` : ''}0. CONSOLIDATE FIRST: review open chips against the ledger + resolution check. Dismiss (mcp__ccd_session__dismiss_task) any whose item is resolved, duplicated, or is just a "reply done"/decision that belongs in the triage not a chip. The chip tray holds ONLY live work-sessions.
1. If an item ALREADY has a live chip/session (per surfaced.md), CONTINUE it - update that session, don't spawn a second worktree for the same thread. A chip is spawned ONLY for a NEW item that needs a real working session (produce a deliverable, investigate with tools). A decision or a yes/no or a "reply done" is NOT chipped - it goes in the brief's decision list for him to answer by replying in the triage. Read ${VAULT}/_meta/surfaced.md; skip anything already surfaced (update the same chip if its deadline crossed <48h). Append a row on new chips.
2. spawn_task per item: imperative title with the deadline ("Reply to Gee on Nu deploy - by 6pm"); prompt fully self-contained (ask verbatim, who is waiting, since when, vault paths, what done looks like, your recommended action first). The prompt MUST begin with this standing preamble, verbatim:
the STANDING PREAMBLE from ${VAULT}/_meta/chip-preamble.md verbatim, with [CREATED_TIME]=${now} and [SOURCE] filled in with THIS item's actual origin channel + identifier (e.g. "Gmail thread <id>", "Telegram chat <name>", "Discord #<channel>", "meeting record <file>") so the opener knows exactly what to re-pull. The preamble makes the chip RE-SCAN live sources on open, not present stale capture-time context.
Stamp the tldr with created-time ("as of 2pm").
3. Then ONE PushNotification, under 200 chars, no markdown, leading with the nearest deadline: e.g. "Brief: Nu deploy call by 6pm + 2 more - chips in app". Skip it entirely if nothing is due before the next brief.
NO failure/infra content anywhere in this stage - that lives in the receipt.`,
    { label: 'surface', phase: 'Compose', effort: 'medium',
      schema: { type: 'object', required: ['chips_created', 'push_sent'], properties: {
        chips_created: { type: 'number' }, push_sent: { type: 'boolean' }, reason: { type: 'string' } } } })
}

// Append telemetry to the runlog every run (for the Friday optimizer). Bash via a stage agent so it works headless.
// ALSO: refresh brain.md's "Last briefed" date-stamp and clear the in-flight lock (2026-08-18) - the marker had
// frozen at 2026-08-06, so every run computed a 12-day catch-up. Keep it a light one-line stamp, not the full narrative.
await agent(`Three quick file ops, in order:
1. Append exactly this one line to ${VAULT}/_meta/ea-runlog.md (create if missing), nothing else: ${logline}
2. In ${VAULT}/brain.md, update ONLY the date/time/mode at the very start of the "Last briefed:" line to "${now} ${mode}" (leave the rest of that line's narrative alone if present; this just keeps the stamp from going stale). If no "Last briefed:" line exists, do nothing.
3. Delete ${VAULT}/_meta/.ea-lock (rm -f) - this run is finishing, so the lock must be released for the next slot.`,
  { label: 'runlog', phase: 'Compose', effort: 'low' })
const readSummary = email ? (email.read_summary || []) : []
const channelDigests = chats ? (chats.channel_digests || []) : []
const pmDigest = pm ? (pm.digest || '') : ''
const pmChanges = pm ? (pm.ticket_changes || []) : []
const movedAnything = allItems.length || readSummary.length || channelDigests.length || pmChanges.length || preps.length
// LATE = meetings-only, silent unless urgent. CAPTURE (12/3/5pm) = COMPACT update, no longer fully silent
// (2026-08-12: with only 3 midday runs and full coverage, he wants to see what moved - but tight, not a wall).
// Only true silence when genuinely nothing moved at all.
if (mode === 'LATE' && chipworthy.length === 0 && preps.length === 0) return { mode, output: '' }
if (mode === 'CAPTURE' && chipworthy.length === 0 && preps.length === 0 && !movedAnything) {
  return { mode, output: '' }
}

const brief = await agent(`${COMMON}${GATE}
STAGE: COMPOSE. The brief was becoming an unreadable wall (2026-08-12, he flagged "so hard to read"). ROOT FIX: organize by AREA (project/mission), not by source. The same project shows up in email + chat + PM + meeting - MERGE it into ONE block per area so he reads "Alpha: everything" in one place, never the same project scattered across four sections. Hierarchy, hard caps, whitespace between blocks. His voice: terse, fragments, no adjectives, no em dashes.

DESLOP THE BRIEF BEFORE YOU RETURN IT (2026-09-02, he flagged the morning brief as "still very AI tell"). This stage produces the prose he actually reads every day and it was never gated: the GATE above only fired for email/chat/ticket drafts, so the brief slipped past for a month. You MUST read the deslop skill (SKILL.md + references/copy-slop-dictionary.md, if installed) THIS RUN and run the Universal Slop Test over your composed brief, then rewrite and return only the clean version. Five tells the 2026-09-02 brief actually shipped, kill these on sight:
(a) WRITERLY TRAILING CLAUSES. A bullet earns its keep on the fact. "Confirm the HH-58 rescope so her test cases stop churning" -> "Confirm the HH-58 rescope." "IoT docs for their Globe meeting 5 days out, plus summaries before their HQ bosses land" -> name the docs and the date. Consequence clauses, scene-setting and stakes-painting are the tell; he already knows why it matters.
(b) APHORISM ENDERS. "Only you know where you are." "A number is not a summary." Any bullet that closes on a little truth instead of a fact. State the ask and stop.
(c) STACKED PARALLEL FRAGMENTS (the LinkedIn cadence, his 2026-08-28 8:56am correction). "Iota has paid. GDPR proposal sent, unanswered." Three clipped fragments in a row reads as generated. Vary the line, or merge them into one line that carries the specifics.
(d) THE THREE-BULLET QUOTA. The "MAX 3 bullets" cap below is a CEILING, NEVER A TARGET. The 09-02 brief gave almost every area exactly three, which means the third was manufactured. An area with one real fact gets ONE bullet. Padding an area to look uniform is the single most visible AI tell in the whole brief.
(e) SECTION-NAME EYEBROWS. "SHARPER TOMORROW" is an aspirational label, not a name for what is in it. It is now "FIX NEXT RUN". Do not invent motivational section names anywhere.
Also: the close line appears ONCE, at the very end, never repeated as a NEEDS YOU tail. Never announce what a section will do before doing it.

SECTION EMOJIS (2026-08-12, his ask - emoji headers make it scannable): each section header leads with its emoji, and area blocks lead with an area emoji. Use these consistently, same emoji every run so he learns them at a glance:
Sections: 🎯 NEEDS YOU · ⚖️ DECISIONS · 🗂️ BY AREA · ✅ CLEARED · 🌙 DAY RECAP · 🔧 FIX NEXT RUN.
Areas (lead each area line): ${AREAS_TEXT}. An area not listed gets a sensible stable emoji. Item markers inside sections stay 🔴 action · 🟡 review · ⚪ FYI. Do not over-emoji - one per header/area/item line, never mid-sentence.

RENDER IN THIS ORDER, and ONLY these:
1. **Header, one line:** "as of <time> · <N> need you · <N> areas moved · <N> FYIs cleared · reply 'now' to refresh".
2. **🎯 NEEDS YOU** (the only must-act list - merge urgentReds + soon into ONE ranked list, max 6, drop the NOW/SOON/LATER lane labels entirely): each = one line, "who/what - the ask - deadline" and end "-> chip" if it has one. This is the section he acts on; keep it at the very top and tight. If more than 6 genuinely need him, the tail were probably actions the system should progress - note "+N more in the ledger" rather than listing.
2b. CARRY-OVER DEMOTION (2026-08-13, he flagged items repeating brief after brief): before rendering, read ${VAULT}/_meta/surfaced.md and the last brief's entries. An item that appeared in a previous 🎯 NEEDS YOU and has NOT changed since (no new message, same ask, same deadline) does NOT get a full line again. Full lines are for items NEW this run or materially changed - say what changed ("4th follow-up now", "deadline moved to Thu"). All unchanged carry-overs collapse into ONE tail line: "↔️ still open, unchanged: <item>, <item>, <item> - reply 'done <item>' to strike." Never re-explain a carry-over's background. A NEEDS YOU section that is mostly carry-overs means the system is nagging, not surfacing.
2c. REPEAT CAP (2026-08-14). Count how many consecutive runs each item has appeared in, from ${VAULT}/_meta/surfaced.md. An item that has been 🔴 for THREE consecutive runs with no movement can never be 🔴 again. On that third run it gets one line, once: "<item> - red 3 runs, no movement. Still live, or is it dead?" After that it drops out of NEEDS YOU entirely and lives in the ledger tail only. Rationale: the Zeta portal/SSO outage ran red three days while he had already answered it each day. An item repeating unchanged is a system failure to progress it, not news - if it genuinely still needs him, progress it into a chip or a decision file instead of restating it.
3. **⚖️ DECISIONS - render ALL open ones, read the folder (2026-08-17, he flagged 76 framed decisions invisible because they only surfaced via chips and spawn was down).** ACTUALLY \`ls ${VAULT}/_decisions/\` and render EVERY open decision file, not just the ones framed this run - oldest first, one line each: question · your recommendation · age. This section is NOT chip-dependent; a decision is answered by replying in the triage. NEVER spawn_task here (2026-08-13: chipping decisions produced duplicate chips). If the folder holds more than ~10 open, that backlog is itself the headline - say "N decisions waiting, oldest since <date>" and list the 10 most time-pressured, with a pointer to the rest. Silent decisions he cannot see is the exact failure the governing rule forbids.
4. **🗂️ BY AREA - what moved.** One block per project. FORMAT IS STRICT (2026-08-12, he flagged dense paragraph walls - "barely readable"): area emoji + bold name on its own line, then AT MOST 3 short bullets under it, and FEWER WHENEVER THERE IS LESS (a ceiling, not a quota - one real fact means one bullet, and a padded third is a hard-rule violation). HARD RULES: one fact per bullet · each bullet <= ~14 words · NO run-on lines cramming multiple facts with semicolons · NO paragraphs. HEADLINE ALTITUDE, not ticket-level: "QA mostly passed, one map-pin bug open" NOT "HH-55/59/71 pass, HH-74 fails (lat/long not driving the pin...)". Ticket numbers and QA minutiae live in the tracker/chip, never the brief. If an area genuinely needs more than 3 bullets, the overflow is either a NEEDS YOU item or a chip - link it ("→ decision file", "→ chip"), do not dump. Lead bullet = the single most important thing in that area. Skip areas with nothing.
5. **✅ CLEARED - each FYI its own line WITH its specifics** (2026-08-12, he flagged generic titles are useless when 5 similar items exist): render every substantive FYI from cleared_fyis as its own bullet, keeping the disambiguating detail (which entity/variant, the number, the actual decision) so he clears it without opening - "Mu: LeadCo GWS renewal, 300 users, FYX" not "LeadCo proposal". NEVER collapse to "+N noise" or "+N more" (2026-08-13, his rule: the brief must never summarize a count in place of the items). EVERY cleared item gets its own line, including OTPs, promos, newsletters and system alerts - sender + what it was, 6-10 words is enough ("Globe: OTP", "AWS: billing alert, no action"). A number is not a summary. If the list runs long, it runs long - he would rather scroll than not know what was cleared. Same rule everywhere in the brief: no "+N" stand-in for real items anywhere except the explicit "+N more in the ledger" pointer in NEEDS YOU, which points at a place he can read them.
${mode === 'EVENING' ? `6. **🌙 DAY RECAP** (evening only): 2-3 lines - what shipped/decided today, what is still open into tomorrow. Then meetings consolidation bullets + correction capture per voice-learning.md + vault append. **End with the one-line draft tally**: ${JSON.stringify(draftOutcomes ? draftOutcomes.tally_line : 'draft outcome capture did not run')}. On FRIDAY also state the week's as-is percentage explicitly - that number is the send-flow graduation gate and nothing else is.` : ''}
6b. **🎙️ MEETINGS** (every mode, from meeting_summaries; omit the section entirely if empty). His ask 2026-08-20: summarise every meeting each triage, full minutes stay in the vault. One block per meeting, newest first, max 8: bold title + time on one line, then the gist as ONE or TWO bullets, then "you owe: <action>" only if his_actions is non-empty. NO attendee lists, NO ticket numbers, NO agenda replay. End the section with one line: "minutes: _meetings/" - never paste minute content into the brief. A meeting whose only content is "nothing moved" gets a single bullet, not a block.
7. **🔧 FIX NEXT RUN** (max 3, only real gaps from this run's failures, dedup vs recent runlog; omit if none).
DEAD-SWEEP RULE (2026-08-25): if any failures entry says a sweep is DEAD/UNSWEPT, that is NOT a footer item - put one plain line directly under the header ("⚠️ Email unswept this run - inbox items and FYIs missing, next run covers the gap") so he never mistakes a missing surface for a quiet one.

DATA (compose only from this, do not re-sweep):
needs_you=${JSON.stringify(urgentReds.concat(soon).slice(0, 10))}
also_moved_items=${JSON.stringify(later.slice(0, 20))}
channel_digests=${JSON.stringify(channelDigests.slice(0, 25))}
pm_changes=${JSON.stringify(pmChanges.slice(0, 20))} pm_digest=${JSON.stringify(pmDigest)}
cleared_fyis=${JSON.stringify(readSummary)}
meeting_summaries=${JSON.stringify(meetings ? (meetings.summaries || []).slice(0, 15) : [])}
decisions=${JSON.stringify(files)} preps=${JSON.stringify(preps)} failures=${JSON.stringify(failures.slice(0, 8))}
Close line: "Reply 'done <item>' to close anything you handled - I'll strike it everywhere."
${mode === 'CAPTURE' ? `THIS IS A MIDDAY COMPACT UPDATE (12/3/5pm) - even tighter: Header line, then 🎯 NEEDS YOU (only if any), then a max-5-line 🗂️ SINCE LAST RUN merge of the biggest area moves (area emoji per line), then the FULL ✅ CLEARED list. "Compact" tightens the AREA merge, NEVER the cleared list: render EVERY FYI from cleared_fyis as its own named line with its specifics, exactly as section 5 above - a one-line "Cleared: N FYIs" count is a HARD-RULE VIOLATION (2026-08-13, he flagged it again 2026-08-17: "it didnt even summarize what those FYIs are"). The count is never a substitute for the items. SKIP Decisions, full By-area, Day-recap, Sharper-tomorrow. Nothing moved -> one line "All quiet since <last run>, nothing needs you." Keep the section emojis. The area merge is skimmable in 15 seconds; the cleared list is as long as it needs to be.` : ''}
GLOBAL READABILITY (he has flagged "hard to read" / "barely readable" repeatedly 2026-08-12): bullets not paragraphs, one fact per line, <=14 words a line, headline altitude not minutiae, whitespace between sections. If a block runs longer than 3 bullets it is too deep - lift it to a chip/decision link. No source labels ("email stage"). No receipt/failure/infra line - telemetry is in ea-runlog.md only.`,
  { label: 'compose', phase: 'Compose', effort: 'medium' })

// AUDIO BRIEF (2026-08-20, his ask - listen to the triage like a podcast, NotebookLM-style; 2026-08-25 he
// clarified: MALE voice, and true podcast DELIVERY - a host talking ABOUT his day, not a narrator reading a
// list). 2026-08-28: it was still coming out as a list read aloud. Measured cause on the 08-28 script - 227
// of 855 words were a nine-item "also on your desk" block, one line each, plus a spoken contents page and
// spoken section headers. All three were ordered by THIS prompt. Fixed by dropping the completeness duty
// from the audio (the TEXT brief is where he skims - his words), bridging threads instead of numbering
// them, cutting the agenda line, and loosening the register. SINGLE HOST confirmed by him 2026-08-28;
// two-voice was offered and deferred until he hears this version. Same day, second pass: he flagged two of
// MY illustrative bridge lines as AI tells (the "not X, it's Y" reframe and the "while on Google's stage,
// Google billing is broken" irony pun), so the deslop step now names those three tells - reframe, irony
// bridge, reveal - explicitly, and a bridge must be a real link not a shared word. Tone reference set to a
// narrative-journalism daily (WSJ The Journal), single host. Audio agent pinned to claude-opus-4-8 at high
// effort (his call - better prose than opus-5 for this), up from low. MORNING + EVENING only. Saves the MP3 to _audio/ AND republishes the standing player artifact so
// the same URL always plays the latest brief on his phone and Mac.
let audioPath = null
if ((mode === 'MORNING' || mode === 'EVENING') && brief && brief.trim()) {
  const slot = mode === 'MORNING' ? 'morning' : 'evening'
  // Delivery style passed to Gemini TTS (2026-08-27, his ask: investigative daily-podcast feel with DEPTH, ~5 min, deslop the script).
  const audioStyle = mode === 'MORNING'
    ? 'Narrate like the host of a narrative-journalism daily like The Wall Street Journal\'s The Journal - one calm host telling a reported story, not reading a briefing. Plain-spoken and grounded, letting the facts carry the weight instead of adjectives or drama. Second person, contractions, real pace variation - brisk through what he knows, slower where it matters, a beat of quiet before a point lands. Curious, thinking it through, never hyped, never anchor-like, never a list.'
    : 'Narrate like the evening edition of a narrative-journalism daily like The Journal - one calm host closing out the day\'s story. Plain-spoken, grounded, a little slower than the morning, letting the facts carry it. Second person, contractions, reflective without being solemn, landing on the one thing that matters for tomorrow. Never hyped, never anchor-like, never a list.'
  const audio = await agent(`STAGE: AUDIO BRIEF. Turn the brief below into a spoken episode with the tone of a NARRATIVE-JOURNALISM DAILY - the register of The Wall Street Journal's The Journal: one calm host reporting the day's story to him, in the second person, letting the facts carry it rather than performing them. Not an anchor, not a bulletin, and above all not the text brief read aloud. If a listener could reconstruct the section headings from the audio, it has failed. Reference for tone only, never quote or imitate the show or any host by name.
1. Write the script (his 2026-08-27 direction: investigative, DEPTH over recitation; his 2026-08-28 direction: CONVERSATIONAL, not a list; ~5 minutes). Craft:
   - BRIDGE, NEVER ENUMERATE. This is the 2026-08-28 fix and it is the one that matters. NEVER speak a contents page ("three threads: the event, the money, and Epsilon"), NEVER speak a section header ("start with the event", "second thread", "next up"), NEVER number what you are about to cover. Move between threads on a real connection the sources support - the same person, the same week, the same money, the same failure repeating - so the listener feels one continuous line of thought. When two threads genuinely have nothing joining them, use a plain conversational turn ("something else you should know about before lunch"), never a heading. If you find yourself needing a header, the threads are in the wrong order: reorder them so a bridge exists. A BRIDGE MUST BE A REAL LINK - a shared person, a shared deadline, money moving between the same parties, one failure causing another. Coincidence is NOT a bridge, and dressing coincidence as significance is itself an AI tell: two things sharing the word "Google" (on Google's stage while Google billing is broken) is not a connection, it is a pun, and you must not build a transition on it. If the only thing joining two threads is a word or an ironic overlap, keep them separate and use a plain conversational turn instead.
   - WHAT HE CARES ABOUT, IN ORDER (2026-08-30, his direction - he was fast-forwarding through half the audio). Pick and weight threads by THIS ranking, not by what generated the most traffic today: (1) PROJECT DELIVERY - clients in trouble, team conflicts, anything he should know culturally at Acme as COO, client feedback, delivery speed, revenue and invoices; (2) SALES OPPORTUNITIES - inquiries, events, proposals; (3) INTERNAL ADMIN & CULTURE - team complaints and concerns; (4) RESELLERS - Google Workspace, Google Cloud, ResellerCo, subscriptions; (5) PRODUCTS; (6) OTHER ADMIN - internal events, inquiries, internships, benefits, salary, expenses, CardTool. EXPENSES ARE THE NAMED OFFENDER: the 08-29 episode spent half its runtime on expense items he only needs awareness of because Bryant/Aiesha will handle them - expense/billing-ops items get ONE brief awareness mention at most, never a thread, UNLESS the expense IS a delivery or client risk (a client-facing suspension, revenue at stake) - then it ranks by that risk, not as finance. If today's material is thin at the top of the ranking, the episode gets SHORTER, it does not backfill with low-rank items.
   - PICK THE THREADS. Don't cover 15 items evenly. Find the 2-3 threads that actually matter today (per the ranking above) and INVESTIGATE each: what happened, how the pieces connect ACROSS sources (this email + that Discord note + that meeting are one story), why it matters, the tension or risk nobody named, and what to watch or decide. Depth on the few that earn it.
   - ANALYSE, grounded. The value is the thinking, not the recitation: "the showcase went well, but notice what's missing - no next step, no price, team-size still owed, which is the same place this stalled last quarter." Only connect dots the sources actually support; never speculate past the evidence, never invent a motive. A hunch is voiced as a hunch.
   - COLD OPEN straight into the one thread worth understanding today, framed as the tension or open question, not a headline. NO map, NO agenda, NO "here's what I'll cover" - go directly into the substance from the first sentence.
   - THE AUDIO IS NOT THE INVENTORY (2026-08-28, his call). The "nothing dropped" rule belongs to the TEXT brief, which is where he skims; the audio is relieved of it. Do NOT do an "also on your desk" pass, and never produce a run of consecutive one-line items - that IS the list he is complaining about. After the threads, name ONLY what genuinely needs a nudge from him and cannot wait: at most two or three, each spoken as a sentence with a reason attached, never as a topic-noun opener ("Delta is...", "Alpha:"). Then one plain line telling him the rest is in the text brief. If a section of your draft could be reformatted into bullets without losing anything, rewrite it as speech.
   - MOMENTUM through pace and structure, not adjectives: vary sentence length, active voice, present tense, let a key beat breathe before moving on. Investigative means considered, not rushed - and not padded either.
   - TALK, DON'T RECITE. Second person throughout. Contractions (you've, that's, hasn't, it's). Address him directly where it is natural, and allow yourself a short reaction or aside when the material earns one ("which is the same place this stalled last quarter"). Ask him the real question rather than announcing that a decision exists. Vary how sentences open - a run of declaratives all starting with the topic noun is the list tell in disguise.
   - SIGN-OFF: the one thing to act on, then a short repeatable tag ("That's the dig - go." morning / "That's the day. More tomorrow." evening).
   - HIS CONTENT RULES HOLD: plain words, facts exact, numbers bare, no hype words, no praise padding, never commit him past verified facts. Drop every emoji, markdown mark and "-> chip" tail; expand markers into words.
2. DESLOP THE SCRIPT before voicing it (his standing gate - the deslop skill (if installed)). Read your draft against the Universal Slop Test + copy-slop-dictionary + the ${OWNER}-observed tells, and kill every tell OUT LOUD too: dramatic one-word sentences stacked for drama, "here's the thing"/"here's the kicker", "let that sink in", rhetorical-question pile-ups, manufactured stakes, triple-adjective cadence, generic metaphors (moves the needle, the missing piece). Three the audio kept doing, kill on sight: (a) the REFRAME antithesis - "it's not just X it's Y", "that's the real problem, not the stage", "this isn't about the deck, it's about the timing" - state the thing plainly and drop the contrast scaffolding; (b) the IRONY BRIDGE - "while Acme stands on Google's stage, four Google billing lines are broken" - covered above, it is a pun not a point; (c) the REVEAL - "notice what's missing", "and here's what nobody said" - just say what is missing. Grounded analysis of a real connection is fine and wanted; the theatrical framing around it is the tell. Rewrite until it passes, THEN voice it.
3. Generate speech with the SANCTIONED helper - do NOT hand-roll TTS. Write your finished (deslopped) script to a temp file, then run exactly (the --prompt sets the on-air delivery, keep it):
     python3 "${VAULT}/_meta/tts.py" --text <script.txt> --voice Charon --prompt "${audioStyle}" --out "${VAULT}/_audio/${now.slice(0,10)}-${slot}.m4a"
   The helper reads the Gemini key itself from one known location, chunks long scripts, converts to m4a, and NEVER prints the key. It writes the m4a path to stdout on success and exits nonzero with a reason on stderr on failure.
   HARD RULE: you must NOT read, grep, or open any config file (settings.json, .claude.json, plugin configs, env dumps) looking for an API key, and must NOT call any TTS endpoint directly with a key inline. The helper is the ONLY sanctioned path. If the helper is missing or exits nonzero, FAIL-SOFT per step 5 - never substitute a raw HTTP call. Voice stays MALE (Charon); to change it pass a different male voice name (Puck, Fenrir, Enceladus) to --voice, never a female voice.
4. REBUILD THE PLAYER PAGE: run
   python3 "${VAULT}/_meta/player.py" "${VAULT}/_audio/${now.slice(0,10)}-${slot}.m4a" ${mode} --dek "<one plain sentence summarizing the episode>" --rows "<'Name|note' pairs separated by ';' - one per major thread, e.g. 'Needs you|1 red · 5 yellow;Decisions|10 of 53 open;By area|10 moved'>"
   It writes ${VAULT}/_audio/player.html. Then publish that file with the Artifact tool, passing url "${AUDIO_ARTIFACT_URL}" so the STANDING player URL updates in place (never publish without url - that would mint a new link). favicon "🎧", description "Your nightly audio brief, playable from any phone or laptop with lock-screen controls and resume."
5. FAIL-SOFT at every step: if the tts.py helper is missing or exits nonzero, return audio_path:'' with the reason (do NOT fall back to a direct API call); if the player rebuild or republish fails, still return the mp3 path and note the failure in reason - never break the brief.`,
    { label: 'audio-brief', phase: 'Compose', model: 'claude-opus-4-8', effort: 'high',
      schema: { type: 'object', required: ['audio_path'], properties: {
        audio_path: { type: 'string' }, reason: { type: 'string' } } } })
  audioPath = audio && audio.audio_path ? audio.audio_path : null
  if (audioPath) log(`audio brief saved: ${audioPath}`)
}
return { mode, output: audioPath ? `${brief}\n\n🎧 Audio brief: ${audioPath}\n▶️ Player (same link every day): ${AUDIO_ARTIFACT_URL}` : brief }
