#!/usr/bin/env node
'use strict';
/**
 * Schedule the usage routine with launchd: a plain `node` run, so no agent
 * session and no tokens beyond the rollup's own small read.
 *   nightly 23:00   node rollup.js
 *   1st, 23:30      node tone.js recalibrate (only once a tone model exists)
 * Both adapters call this; --remove undoes it. Off macOS it prints cron lines.
 *
 * Tests point it elsewhere with the HELM_LAUNCH_DIR and HELM_NODE env vars.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const HERE = __dirname;
const LABELS = { rollup: 'com.helm-os.usage', recalibrate: 'com.helm-os.usage-recalibrate' };

function plist(label, args, when, vault) {
  const cal = Object.entries(when).map(([k, v]) => `<key>${k}</key><integer>${v}</integer>`).join('');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${args.map((a) => `<string>${esc(a)}</string>`).join('')}</array>
<key>WorkingDirectory</key><string>${esc(HERE)}</string>
<key>EnvironmentVariables</key><dict><key>HELM_VAULT</key><string>${esc(vault)}</string><key>PATH</key><string>${esc(process.env.PATH || '/usr/local/bin:/usr/bin:/bin')}</string></dict>
<key>StartCalendarInterval</key><dict>${cal}</dict>
<key>StandardErrorPath</key><string>${esc(path.join(os.tmpdir(), label + '.err.log'))}</string>
<key>StandardOutPath</key><string>${esc(path.join(os.tmpdir(), label + '.out.log'))}</string>
</dict></plist>
`;
}

function jobs(vault) {
  const node = process.env.HELM_NODE || process.execPath;
  return [
    { label: LABELS.rollup, args: [node, path.join(HERE, 'rollup.js')], when: { Hour: 23, Minute: 0 }, cron: '0 23 * * *' },
    { label: LABELS.recalibrate, args: [node, path.join(HERE, 'tone.js'), 'recalibrate'], when: { Day: 1, Hour: 23, Minute: 30 }, cron: '30 23 1 * *' },
  ].map((j) => ({ ...j, xml: plist(j.label, j.args, j.when, vault) }));
}

function install(vault, remove) {
  const dir = process.env.HELM_LAUNCH_DIR || path.join(os.homedir(), 'Library', 'LaunchAgents');
  const out = [];
  if (process.platform !== 'darwin' && !process.env.HELM_LAUNCH_DIR) {
    for (const j of jobs(vault)) out.push(`${j.cron} HELM_VAULT="${vault}" ${j.args.map((a) => `"${a}"`).join(' ')}`);
    return { cron: out };
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const j of jobs(vault)) {
    const f = path.join(dir, j.label + '.plist');
    if (remove) { fs.rmSync(f, { force: true }); continue; }
    fs.writeFileSync(f, j.xml);
    out.push(f);
  }
  return { plists: out, dir };
}

module.exports = { install, jobs, LABELS };

if (require.main === module) {
  const vault = process.env.HELM_VAULT;
  if (!vault) { console.error('set HELM_VAULT to your OS folder'); process.exit(1); }
  const remove = process.argv.includes('--remove');
  const r = install(vault, remove);
  if (r.cron) { console.log('Add these to your crontab:\n' + r.cron.join('\n')); return; }
  if (remove) { console.log('usage: schedule removed. Unload with: launchctl bootout gui/$(id -u)/' + LABELS.rollup); return; }
  console.log('usage: wrote ' + r.plists.join(', '));
  console.log('Load with: launchctl bootstrap gui/$(id -u) ' + r.plists.map((p) => `"${p}"`).join(' '));
}
