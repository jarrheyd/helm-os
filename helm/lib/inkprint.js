'use strict';
/**
 * Usage and voice live in inkprint now (npx inkprint). The files under
 * helm/routines/usage and helm/routines/voice forward here so every path the
 * brief, the vault and old schedules call keeps working. Your vault settings
 * still apply: inkprint reads os.config.json through HELM_VAULT.
 *
 * Finds inkprint at INKPRINT_APP, else ~/.inkprint/app (where `npx inkprint` installs it).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function appDir() { return process.env.INKPRINT_APP || path.join(os.homedir(), '.inkprint', 'app'); }

/** Run one of inkprint's scripts with the same arguments, stdin and exit code. */
function forward(rel) {
  const target = path.join(appDir(), rel);
  if (!fs.existsSync(target)) {
    console.error('helm: usage and voice come from inkprint, which is not installed. Run: npx inkprint');
    process.exit(0); // never break a brief or a hook over a missing optional piece
  }
  const r = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  process.exit(r.status == null ? 1 : r.status);
}

module.exports = { forward, appDir };
