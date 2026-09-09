#!/usr/bin/env node
'use strict';
/**
 * Codex adapter. Codex has no per-tool-call hook that can block a write, so the
 * write-ledger dedup runs inside the routine (find-or-create against the ledger)
 * rather than as a gate. What this adapter sets up is the schedule: launchd jobs
 * (macOS) that run `codex exec` for the daily brief, the project-health read,
 * and the weekly upkeep, on the same cadence Claude Code uses.
 *
 * Env overrides (for testing): HELM_LAUNCH_DIR, HELM_VAULT / HELM_CONFIG.
 * Flag: --remove takes the jobs out.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..', '..');

function launchDir() { return process.env.HELM_LAUNCH_DIR || path.join(os.homedir(), 'Library', 'LaunchAgents'); }
function plistPath(label) { return path.join(launchDir(), label + '.plist'); }
function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } }
function loadConfig() {
  const file = process.env.HELM_CONFIG || (process.env.HELM_VAULT && path.join(process.env.HELM_VAULT, 'os.config.json'));
  return file && fs.existsSync(file) ? readJson(file, null) : null;
}

// brief: one entry per (slot hour x weekday Mon-Fri) at :45
function briefIntervals(cfg) {
  const slots = (cfg && cfg.schedule && cfg.schedule.slots) || { '7': 'morning', '12': 'capture', '19': 'evening' };
  const hours = Object.keys(slots).map(Number).sort((a, b) => a - b);
  const out = [];
  for (const h of hours) for (let wd = 1; wd <= 5; wd++) out.push({ Hour: h, Minute: 45, Weekday: wd });
  return out;
}
const dailyAt = (h, m) => [1, 2, 3, 4, 5].map((wd) => ({ Hour: h, Minute: m, Weekday: wd }));
const weeklyAt = (wd, h, m) => [{ Hour: h, Minute: m, Weekday: wd }];

function jobs(cfg) {
  const vault = (cfg && cfg.paths && cfg.paths.vaultRoot) || '';
  const mk = (name, routine, what, cals) => ({
    label: `com.helm-os.${name}`,
    prompt: `Run the helm-os ${what}. Read os.config.json from ${vault}, pick the mode from the local clock where it applies, and execute ${path.join(REPO, routine)} with that config. The write-ledger dedup runs inside the routine.`,
    cals,
  });
  return [
    mk('brief', 'helm/routines/brief/SKILL.md', 'daily brief', briefIntervals(cfg)),
    mk('project-health', 'helm/routines/project-health/SKILL.md', 'project-health read', dailyAt(8, 15)),
    mk('optimize', 'helm/routines/optimize/SKILL.md', 'weekly upkeep', weeklyAt(5, 15, 0)),
  ];
}

function plistXml(job, vault) {
  const codexBin = path.join(os.homedir(), '.local', 'bin', 'codex');
  const cals = job.cals.map((c) =>
    `    <dict><key>Hour</key><integer>${c.Hour}</integer><key>Minute</key><integer>${c.Minute}</integer><key>Weekday</key><integer>${c.Weekday}</integer></dict>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${job.label}</string>
  <key>ProgramArguments</key>
  <array><string>${codexBin}</string><string>exec</string><string>${job.prompt}</string></array>
  <key>EnvironmentVariables</key><dict><key>HELM_VAULT</key><string>${vault}</string></dict>
  <key>StartCalendarInterval</key>
  <array>
${cals}
  </array>
  <key>StandardErrorPath</key><string>${path.join(os.tmpdir(), job.label + '.err.log')}</string>
</dict></plist>
`;
}

function install(remove) {
  const cfg = loadConfig();
  const vault = (cfg && cfg.paths && cfg.paths.vaultRoot) || '';
  const list = jobs(cfg);
  const done = [];
  for (const job of list) {
    const p = plistPath(job.label);
    if (remove) { if (fs.existsSync(p)) fs.unlinkSync(p); done.push(job.label); continue; }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, plistXml(job, vault));
    done.push(job.label);
  }
  return done;
}

function main() {
  const remove = process.argv.includes('--remove');
  const done = install(remove);
  if (remove) { console.log(`codex adapter: removed ${done.length} launchd jobs.`); return; }
  console.log(`codex adapter: wrote ${done.length} launchd jobs to ${launchDir()}:`);
  for (const l of done) console.log(`  ${l} (launchctl load ${plistPath(l)})`);
  console.log('note: Codex has no per-tool-call hook, so the write-ledger dedup runs inside the routine, not as a blocking gate.');
}

if (require.main === module) main();
module.exports = { install, plistPath, plistXml, briefIntervals, jobs };
