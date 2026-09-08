'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('claude-code adapter wires and removes the ledger hooks', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-cc-'));
  const settings = path.join(tmp, 'settings.json');
  process.env.HELM_SETTINGS = settings;
  delete require.cache[require.resolve('../adapters/claude-code/install.js')];
  const cc = require('../adapters/claude-code/install.js');
  cc.wireHooks(false);
  let s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  const pre = JSON.stringify(s.hooks.PreToolUse);
  const post = JSON.stringify(s.hooks.PostToolUse);
  assert.match(pre, /ledger_check_hook\.py/);
  assert.match(post, /ledger_record_hook\.py/);
  // idempotent: a second wire does not duplicate
  cc.wireHooks(false);
  s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.strictEqual(s.hooks.PreToolUse.filter((e) => JSON.stringify(e).includes('ledger_check_hook.py')).length, 1);
  // remove
  cc.wireHooks(true);
  s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.doesNotMatch(JSON.stringify(s.hooks), /ledger_(check|record)_hook\.py/);
  delete process.env.HELM_SETTINGS;
});

test('cursor adapter writes and removes its hooks', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-cur-'));
  process.env.HELM_CURSOR_DIR = tmp;
  delete require.cache[require.resolve('../adapters/cursor/install.js')];
  const cur = require('../adapters/cursor/install.js');
  cur.wireHooks(false);
  const hp = path.join(tmp, 'hooks.json');
  let h = JSON.parse(fs.readFileSync(hp, 'utf8'));
  assert.match(JSON.stringify(h.hooks.beforeToolUse), /ledger_check_hook\.py/);
  assert.match(JSON.stringify(h.hooks.afterToolUse), /ledger_record_hook\.py/);
  cur.wireHooks(true);
  h = JSON.parse(fs.readFileSync(hp, 'utf8'));
  assert.doesNotMatch(JSON.stringify(h.hooks), /ledger_(check|record)_hook\.py/);
  delete process.env.HELM_CURSOR_DIR;
});

test('os-init scaffold lays down a vault with a valid config', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-vault-'));
  const { scaffold } = require('../install/os-init/scaffold.js');
  const target = path.join(tmp, 'vault');
  const r = scaffold(target);
  assert.ok(fs.existsSync(path.join(target, 'brain.md')));
  assert.ok(fs.existsSync(path.join(target, '_meta', 'project-template.md')));
  const cfg = JSON.parse(fs.readFileSync(r.config, 'utf8'));
  assert.strictEqual(cfg.paths.vaultRoot, target);
  assert.ok(Array.isArray(cfg.projects));
});
