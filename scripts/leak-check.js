'use strict';
/**
 * Boundary guard. Fails if any Log token (a real person, client, id, or the
 * owner's private paths) appears anywhere under helm/, adapters/, or install/.
 * Run before every push. Keeps the public Helm free of one user's data.
 *
 * The denylist is deliberately specific real values, not generic words, so it
 * does not false-positive on ordinary machinery. Extend it as new private
 * values appear. Case-insensitive.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['helm', 'adapters', 'install'];
const SKIP = new Set(['node_modules', '.git']);

// Specific private tokens that must never appear in shipped Helm.
const DENY = [
  // people / org
  'Jarrhey', 'De la Pena', 'Symph', 'Peaksy',
  // clients / missions
  'mWell', 'HealthHub', 'HealthID', 'Health ID', 'HealthPal', 'Kapwa',
  'OceanJet', 'Penbrothers', 'Gussy', 'GiyaPay', 'BIMS', 'Coaxis',
  'USPAACC', 'Metro Retail', 'GoRocky', 'Josys', 'Brex',
  // real ids
  'dac5bc43-44cf-406d-b330', '688651268146855958', '688634391660068872',
  '8c115b6e-1952-4a43-8616', 'heypocketai.com',
  // private paths
  'com~apple~CloudDocs/JARRHEY',
];

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

function main() {
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  const hits = [];
  const needles = DENY.map((t) => {
    // allow the public repo handle 'jarrheyd' while still catching the person-name 'Jarrhey'
    if (t === 'Jarrhey') return { t, re: /Jarrhey(?!d)/i };
    return { t, re: new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
  });
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      for (const { t, re } of needles) {
        if (re.test(line)) hits.push({ file: path.relative(ROOT, f), line: i + 1, token: t });
      }
    });
  }
  if (hits.length) {
    console.error('LEAK CHECK FAILED: Log values found in Helm.\n');
    for (const h of hits) console.error(`  ${h.file}:${h.line}  contains "${h.token}"`);
    console.error(`\n${hits.length} leak(s). Move these into the user's config, or genericize.`);
    process.exit(1);
  }
  console.log(`leak-check clean: scanned ${files.length} files under ${SCAN_DIRS.join(', ')}`);
}

main();
