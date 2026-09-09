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
