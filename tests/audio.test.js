'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TTS = path.resolve(__dirname, '..', 'helm/templates/vault/_meta/tts.py');

test('tts.py fails soft with a clear message when no Gemini key is set', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-tts-'));
  const txt = path.join(tmp, 'script.txt');
  fs.writeFileSync(txt, 'hello world');
  // clean HOME so ~/.claude.json is not found, and no key env vars
  const env = { ...process.env, HOME: tmp };
  delete env.GEMINI_TTS_KEY;
  delete env.GEMINI_API_KEY;
  let code = 0, stderr = '';
  try {
    execFileSync('python3', [TTS, '--text', txt, '--voice', 'Charon', '--out', path.join(tmp, 'out.m4a')],
      { env, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    code = e.status; stderr = (e.stderr || '').toString();
  }
  assert.notStrictEqual(code, 0, 'exits nonzero without a key');
  assert.match(stderr, /Gemini key/i, 'says a key is missing');
});
