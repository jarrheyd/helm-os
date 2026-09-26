'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

test('usage and voice paths forward to inkprint with args, stdin and exit code', () => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-inkprint-'));
  fs.mkdirSync(path.join(app, 'lib', 'voice'), { recursive: true });
  fs.writeFileSync(path.join(app, 'lib', 'voice', 'check.js'), "process.stdout.write('args:' + process.argv.slice(2).join(',') + ' stdin:' + require('fs').readFileSync(0, 'utf8')); process.exit(2);");
  const r = spawnSync(process.execPath, [path.join(ROOT, 'helm', 'routines', 'voice', 'check.js'), '--channel', 'discord'], { input: 'draft', encoding: 'utf8', env: { ...process.env, INKPRINT_APP: app } });
  assert.strictEqual(r.stdout, 'args:--channel,discord stdin:draft');
  assert.strictEqual(r.status, 2);
});

test('without inkprint installed, the forwarders explain and never fail a brief or hook', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'helm', 'routines', 'voice', 'hook.js')], { input: '{}', encoding: 'utf8', env: { ...process.env, INKPRINT_APP: path.join(os.tmpdir(), 'no-such-inkprint') } });
  assert.strictEqual(r.status, 0);
  assert.match(r.stderr, /npx inkprint/);
});
