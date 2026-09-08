'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');

test('config loader loads the example config', () => {
  const env = { ...process.env, HELM_CONFIG: path.join(ROOT, 'helm/templates/os.config.example.json') };
  const out = execFileSync('node', ['-e',
    "const {loadConfig}=require('./helm/lib/config.js');const {cfg}=loadConfig();process.stdout.write(String(cfg.projects.length))"],
    { cwd: ROOT, env, encoding: 'utf8' });
  assert.strictEqual(out, '1');
});

test('config loader rejects a config missing required keys', () => {
  const bad = path.join(ROOT, 'tests', '.bad.config.json');
  fs.writeFileSync(bad, JSON.stringify({ identity: { name: 'x', timezone: 'UTC' } }));
  const env = { ...process.env, HELM_CONFIG: bad };
  assert.throws(() => {
    execFileSync('node', ['-e', "require('./helm/lib/config.js').loadConfig()"],
      { cwd: ROOT, env, stdio: 'pipe' });
  });
  fs.unlinkSync(bad);
});

test('vaultPaths resolves standard layout under a root', () => {
  const { vaultPaths } = require(path.join(ROOT, 'helm/lib/paths.js'));
  const p = vaultPaths('/tmp/v');
  assert.strictEqual(p.brain, '/tmp/v/brain.md');
  assert.strictEqual(p.meta.writeLedger, '/tmp/v/_meta/write-ledger.jsonl');
});

test('modeForHour reads the slot map', () => {
  const { modeForHour } = require(path.join(ROOT, 'helm/lib/paths.js'));
  assert.strictEqual(modeForHour(7, { '7': 'morning' }), 'morning');
  assert.strictEqual(modeForHour(3, { '7': 'morning' }), null);
});

test('write-ledger python suite passes', () => {
  const out = execFileSync('python3', [path.join(ROOT, 'helm/gates/write-ledger/test_write_ledger.py')],
    { encoding: 'utf8' });
  assert.match(out, /0 failed/);
});

test('leak-check finds no Log values in Helm', () => {
  const out = execFileSync('node', ['scripts/leak-check.js'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /leak-check clean/);
});
