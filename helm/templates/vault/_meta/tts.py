#!/usr/bin/env python3
"""
tts.py - sanctioned TTS path for the audio brief.

WHY THIS EXISTS (2026-08-26): the @rlabs-inc/gemini-mcp server exposes NO speech
tool, so the workflow's old instruction to load `gemini-speak` always failed and
the audio subagent fell back to grepping config files for the Gemini key and
firing raw HTTP with the key inline in a scratch script - which then landed the
key in that subagent's transcript. This script is the intended mechanism instead:
it reads the key ONCE, at runtime, from ONE known location, never prints it, and
never lets an LLM subagent see or handle it. The audio stage just calls this by
name with a text file and a voice.

Key source order (first hit wins):
  1. env GEMINI_TTS_KEY
  2. ~/.claude/.gemini-tts-key       (mode-600 file, if present)
  3. ~/.claude.json -> mcpServers.gemini.env.GEMINI_API_KEY  (exact path, no grep)

Usage:
  python3 tts.py --text SCRIPT.txt --voice Charon --out /path/out.m4a \
                    [--prompt "relaxed podcast host, medium pace"]

Output: writes the m4a to --out via the macOS built-in `afconvert` (ffmpeg is not
installed). Exits 0 on success; nonzero with a reason on stderr on failure.
The caller must fail-soft: if this exits nonzero, skip audio, keep the text brief.
"""
import argparse, base64, json, os, struct, subprocess, sys, tempfile, urllib.request, urllib.error

MODEL = "gemini-2.5-flash-preview-tts"
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % MODEL
SAMPLE_RATE = 24000        # Gemini TTS returns 24kHz mono s16le PCM
CHUNK_CHARS = 2600         # keep each TTS call well under model limits


def log(msg):
    sys.stderr.write(msg.rstrip() + "\n")


def load_key():
    k = os.environ.get("GEMINI_TTS_KEY", "").strip()
    if k:
        return k
    keyfile = os.path.expanduser("~/.claude/.gemini-tts-key")
    if os.path.exists(keyfile):
        with open(keyfile) as f:
            k = f.read().strip()
        if k:
            return k
    cfgpath = os.path.expanduser("~/.claude.json")
    try:
        with open(cfgpath) as f:
            cfg = json.load(f)
        k = cfg["mcpServers"]["gemini"]["env"]["GEMINI_API_KEY"].strip()
        if k:
            return k
    except (OSError, KeyError, ValueError):
        pass
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    if k:
        return k
    log("no Gemini key found. Set GEMINI_TTS_KEY or GEMINI_API_KEY in your environment, "
        "or put it in ~/.claude/.gemini-tts-key. Audio is skipped; the text brief still runs.")
    sys.exit(2)


def split_text(text, limit=CHUNK_CHARS):
    """Split on paragraph then sentence boundaries so no chunk exceeds `limit`."""
    text = text.strip()
    if len(text) <= limit:
        return [text]
    chunks, cur = [], ""
    for para in text.split("\n\n"):
        para = para.strip()
        if not para:
            continue
        if len(cur) + len(para) + 2 <= limit:
            cur = (cur + "\n\n" + para).strip()
            continue
        if cur:
            chunks.append(cur)
            cur = ""
        if len(para) <= limit:
            cur = para
            continue
        # paragraph alone too long: break on sentences
        sent, buf = "", ""
        for tok in para.replace("? ", "?\n").replace(". ", ".\n").replace("! ", "!\n").split("\n"):
            if len(buf) + len(tok) + 1 <= limit:
                buf = (buf + " " + tok).strip()
            else:
                if buf:
                    chunks.append(buf)
                buf = tok
        if buf:
            cur = buf
    if cur:
        chunks.append(cur)
    return chunks


def tts_chunk(key, text, voice, prompt):
    full = (prompt + "\n\n" + text) if prompt else text
    body = {
        "contents": [{"parts": [{"text": full}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    req = urllib.request.Request(
        ENDPOINT + "?key=" + key,
        json.dumps(body).encode(),
        {"Content-Type": "application/json"},
    )
    try:
        resp = json.load(urllib.request.urlopen(req, timeout=600))
    except urllib.error.HTTPError as e:
        # redact: never surface the URL (carries the key) - only the status + body
        detail = e.read()[:600].decode("utf-8", "replace")
        raise RuntimeError("gemini TTS HTTP %s: %s" % (e.code, detail))
    return base64.b64decode(
        resp["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
    )


def write_wav(pcm, path):
    ch, bits, sr = 1, 16, SAMPLE_RATE
    hdr = (
        b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, ch, sr, sr * ch * bits // 8, ch * bits // 8, bits)
        + b"data" + struct.pack("<I", len(pcm))
    )
    with open(path, "wb") as f:
        f.write(hdr + pcm)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True, help="path to the plain-text script")
    ap.add_argument("--out", required=True, help="output .m4a path")
    ap.add_argument("--voice", default="Charon")
    ap.add_argument("--prompt", default="Read this as a relaxed podcast host talking to a friend about their day. Medium pace, natural pauses, conversational, not a news reader.")
    args = ap.parse_args()

    with open(args.text) as f:
        text = f.read()
    if not text.strip():
        log("empty script"); sys.exit(2)

    try:
        key = load_key()
    except Exception as e:
        log("could not load Gemini key from any sanctioned source: %s" % e); sys.exit(3)

    chunks = split_text(text)
    log("tts: %d chunk(s), voice %s" % (len(chunks), args.voice))
    pcm = b""
    for i, c in enumerate(chunks, 1):
        try:
            pcm += tts_chunk(key, c, args.voice, args.prompt)
            log("  chunk %d/%d ok" % (i, len(chunks)))
        except Exception as e:
            log("  chunk %d/%d FAILED: %s" % (i, len(chunks), e)); sys.exit(4)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        wav = tf.name
    try:
        write_wav(pcm, wav)
        r = subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", wav, args.out],
            capture_output=True, text=True,
        )
        if r.returncode != 0:
            log("afconvert failed: " + r.stderr[:400]); sys.exit(5)
    finally:
        try:
            os.unlink(wav)
        except OSError:
            pass
    log("wrote " + args.out)
    print(args.out)


if __name__ == "__main__":
    main()
