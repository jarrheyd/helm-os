#!/usr/bin/env node
'use strict';
/**
 * Read the MCP servers the user already has in their runner, so os-init can
 * propose them instead of asking cold. Claude Code keeps them in ~/.claude.json
 * (mcpServers); Codex keeps them in ~/.codex/config.toml ([mcp_servers.<name>]).
 * Prints JSON: { servers: [{ name, type, source }] }. Best-effort, never throws.
 *
 * Env overrides (for testing): HELM_CLAUDE_JSON, HELM_CODEX_TOML.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const TYPE_RULES = [
  ['email', /gmail|outlook|\bmail\b/i],
  ['calendar', /calendar|gcal/i],
  ['chat', /telegram|whatsapp|discord|slack|teams|google-?chat|gchat|imessage|messenger/i],
  ['meetings', /tactiq|pocket|read-?ai|fireflies|otter|granola/i],
  ['tracker', /jira|wrike|linear|asana|clickup|monday|notion/i],
];
function classify(name) {
  for (const [type, re] of TYPE_RULES) if (re.test(name)) return type;
  return 'other';
}

function fromClaude() {
  const p = process.env.HELM_CLAUDE_JSON || path.join(os.homedir(), '.claude.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    const names = Object.keys(cfg.mcpServers || {});
    return names.map((n) => ({ name: n, type: classify(n), source: 'claude-code' }));
  } catch { return []; }
}

function fromCodex() {
  const p = process.env.HELM_CODEX_TOML || path.join(os.homedir(), '.codex', 'config.toml');
  try {
    const toml = fs.readFileSync(p, 'utf8');
    const out = [];
    const re = /^\[mcp_servers\.([^\].]+)\]/gm; // section header, top level only
    let m;
    while ((m = re.exec(toml))) out.push({ name: m[1], type: classify(m[1]), source: 'codex' });
    return out;
  } catch { return []; }
}

function detect() {
  const seen = new Set();
  const servers = [];
  for (const s of [...fromClaude(), ...fromCodex()]) {
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    servers.push(s);
  }
  return { servers };
}

if (require.main === module) console.log(JSON.stringify(detect(), null, 2));
module.exports = { detect, classify, fromClaude, fromCodex };
