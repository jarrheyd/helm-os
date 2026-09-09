#!/usr/bin/env node
'use strict';
/**
 * Lay down a fresh vault from the template and write an os.config.json.
 * The vault folder is named after the owner: pass a
 * name and it creates "<Name> OS" in the current directory, or pass an explicit
 * target path. Idempotent per file: it never overwrites an existing vault file.
 *
 * Usage:
 *   node scaffold.js --name "Alex Rivera"            -> ./Alex Rivera OS
 *   node scaffold.js --name "Alex" /path/to/parent   -> /path/to/parent/Alex OS
 *   node scaffold.js /explicit/vault/dir             -> that exact dir
 * Options: --config <file>  seed from a specific config instead of the example.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const TEMPLATE = path.join(REPO, 'helm', 'templates', 'vault');
const EXAMPLE = path.join(REPO, 'helm', 'templates', 'os.config.example.json');

function osFolderName(name) {
  const clean = String(name).trim().replace(/\s+/g, ' ');
  return /\bos$/i.test(clean) ? clean : `${clean} OS`;
}

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d); // never clobber a user's file
  }
}

// Copy the framework itself into <vault>/.helm so the vault is self-contained
// and the cloned repo can be deleted after setup.
function installFramework(target) {
  const dest = path.join(target, '.helm');
  for (const part of ['helm', 'adapters', 'install', 'scripts', 'package.json']) {
    const src = path.join(REPO, part);
    if (!fs.existsSync(src)) continue;
    const d = path.join(dest, part);
    if (fs.statSync(src).isDirectory()) copyTree(src, d);
    else { fs.mkdirSync(path.dirname(d), { recursive: true }); if (!fs.existsSync(d)) fs.copyFileSync(src, d); }
  }
  return dest;
}

function scaffold(target, opts = {}) {
  copyTree(TEMPLATE, target);
  if (opts.framework) installFramework(target);
  const cfgOut = path.join(target, 'os.config.json');
  if (!fs.existsSync(cfgOut)) {
    const cfg = JSON.parse(fs.readFileSync(opts.configPath || EXAMPLE, 'utf8'));
    cfg.identity = cfg.identity || {};
    if (opts.name) cfg.identity.name = opts.name;
    cfg.paths = cfg.paths || {};
    cfg.paths.vaultRoot = target;
    fs.writeFileSync(cfgOut, JSON.stringify(cfg, null, 2) + '\n');
  }
  return { vault: target, config: cfgOut };
}

function parseArgs(argv) {
  const a = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name') a.name = argv[++i];
    else if (argv[i] === '--config') a.configPath = argv[++i];
    else if (argv[i] === '--no-framework') a.noFramework = true;
    else a.positional.push(argv[i]);
  }
  return a;
}

function resolveTarget(a) {
  if (a.name) {
    const parent = a.positional[0] ? path.resolve(a.positional[0]) : process.cwd();
    return path.join(parent, osFolderName(a.name));
  }
  if (a.positional[0]) return path.resolve(a.positional[0]);
  return null;
}

if (require.main === module) {
  const a = parseArgs(process.argv.slice(2));
  const target = resolveTarget(a);
  if (!target) {
    console.error('usage: node scaffold.js --name "<Your Name>" [parentDir]  |  node scaffold.js <vaultDir>');
    process.exit(1);
  }
  const r = scaffold(target, { name: a.name, configPath: a.configPath, framework: a.noFramework !== true });
  console.log(`vault scaffolded at ${r.vault}\nconfig at ${r.config}\nframework copied to ${r.vault}/.helm - you can delete the cloned repo now.`);
}
module.exports = { scaffold, installFramework, osFolderName, resolveTarget, parseArgs, TEMPLATE, EXAMPLE };
