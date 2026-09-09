#!/usr/bin/env node
'use strict';
/**
 * os doctor: check a set-up OS and report what is ready and what is missing.
 * Reads the config, the vault files, the audio key source, and the connectors
 * named in config against the ones actually installed. Never prints a key.
 *
 * Usage: HELM_VAULT="/path/to/Your Name OS" node install/os-init/doctor.js
 * Exit: 0 if nothing critical is wrong, 1 if the config will not load.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..', '..');
const { detect } = require('./detect-connectors');

function hasGeminiKey() {
  if (process.env.GEMINI_TTS_KEY || process.env.GEMINI_API_KEY) return true;
  if (fs.existsSync(path.join(os.homedir(), '.claude', '.gemini-tts-key'))) return true;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
    return !!(cfg.mcpServers && cfg.mcpServers.gemini && cfg.mcpServers.gemini.env
      && cfg.mcpServers.gemini.env.GEMINI_API_KEY);
  } catch { return false; }
}

function main() {
  const ok = [], warn = [], bad = [];
  let cfg, paths;
  try {
    ({ cfg, paths } = require(path.join(REPO, 'helm/lib/config.js')).loadConfig());
    ok.push(`config loads (${cfg.projects.length} projects, ${(cfg.connectors.chatSurfaces || []).length} chat channels)`);
  } catch (e) {
    bad.push(`config: ${e.message}`);
    report(ok, warn, bad);
    process.exit(1);
  }

  // vault files
  const need = [paths.brain, paths.index, paths.meta.followups, paths.meta.taxonomy, paths.meta.retention,
    path.join(paths.root, 'CLAUDE.md'), path.join(paths.root, '_meta', 'project-template.md')];
  for (const f of need) (fs.existsSync(f) ? ok : warn).push(`${fs.existsSync(f) ? 'present' : 'MISSING'}: ${path.relative(paths.root, f)}`);

  // audio
  if (cfg.audio && cfg.audio.enabled) {
    (hasGeminiKey() ? ok : warn).push(hasGeminiKey()
      ? 'audio: a Gemini key is available'
      : 'audio enabled but no Gemini key found (set GEMINI_TTS_KEY or GEMINI_API_KEY) - audio will be skipped');
    for (const h of ['tts.py', 'player.py']) {
      const p = path.join(paths.root, '_meta', h);
      (fs.existsSync(p) ? ok : warn).push(`${fs.existsSync(p) ? 'present' : 'MISSING'}: _meta/${h}`);
    }
  }

  // connectors named vs installed
  const installed = new Set(detect().servers.map((s) => s.name.toLowerCase()));
  const named = [];
  const c = cfg.connectors || {};
  if (c.email) named.push(c.email);
  for (const s of c.chatSurfaces || []) named.push(s.type);
  for (const m of c.meetingSources || []) named.push(m);
  for (const b of c.ticketBoards || []) named.push(b.connector);
  for (const n of named) {
    const hit = [...installed].some((i) => i.includes(String(n).toLowerCase()) || String(n).toLowerCase().includes(i));
    (hit ? ok : warn).push(hit ? `connector reachable: ${n}` : `connector named but not found in your runner: ${n}`);
  }
  report(ok, warn, bad);
}

function report(ok, warn, bad) {
  for (const b of bad) console.log('  FAIL ' + b);
  for (const w of warn) console.log('  WARN ' + w);
  for (const o of ok) console.log('  ok   ' + o);
  console.log(`\n${ok.length} ok, ${warn.length} warning(s), ${bad.length} failure(s)`);
}

if (require.main === module) main();
module.exports = { hasGeminiKey };
