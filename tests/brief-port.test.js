'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BRIEF = path.join(ROOT, 'helm/routines/brief/brief-workflow.js');

test('ported brief workflow parses', () => {
  execFileSync('node', ['--check', BRIEF]); // throws on syntax error
});

test('brief workflow is config-driven, not hardcoded', () => {
  const s = fs.readFileSync(BRIEF, 'utf8');
  // reads config and derives seams from it
  assert.match(s, /A\.config/, 'reads args.config');
  assert.match(s, /SLOTS_TEXT/, 'derives the slot text');
  assert.match(s, /PROJECT_BY_KEY/, 'fires projects from config, not a hardcoded map');
  assert.match(s, /BOARDS_TEXT/, 'derives boards from config');
  // no hardcoded owner vault path or the old project-agent map
  assert.doesNotMatch(s, /com~apple~CloudDocs/, 'no hardcoded vault path');
  assert.doesNotMatch(s, /healthhub-pm/, 'no hardcoded project-agent names');
});

test('config parity: a config reproduces the seam strings', () => {
  // synthetic config that mirrors the derivation the workflow uses
  const C = {
    schedule: { slots: { '7': 'morning', '11': 'capture', '14': 'capture', '16': 'capture', '19': 'evening' } },
    identityIds: { discord: { authorId: 'A1', guildId: 'G1' } },
    areas: [{ name: 'Alpha', emoji: '🅰️' }, { name: 'Beta', emoji: '🅱️' }],
  };
  const by = {};
  for (const [h, m] of Object.entries(C.schedule.slots)) (by[m] = by[m] || []).push(String(h).padStart(2, '0'));
  const slotsText = Object.entries(by).map(([m, hs]) => hs.sort().join(',') + '=' + m.toUpperCase()).join(' · ');
  assert.strictEqual(slotsText, '07=MORNING · 11,14,16=CAPTURE · 19=EVENING');
  const areasText = C.areas.map(a => a.emoji + ' ' + a.name).join(' · ');
  assert.strictEqual(areasText, '🅰️ Alpha · 🅱️ Beta');
});

// Chip targeting (owed items get chips, not just reds). Pulls the real function out of the workflow source.
function loadChipTargets() {
  const s = fs.readFileSync(BRIEF, 'utf8');
  const m = s.match(/\/\/ <chip-targets>\n([\s\S]*?)\/\/ <\/chip-targets>/);
  assert.ok(m, 'workflow carries a delimited chip-targets block');
  return new Function(`${m[1]}; return { buildChipTargets, isDueSoon };`)();
}

test('owed actions and reds both become chip targets, uncapped', () => {
  const { buildChipTargets } = loadChipTargets();
  const reds = Array.from({ length: 7 }, (_, i) => ({ marker: 'red', who: `R${i}`, what: `red ${i}` }));
  const owed = [
    { meeting: 'Sync', action: 'Starlabs commercials', due: '2026-09-18', done: false },
    { meeting: 'Sync', action: 'Designers roundtable', due: '2026-09-30', done: false },
  ];
  const t = buildChipTargets(reds, owed, '2026-09-16T07:46:00+08:00');
  assert.strictEqual(t.length, 9, 'no slice(0, 5): 7 reds + 2 owed');
  const star = t.find(x => x.title === 'Starlabs commercials');
  assert.ok(star && star.kind === 'owed' && star.dueSoon === true);
  assert.strictEqual(t.find(x => x.title === 'Designers roundtable').dueSoon, false);
});

test('done owed actions are not targets', () => {
  const { buildChipTargets } = loadChipTargets();
  const t = buildChipTargets([], [{ action: 'x', due: 'today', done: true }], '2026-09-16T07:46:00+08:00');
  assert.strictEqual(t.length, 0);
});

test('isDueSoon reads dates, words, and treats unknown as soon', () => {
  const { isDueSoon } = loadChipTargets();
  const now = '2026-09-16T07:46:00+08:00';
  assert.strictEqual(isDueSoon('today', now), true);
  assert.strictEqual(isDueSoon('tomorrow', now), true);
  assert.strictEqual(isDueSoon('2026-09-19', now), true, '3 days out is inside');
  assert.strictEqual(isDueSoon('2026-09-20', now), false);
  assert.strictEqual(isDueSoon('09-18', now), true, 'MM-DD uses the current year');
  assert.strictEqual(isDueSoon('2026-09-10', now), true, 'overdue is soon');
  assert.strictEqual(isDueSoon('this week', now), true, 'unparseable never hides an item');
});

test('surface checks live sessions and chips grill before writing', () => {
  const s = fs.readFileSync(BRIEF, 'utf8');
  const surface = s.slice(s.indexOf('STAGE: SURFACE'));
  assert.ok(s.indexOf('const openActions') < s.indexOf('STAGE: SURFACE'), 'owed actions computed before SURFACE');
  assert.doesNotMatch(s, /chipworthy[^\n]*\.slice\(0, 5\)/, 'no 5-chip cap');
  assert.match(surface, /list_sessions/, 'SURFACE reads live sessions');
  const hunt = surface.indexOf('HUNT:'), grill = surface.indexOf('GRILL:'), write = surface.indexOf('WRITE:');
  assert.ok(hunt > -1 && hunt < grill && grill < write, 'chip prompt orders hunt, grill, write');
  assert.match(s, /routed/, 'surface returns routed items for the brief');
});

test('the run never writes doc reviews itself', () => {
  const s = fs.readFileSync(BRIEF, 'utf8');
  assert.doesNotMatch(s, /land it in the project reviews\//);
});
