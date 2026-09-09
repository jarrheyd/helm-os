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
  assert.match(JSON.stringify(s.hooks.PreToolUse), /ledger_check_hook\.py/);
  assert.match(JSON.stringify(s.hooks.PostToolUse), /ledger_record_hook\.py/);
  cc.wireHooks(false); // idempotent
  s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.strictEqual(s.hooks.PreToolUse.filter((e) => JSON.stringify(e).includes('ledger_check_hook.py')).length, 1);
  cc.wireHooks(true);
  s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.doesNotMatch(JSON.stringify(s.hooks), /ledger_(check|record)_hook\.py/);
  delete process.env.HELM_SETTINGS;
});

test('codex adapter writes and removes all three launchd jobs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-codex-'));
  process.env.HELM_LAUNCH_DIR = tmp;
  process.env.HELM_CONFIG = path.join(ROOT, 'helm/templates/os.config.example.json');
  delete require.cache[require.resolve('../adapters/codex/install.js')];
  const cx = require('../adapters/codex/install.js');
  const made = cx.install(false);
  assert.deepStrictEqual(made.sort(), ['com.helm-os.brief', 'com.helm-os.optimize', 'com.helm-os.project-health']);
  const brief = fs.readFileSync(cx.plistPath('com.helm-os.brief'), 'utf8');
  assert.match(brief, /codex/);
  assert.match(brief, /<key>Hour<\/key><integer>7<\/integer>/);
  const opt = fs.readFileSync(cx.plistPath('com.helm-os.optimize'), 'utf8');
  assert.match(opt, /<key>Weekday<\/key><integer>5<\/integer>/);
  assert.strictEqual(cx.briefIntervals({ schedule: { slots: { '7': 'm', '12': 'c', '19': 'e' } } }).length, 15);
  cx.install(true);
  assert.ok(!fs.existsSync(cx.plistPath('com.helm-os.brief')));
  delete process.env.HELM_LAUNCH_DIR;
  delete process.env.HELM_CONFIG;
});

test('os-init scaffold lays down a vault with a valid config', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-vault-'));
  const { scaffold } = require('../install/os-init/scaffold.js');
  const target = path.join(tmp, 'vault');
  const r = scaffold(target);
  assert.ok(fs.existsSync(path.join(target, 'brain.md')));
  assert.ok(fs.existsSync(path.join(target, 'CLAUDE.md')));
  assert.ok(fs.existsSync(path.join(target, '_meta', 'project-template.md')));
  const cfg = JSON.parse(fs.readFileSync(r.config, 'utf8'));
  assert.strictEqual(cfg.paths.vaultRoot, target);
  assert.ok(Array.isArray(cfg.projects));
});
