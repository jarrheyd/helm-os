#!/usr/bin/env node
'use strict';
/**
 * Codex adapter. Codex has no per-tool-call hook that can block a write, so the
 * write-ledger dedup runs inside the routine (find-or-create against the ledger)
 * rather than as a gate. What this adapter sets up is the schedule: a launchd
 * job (macOS) that runs `codex exec` on your config's slots.
 *
 * Env overrides (for testing): HELM_LAUNCH_DIR (LaunchAgents dir),
 * HELM_VAULT / HELM_CONFIG (the config). Flag: --remove takes the job out.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..', '..');
const LABEL = 'com.helm-os.ea';

function launchDir() { return process.env.HELM_LAUNCH_DIR || path.join(os.homedir(), 'Library', 'LaunchAgents'); }
function plistPath() { return path.join(launchDir(), LABEL + '.plist'); }
function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } }

function loadConfig() {
  const file = process.env.HELM_CONFIG || (process.env.HELM_VAULT && path.join(process.env.HELM_VAULT, 'os.config.json'));
  return file && fs.existsSync(file) ? readJson(file, null) : null;
}

// launchd runs on calendar intervals, not cron: one entry per (slot hour x weekday Mon-Fri) at :45.
function calendarIntervals(cfg) {
  const slots = (cfg && cfg.schedule && cfg.schedule.slots) || { '7': 'morning', '12': 'capture', '19': 'evening' };
  const hours = Object.keys(slots).map(Number).sort((a, b) => a - b);
  const out = [];
  for (const h of hours) for (let wd = 1; wd <= 5; wd++) out.push({ Hour: h, Minute: 45, Weekday: wd });
  return out;
}

function plistXml(cfg) {
  const codexBin = path.join(os.homedir(), '.local', 'bin', 'codex');
  const vault = (cfg && cfg.paths && cfg.paths.vaultRoot) || '';
  const prompt = `Run the helm-os EA routine. Read os.config.json from ${vault}, pick the mode from the local clock per its schedule slots, and execute ${path.join(REPO, 'helm/routines/ea/SKILL.md')} with that mode and config. The write-ledger dedup runs inside the routine.`;
  const cals = calendarIntervals(cfg).map((c) =>
    `    <dict><key>Hour</key><integer>${c.Hour}</integer><key>Minute</key><integer>${c.Minute}</integer><key>Weekday</key><integer>${c.Weekday}</integer></dict>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${codexBin}</string><string>exec</string><string>${prompt}</string></array>
  <key>EnvironmentVariables</key><dict><key>HELM_VAULT</key><string>${vault}</string></dict>
  <key>StartCalendarInterval</key>
  <array>
${cals}
  </array>
  <key>StandardErrorPath</key><string>${path.join(os.tmpdir(), LABEL + '.err.log')}</string>
</dict></plist>
`;
}

function install(remove) {
  const p = plistPath();
  if (remove) { if (fs.existsSync(p)) fs.unlinkSync(p); return 'removed'; }
  const cfg = loadConfig();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, plistXml(cfg));
  return 'scheduled';
}

function main() {
  const remove = process.argv.includes('--remove');
  const r = install(remove);
  if (remove) { console.log(`codex adapter: launchd job ${LABEL} removed.`); return; }
  console.log(`codex adapter: wrote ${plistPath()}`);
  console.log(`load it with: launchctl load ${plistPath()}`);
  console.log('note: Codex has no per-tool-call hook, so the write-ledger dedup runs inside the routine, not as a blocking gate.');
}

if (require.main === module) main();
module.exports = { install, plistPath, plistXml, calendarIntervals };
