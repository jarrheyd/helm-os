'use strict';
/**
 * Load the user's Log config. Resolution order: HELM_CONFIG env (a full path),
 * else HELM_VAULT env joined with os.config.json, else error with guidance.
 * Validation is intentionally light (stdlib only, no deps): check the required
 * top-level keys the schema names, so a broken config fails loudly at start
 * rather than deep inside a sweep.
 */
const fs = require('fs');
const path = require('path');
const { vaultPaths } = require('./paths');

const REQUIRED = ['identity', 'schedule', 'paths', 'connectors', 'pods'];

function configFile() {
  if (process.env.HELM_CONFIG) return process.env.HELM_CONFIG;
  if (process.env.HELM_VAULT) return path.join(process.env.HELM_VAULT, 'os.config.json');
  throw new Error(
    'No config located. Set HELM_CONFIG to an os.config.json path, or HELM_VAULT to the vault root.'
  );
}

function loadConfig() {
  const file = configFile();
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new Error(`Cannot read config at ${file}: ${e.message}`);
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Config at ${file} is not valid JSON: ${e.message}`);
  }
  const missing = REQUIRED.filter((k) => !cfg[k]);
  if (missing.length) {
    throw new Error(`Config at ${file} is missing required keys: ${missing.join(', ')}`);
  }
  if (!cfg.paths.vaultRoot) {
    throw new Error(`Config at ${file} has no paths.vaultRoot.`);
  }
  const paths = vaultPaths(cfg.paths.vaultRoot);
  return { cfg, paths, file };
}

module.exports = { loadConfig, configFile, REQUIRED };
