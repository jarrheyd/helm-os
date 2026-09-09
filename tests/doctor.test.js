'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('doctor reports on a fresh scaffold and does not fail', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-doc-'));
  const { scaffold, osFolderName } = require('../install/os-init/scaffold.js');
  const vault = path.join(parent, osFolderName('Test User'));
  scaffold(vault, { name: 'Test User' });
  const env = { ...process.env, HELM_VAULT: vault, HELM_CLAUDE_JSON: '/nonexistent', HELM_CODEX_TOML: '/nonexistent' };
  const out = execFileSync('node', ['install/os-init/doctor.js'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.match(out, /config loads/);
  assert.match(out, /present: CLAUDE\.md/);
  assert.match(out, /\d+ ok, \d+ warning/);
});
