#!/usr/bin/env python3
"""Rebuild _audio/player.html from the latest brief MP3.
Usage: build-audio-player.py <mp3-path> <MORNING|EVENING> [--rows "Name|note;Name|note;..."] [--dek "one-liner"]
Fills _meta/audio-player-template.html placeholders and writes _audio/player.html.
The EA workflow then republishes that file to the standing artifact URL.
"""
import base64, html, os, sys, datetime

VAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL   = os.path.join(VAULT, "_meta", "audio-player-template.html")
OUT   = os.path.join(VAULT, "_audio", "player.html")

def main():
    mp3 = sys.argv[1]
    mode = sys.argv[2].upper()
    rows_arg, dek = "", ""
    args = sys.argv[3:]
    while args:
        a = args.pop(0)
        if a == "--rows": rows_arg = args.pop(0)
        elif a == "--dek": dek = args.pop(0)

    base = os.path.basename(mp3)                      # 2026-08-25-evening.mp3
    key  = os.path.splitext(base)[0]
    d = datetime.date.fromisoformat(base[:10])
    stamp_date = d.strftime("%a %d %b %Y")
    title = "Morning brief" if mode == "MORNING" else "Evening brief"
    tod   = "7:45am" if mode == "MORNING" else "7:45pm"
    if not dek:
        dek = "Narrated end to end."

    rows_html = ""
    for pair in [p for p in rows_arg.split(";") if p.strip()]:
        name, _, note = pair.partition("|")
        rows_html += ('    <div class="row"><span class="row-name">%s</span>'
                      '<span class="row-note">%s</span></div>\n'
                      % (html.escape(name.strip()), html.escape(note.strip())))
    if not rows_html:
        rows_html = ('    <div class="row"><span class="row-name">Full brief</span>'
                     '<span class="row-note">see chat</span></div>\n')

    b64 = base64.b64encode(open(mp3, "rb").read()).decode("ascii")
    mime = {"mp3": "audio/mpeg", "m4a": "audio/mp4", "wav": "audio/wav"}.get(
        os.path.splitext(base)[1].lstrip(".").lower(), "audio/mpeg")
    t = open(TPL, encoding="utf-8").read()
    t = t.replace("data:audio/mpeg;base64,", "data:%s;base64," % mime)
    for k, v in {
        "__STAMP__":    "%s, %s" % (stamp_date, tod),
        "__TITLE__":    title,
        "__TITLE_JS__": title.replace("'", ""),
        "__ALBUM_JS__": stamp_date,
        "__DEK__":      html.escape(dek),
        "__KEY__":      key,
        "__FILE__":     base,
        "__ROWS__":     rows_html.rstrip(),
        "__AUDIO_B64__": b64,
    }.items():
        t = t.replace(k, v)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write(t)
    print("wrote %s (%.2f MB)" % (OUT, os.path.getsize(OUT) / 1048576))

if __name__ == "__main__":
    main()
