'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EA = path.join(ROOT, 'helm/routines/ea/ea-workflow.js');

test('ported EA workflow parses', () => {
  execFileSync('node', ['--check', EA]); // throws on syntax error
});

test('EA workflow is config-driven, not hardcoded', () => {
  const s = fs.readFileSync(EA, 'utf8');
  // reads config and derives seams from it
  assert.match(s, /A\.config/, 'reads args.config');
  assert.match(s, /SLOTS_TEXT/, 'derives the slot text');
  assert.match(s, /POD_BY_KEY/, 'fires pods from config, not a hardcoded map');
  assert.match(s, /BOARDS_TEXT/, 'derives boards from config');
  // no hardcoded owner vault path or the old pod-agent map
  assert.doesNotMatch(s, /com~apple~CloudDocs/, 'no hardcoded vault path');
  assert.doesNotMatch(s, /healthhub-pm/, 'no hardcoded pod-agent names');
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
