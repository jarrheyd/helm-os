#!/usr/bin/env node
'use strict';
/**
 * Cursor adapter. Writes the write-ledger gate into Cursor's hook config and
 * scaffolds a system-scheduler shim for the runs (Cursor has no scheduler).
 * Same framework, same config as the Claude Code adapter; only the wiring differs.
 *
 * Env overrides (for testing): HELM_CURSOR_DIR (the .cursor dir),
 * HELM_VAULT / HELM_CONFIG (the config). Flag: --remove undoes the hooks.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..', '..');
const HOOK_DIR = path.join(REPO, 'helm', 'gates', 'write-ledger', 'hooks');
const MATCH = 'mcp__.*__(createJiraIssue|addCommentToJiraIssue|jira_create_issue|jira_add_comment|wrike_create_task|linear_create_issue|create_issue)';

function cursorDir() { return process.env.HELM_CURSOR_DIR || path.join(os.homedir(), '.cursor'); }
function hooksFile() { return path.join(cursorDir(), 'hooks.json'); }
function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } }

function wireHooks(remove) {
  const p = hooksFile();
  const cfg = readJson(p, {});
  cfg.hooks = cfg.hooks || {};
  const mk = (script) => ({ matcher: MATCH, command: `python3 ${path.join(HOOK_DIR, script)}` });
  if (remove) {
    for (const ev of ['beforeToolUse', 'afterToolUse']) {
      cfg.hooks[ev] = (cfg.hooks[ev] || []).filter((h) => !/ledger_(check|record)_hook\.py/.test(h.command || ''));
    }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
    return 'removed';
  }
  cfg.hooks.beforeToolUse = cfg.hooks.beforeToolUse || [];
  cfg.hooks.afterToolUse = cfg.hooks.afterToolUse || [];
  const present = (arr, s) => arr.some((h) => (h.command || '').includes(s));
  if (!present(cfg.hooks.beforeToolUse, 'ledger_check_hook.py')) cfg.hooks.beforeToolUse.push(mk('ledger_check_hook.py'));
  if (!present(cfg.hooks.afterToolUse, 'ledger_record_hook.py')) cfg.hooks.afterToolUse.push(mk('ledger_record_hook.py'));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  return 'wired';
}

function scheduleHint(cfg) {
  const cron = (cfg && cfg.schedule && cfg.schedule.cron) || '45 7,12,19 * * 1-5';
  const vault = cfg && cfg.paths && cfg.paths.vaultRoot;
  return { cron, vault, note: 'Cursor has no scheduler. Add a launchd (macOS) or cron (Linux) entry that runs the routine headless on this cron with HELM_VAULT set.' };
}

function main() {
  const remove = process.argv.includes('--remove');
  const r = wireHooks(remove);
  if (remove) { console.log('cursor adapter: hooks removed.'); return; }
  const cfg = process.env.HELM_CONFIG || process.env.HELM_VAULT ? readJson(process.env.HELM_CONFIG || path.join(process.env.HELM_VAULT, 'os.config.json'), null) : null;
  const s = scheduleHint(cfg);
  console.log(`cursor adapter: write-ledger hooks ${r} in ${hooksFile()}.`);
  console.log(`schedule: cron "${s.cron}"${s.vault ? ' vault ' + s.vault : ''}`);
  console.log(s.note);
}

if (require.main === module) main();
module.exports = { wireHooks, hooksFile, scheduleHint };
