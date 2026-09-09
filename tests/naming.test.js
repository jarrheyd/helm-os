'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scaffold, osFolderName } = require('../install/os-init/scaffold.js');
const { renameOS } = require('../install/os-init/rename.js');

test('osFolderName appends OS, idempotently', () => {
  assert.strictEqual(osFolderName('Alex'), 'Alex OS');
  assert.strictEqual(osFolderName('Alex Rivera'), 'Alex Rivera OS');
  assert.strictEqual(osFolderName('Alex OS'), 'Alex OS');   // does not double
  assert.strictEqual(osFolderName('  Alex   '), 'Alex OS'); // trims
});

test('scaffold names the vault "<Name> OS" and stamps the name', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-name-'));
  const target = path.join(parent, osFolderName('Alex Rivera'));
  const r = scaffold(target, { name: 'Alex Rivera' });
  assert.ok(r.vault.endsWith('Alex Rivera OS'));
  const cfg = JSON.parse(fs.readFileSync(r.config, 'utf8'));
  assert.strictEqual(cfg.identity.name, 'Alex Rivera');
  assert.strictEqual(cfg.paths.vaultRoot, target);
});

test('renameOS moves the folder and updates the config', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-rename-'));
  const first = path.join(parent, osFolderName('Alex'));
  scaffold(first, { name: 'Alex' });
  const r = renameOS(first, 'Sam');
  assert.ok(r.vault.endsWith('Sam OS'));
  assert.ok(fs.existsSync(r.vault));
  assert.ok(!fs.existsSync(first));
  const cfg = JSON.parse(fs.readFileSync(r.config, 'utf8'));
  assert.strictEqual(cfg.identity.name, 'Sam');
  assert.strictEqual(cfg.paths.vaultRoot, r.vault);
});
