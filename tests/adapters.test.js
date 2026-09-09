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

test('codex adapter writes and removes its launchd schedule', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-codex-'));
  process.env.HELM_LAUNCH_DIR = tmp;
  process.env.HELM_CONFIG = path.join(ROOT, 'helm/templates/os.config.example.json');
  delete require.cache[require.resolve('../adapters/codex/install.js')];
  const cx = require('../adapters/codex/install.js');
  cx.install(false);
  const plist = cx.plistPath();
  const xml = fs.readFileSync(plist, 'utf8');
  assert.match(xml, /codex/, 'runs codex exec');
  assert.match(xml, /StartCalendarInterval/, 'has a schedule');
  assert.match(xml, /<key>Hour<\/key><integer>7<\/integer>/, 'includes the morning slot');
  // one entry per slot-hour x 5 weekdays
  const cals = cx.calendarIntervals({ schedule: { slots: { '7': 'morning', '12': 'capture', '19': 'evening' } } });
  assert.strictEqual(cals.length, 15);
  cx.install(true);
  assert.ok(!fs.existsSync(plist));
  delete process.env.HELM_LAUNCH_DIR;
  delete process.env.HELM_CONFIG;
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
