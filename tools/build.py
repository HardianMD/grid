"""Build the site: python3 tools/build.py [--min] OUT_DIR

Joins app/style.css, app/page.html and app/js/*.js (in name order, inside one function) into a full HTML document as
OUT_DIR/index.html, stamped with the build time (shown in Settings), and copies the icons, manifest and offline
helper (sw.js, stamped too) from site/. The word list is split by letter count into OUT_DIR/words/N.txt, so the solvers
read only the lengths they need. The page holds no puzzles: it loads them from Firestore after Google sign-in. --min (used when publishing)
shrinks the styles and script with esbuild, pinned below and fetched by npx."""
import pathlib, re, shutil, subprocess, sys, unicodedata
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
HEAD = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex, nofollow, noarchive"><title>Crosswords</title>'
        '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png"><link rel="icon" type="image/png" href="favicon.png">'
        '<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png"><link rel="manifest" href="manifest.webmanifest">'
        '<meta name="apple-mobile-web-app-title" content="Crosswords"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="theme-color" content="#1f7a33"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        # The font loads without holding up the page (and the sign-in it starts): text shows in a system font until then.
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;600;800&display=swap" media="print" onload="this.media=\'all\'">'
        '</head><body>\n')

MIN = "--min" in sys.argv


def shrink(text, loader):
    if not MIN:
        return text
    return subprocess.run(["npx", "--yes", "esbuild@0.24.0", "--minify", "--loader=" + loader], input=text,
                          capture_output=True, text=True, check=True).stdout


out = pathlib.Path(sys.argv[-1])
app = ROOT / "app"
js = "".join(f.read_text() for f in sorted((app / "js").glob("*.js")))
page = ("\n<style>\n" + shrink((app / "style.css").read_text(), "css") + "</style>\n" + (app / "page.html").read_text() +
        "<script>\n" + shrink('(function () {\n  "use strict";\n' + js + "})();\n", "js") + "</script>\n")
stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
page = page.replace("__BUILT__", stamp, 1)
out.mkdir(parents=True, exist_ok=True)
for f in (ROOT / "site").iterdir():
    if f.name == "sw.js":
        (out / f.name).write_text(f.read_text().replace("__BUILT__", stamp))
    elif f.name != "words.txt":
        shutil.copy(f, out / f.name)
# Entries by letter count, as the app's plain() counts them, each list keeping the common-to-rare order.
lens = {}
for w in (ROOT / "site" / "words.txt").read_text().splitlines():
    n = len(re.sub("[^A-Za-z]", "", unicodedata.normalize("NFD", w)))
    if n:
        lens.setdefault(n, []).append(w)
(out / "words").mkdir(exist_ok=True)
for n, ws in lens.items():
    (out / "words" / f"{n}.txt").write_text("\n".join(ws) + "\n")
(out / "index.html").write_text(HEAD + page + "</body></html>\n")
print("->", out / "index.html")
