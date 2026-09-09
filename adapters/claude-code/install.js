#!/usr/bin/env node
'use strict';
/**
 * Claude Code adapter. Wires the write-ledger gate into settings.json and
 * scaffolds the scheduled-run SKILL files, all from the user's config.
 *
 * Env overrides (for testing): HELM_SETTINGS (settings.json path),
 * HELM_TASKS_DIR (scheduled-tasks dir), HELM_VAULT / HELM_CONFIG (the config).
 * Flags: --remove undoes the hooks it added.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..', '..');
const HOOK_DIR = path.join(REPO, 'helm', 'gates', 'write-ledger', 'hooks');
const CHECK = `python3 ${path.join(HOOK_DIR, 'ledger_check_hook.py')}`;
const RECORD = `python3 ${path.join(HOOK_DIR, 'ledger_record_hook.py')}`;
const MATCH = 'mcp__.*__(createJiraIssue|addCommentToJiraIssue|jira_create_issue|jira_add_comment|wrike_create_task|linear_create_issue|create_issue)';

function settingsPath() {
  return process.env.HELM_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');
}
function readJson(p, dflt) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; } }
function writeJson(p, o) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); }
function has(arr, cmd) { return (arr || []).some((e) => (e.hooks || []).some((h) => (h.command || '').includes(cmd))); }
function entry(cmd) { return { matcher: MATCH, hooks: [{ type: 'command', command: cmd, timeout: 5 }] }; }

function wireHooks(remove) {
  const p = settingsPath();
  const s = readJson(p, {});
  s.hooks = s.hooks || {};
  s.hooks.PreToolUse = s.hooks.PreToolUse || [];
  s.hooks.PostToolUse = s.hooks.PostToolUse || [];
  const dropLedger = (arr) => arr.filter((e) => !(e.hooks || []).some((h) => /ledger_(check|record)_hook\.py/.test(h.command || '')));
  if (remove) {
    s.hooks.PreToolUse = dropLedger(s.hooks.PreToolUse);
    s.hooks.PostToolUse = dropLedger(s.hooks.PostToolUse);
    writeJson(p, s);
    return 'removed';
  }
  if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak.' + Date.now());
  if (!has(s.hooks.PreToolUse, 'ledger_check_hook.py')) s.hooks.PreToolUse.push(entry(CHECK));
  if (!has(s.hooks.PostToolUse, 'ledger_record_hook.py')) s.hooks.PostToolUse.push(entry(RECORD));
  writeJson(p, s);
  return 'wired';
}

function loadConfig() {
  const file = process.env.HELM_CONFIG || (process.env.HELM_VAULT && path.join(process.env.HELM_VAULT, 'os.config.json'));
  if (!file || !fs.existsSync(file)) return null;
  return readJson(file, null);
}

function scaffoldTasks(cfg) {
  if (!cfg) return [];
  const dir = process.env.HELM_TASKS_DIR || path.join(os.homedir(), '.claude', 'scheduled-tasks');
  const cron = (cfg.schedule && cfg.schedule.cron) || '45 7,12,19 * * 1-5';
  const vault = cfg.paths.vaultRoot;
  const made = [];
  const tasks = [
    { id: 'helm-brief', routine: 'helm/routines/brief/SKILL.md', desc: 'Daily brief (helm-os), config-driven.' },
    { id: 'helm-project-health', routine: 'helm/routines/project-health/SKILL.md', desc: 'Project health read (helm-os).' },
    { id: 'helm-optimize', routine: 'helm/routines/optimize/SKILL.md', desc: 'Weekly OS upkeep (helm-os): enforce the retention contract.', cron: '0 15 * * 5' },
  ];
  for (const t of tasks) {
    const tdir = path.join(dir, t.id);
    fs.mkdirSync(tdir, { recursive: true });
    const taskCron = t.cron || cron;
    const body = `---\nname: ${t.id}\ndescription: ${t.desc} cron ${taskCron}\n---\n\nRun the helm-os routine at ${path.join(REPO, t.routine)} with HELM_VAULT=${vault}. Read os.config.json from the vault, pick the mode from the local clock, and invoke the routine's workflow with { mode, now, config }.\n`;
    fs.writeFileSync(path.join(tdir, 'SKILL.md'), body);
    made.push({ id: t.id, cron: t.cron || cron });
  }
  return made;
}

function main() {
  const remove = process.argv.includes('--remove');
  const hookResult = wireHooks(remove);
  if (remove) { console.log('claude-code adapter: hooks removed.'); return; }
  const cfg = loadConfig();
  const tasks = scaffoldTasks(cfg);
  console.log(`claude-code adapter: write-ledger hooks ${hookResult} in ${settingsPath()}.`);
  if (tasks.length) {
    console.log('scaffolded scheduled runs (register each cron with the scheduled-tasks system):');
    for (const t of tasks) console.log(`  ${t.id}  ->  cron "${t.cron}"`);
  } else {
    console.log('no config found (set HELM_VAULT or HELM_CONFIG) - skipped scheduled runs.');
  }
}

if (require.main === module) main();
module.exports = { wireHooks, scaffoldTasks, loadConfig, settingsPath };
