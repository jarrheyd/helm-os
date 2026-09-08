#!/usr/bin/env node
'use strict';
/**
 * Lay down a fresh vault from the template and write an os.config.json.
 * The os-init interview (SKILL.md) gathers answers and calls this to build
 * the Log. Idempotent per file: it never overwrites an existing vault file.
 *
 * Usage: node scaffold.js <targetVaultDir> [configJsonPath]
 * If configJsonPath is omitted, the example config is copied as a starting point
 * with its vaultRoot set to the target.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const TEMPLATE = path.join(REPO, 'helm', 'templates', 'vault');
const EXAMPLE = path.join(REPO, 'helm', 'templates', 'os.config.example.json');

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d); // never clobber a user's file
  }
}

function scaffold(target, configPath) {
  copyTree(TEMPLATE, target);
  const cfgOut = path.join(target, 'os.config.json');
  if (!fs.existsSync(cfgOut)) {
    let cfg = JSON.parse(fs.readFileSync(configPath || EXAMPLE, 'utf8'));
    cfg.paths = cfg.paths || {};
    cfg.paths.vaultRoot = target;
    fs.writeFileSync(cfgOut, JSON.stringify(cfg, null, 2) + '\n');
  }
  return { vault: target, config: cfgOut };
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) { console.error('usage: node scaffold.js <targetVaultDir> [configJsonPath]'); process.exit(1); }
  const r = scaffold(path.resolve(target), process.argv[3]);
  console.log(`vault scaffolded at ${r.vault}\nconfig at ${r.config}`);
}
module.exports = { scaffold, TEMPLATE, EXAMPLE };
