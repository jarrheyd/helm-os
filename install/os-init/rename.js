#!/usr/bin/env node
'use strict';
/**
 * Rename an OS: move the vault folder to "<New Name> OS" and update the config
 * (identity.name + paths.vaultRoot). After this, repoint your scheduled runs
 * and re-run your adapter, since the vault path changed.
 *
 * Usage: node rename.js <currentVaultDir> "<New Name>"
 */
const fs = require('fs');
const path = require('path');
const { osFolderName } = require('./scaffold');

function renameOS(currentDir, newName) {
  const cur = path.resolve(currentDir);
  if (!fs.existsSync(cur)) throw new Error(`no vault at ${cur}`);
  const dest = path.join(path.dirname(cur), osFolderName(newName));
  if (fs.existsSync(dest) && dest !== cur) throw new Error(`${dest} already exists`);
  if (dest !== cur) fs.renameSync(cur, dest);
  const cfgPath = path.join(dest, 'os.config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.identity = cfg.identity || {};
    cfg.identity.name = newName;
    cfg.paths = cfg.paths || {};
    cfg.paths.vaultRoot = dest;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  }
  return { vault: dest, config: cfgPath };
}

if (require.main === module) {
  const [dir, name] = process.argv.slice(2);
  if (!dir || !name) { console.error('usage: node rename.js <currentVaultDir> "<New Name>"'); process.exit(1); }
  const r = renameOS(dir, name);
  console.log(`renamed to ${r.vault}\nconfig vaultRoot + identity.name updated.\nnext: repoint your scheduled runs and re-run your adapter at the new path.`);
}
module.exports = { renameOS };
