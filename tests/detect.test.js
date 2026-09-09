'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('detect-connectors reads Claude and Codex configs and classifies them', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-detect-'));
  const cj = path.join(tmp, 'claude.json');
  fs.writeFileSync(cj, JSON.stringify({ mcpServers: { gmail: {}, telegram: {}, 'jira-acme': {} } }));
  const ct = path.join(tmp, 'config.toml');
  fs.writeFileSync(ct, '[mcp_servers.pocket]\ncommand = "x"\n[mcp_servers.discord]\ncommand = "y"\n[mcp_servers.discord.env]\nK = "1"\n');
  process.env.HELM_CLAUDE_JSON = cj;
  process.env.HELM_CODEX_TOML = ct;
  delete require.cache[require.resolve('../install/os-init/detect-connectors.js')];
  const { detect, classify } = require('../install/os-init/detect-connectors.js');
  assert.strictEqual(classify('gmail'), 'email');
  assert.strictEqual(classify('telegram'), 'chat');
  assert.strictEqual(classify('jira-acme'), 'tracker');
  assert.strictEqual(classify('pocket'), 'meetings');
  const d = detect();
  const names = d.servers.map((s) => s.name).sort();
  assert.deepStrictEqual(names, ['discord', 'gmail', 'jira-acme', 'pocket', 'telegram']);
  // nested [mcp_servers.discord.env] must not be double-counted
  assert.strictEqual(d.servers.filter((s) => s.name === 'discord').length, 1);
  delete process.env.HELM_CLAUDE_JSON;
  delete process.env.HELM_CODEX_TOML;
});
