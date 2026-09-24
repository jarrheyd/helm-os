'use strict';
/**
 * Resolve where usage reads transcripts from and writes its files to.
 * Order: env override, then os.config.json `usage` block, then defaults.
 * Env: HELM_USAGE_DIR, HELM_CLAUDE_PROJECTS, HELM_CODEX_SESSIONS (":"-separated).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

/** The chip preamble the OS prepends to spawned tasks; its opening words mark a prompt as the OS's. */
function chipPrefix(vault) {
  try {
    const txt = fs.readFileSync(path.join(vault, '_meta', 'chip-preamble.md'), 'utf8');
    const body = txt.split(/^---\s*$/m)[1] || '';
    const first = body.trim().split('\n')[0].split('[')[0].split(' - ')[0].trim();
    return first.length >= 12 ? first.slice(0, 40) : '';
  } catch { return ''; }
}

function loadUsageConfig() {
  const file = process.env.HELM_CONFIG || (process.env.HELM_VAULT && path.join(process.env.HELM_VAULT, 'os.config.json'));
  const cfg = (file && readJson(file)) || {};
  const u = cfg.usage || {};
  const vault = (cfg.paths && cfg.paths.vaultRoot) || process.env.HELM_VAULT || '';
  const home = os.homedir();
  const dir = process.env.HELM_USAGE_DIR || u.dir || (vault ? path.join(vault, '_usage') : path.join(home, '.helm-usage'));
  const codex = process.env.HELM_CODEX_SESSIONS
    ? process.env.HELM_CODEX_SESSIONS.split(':')
    : (u.codexDirs || [path.join(home, '.codex', 'sessions'), path.join(home, '.codex', 'archived_sessions')]);
  const ownerName = (u.ownerName || (cfg.identity && cfg.identity.name) || '').trim();
  const osPrefixes = (u.osPrefixes || []).concat(vault ? [chipPrefix(vault)] : []).filter(Boolean);
  return {
    cfg,
    classifyOpts: { osPrefixes, ownerName },
    vault,
    dir,
    claudeDir: process.env.HELM_CLAUDE_PROJECTS || u.claudeDir || path.join(home, '.claude', 'projects'),
    codexDirs: codex,
    timezone: (cfg.identity && cfg.identity.timezone) || u.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    particles: u.particles || [],
    languages: u.languages || {},
    projects: cfg.projects || [],
    peopleFile: u.peopleFile ? path.resolve(vault || '.', u.peopleFile) : (vault ? path.join(vault, 'People', 'people.md') : ''),
    aliases: u.aliases || {},
    projectPaths: u.projectPaths || {},
    projectAliases: u.projectAliases || {},
    hubPaths: (u.hubPaths || []).concat(vault ? [vault] : []),
    prices: u.prices || {},
    model: u.model !== false,
  };
}

module.exports = { loadUsageConfig };
