"""Build the site: python3 tools/build.py OUT_DIR

Joins app/style.css, app/page.html and app/js/*.js (in name order, inside one function) into a full HTML document as
OUT_DIR/index.html, stamped with the build time (shown in Settings), and copies the icons, manifest and word list from
site/. The page holds no puzzles: it loads them from Firestore after Google sign-in."""
import pathlib, shutil, sys
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

out = pathlib.Path(sys.argv[1])
app = ROOT / "app"
js = "".join(f.read_text() for f in sorted((app / "js").glob("*.js")))
page = ("\n<style>\n" + (app / "style.css").read_text() + "</style>\n" + (app / "page.html").read_text() +
        '<script>\n(function () {\n  "use strict";\n' + js + "})();\n</script>\n")
page = page.replace("__BUILT__", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), 1)
out.mkdir(parents=True, exist_ok=True)
for f in (ROOT / "site").iterdir():
    shutil.copy(f, out / f.name)
(out / "index.html").write_text(HEAD + page + "</body></html>\n")
print("->", out / "index.html")
