'use strict';
/**
 * The single definition of the vault layout. Every routine resolves files
 * through here, so a user's vault root is the only absolute path in the system.
 * Given a vault root, return the standard Log file/folder layout (relative
 * paths joined to the root). Layout mirrors the retention + taxonomy contracts.
 */
const path = require('path');

function vaultPaths(vaultRoot) {
  const p = (...segs) => path.join(vaultRoot, ...segs);
  return {
    root: vaultRoot,
    config: p('os.config.json'),
    brain: p('brain.md'),
    index: p('_index.md'),
    today: p('_today.md'),
    yesterday: p('_yesterday.md'),
    archive: p('_archive'),
    decisions: p('_decisions'),
    decisionsClosed: p('_decisions', 'closed'),
    meetings: p('_meetings'),
    meetingsIndex: p('_meetings', 'INDEX.md'),
    meta: {
      dir: p('_meta'),
      followups: p('_meta', 'followups.md'),
      followupsHistory: p('_meta', 'followups-history.md'),
      surfaced: p('_meta', 'surfaced.md'),
      draftLog: p('_meta', 'draft-log.md'),
      voiceLearning: p('_meta', 'voice-learning.md'),
      runlog: p('_meta', 'ea-runlog.md'),
      lock: p('_meta', '.ea-lock'),
      runId: p('_meta', '.ea-run-id'),
      writeLedger: p('_meta', 'write-ledger.jsonl'),
      ledgerShadow: p('_meta', '.ledger-shadow.jsonl'),
      retention: p('_meta', 'retention.md'),
      taxonomy: p('_meta', 'taxonomy.md'),
      podTemplate: p('_meta', 'project-template.md'),
      chipPreamble: p('_meta', 'chip-preamble.md'),
    },
    people: p('People', 'people.md'),
    profile: p('Personal', 'profile.md'),
    audio: p('_audio'),
  };
}

/** Pick the run mode from the local hour using the config's slot map. */
function modeForHour(hour, slots) {
  const m = slots && slots[String(hour)];
  return m || null; // null = no scheduled slot this hour
}

module.exports = { vaultPaths, modeForHour };
