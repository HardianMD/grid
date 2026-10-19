"""Build the site: python3 tools/build.py OUT_DIR

Wraps app/template.html in a full HTML document as OUT_DIR/index.html and copies the icons, manifest and word list
from site/. The page holds no puzzles: it loads them from Firestore after Google sign-in."""
import pathlib, re, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HEAD = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex, nofollow, noarchive"><title>Crosswords</title>'
        '<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png"><link rel="icon" type="image/png" href="favicon.png">'
        '<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png"><link rel="manifest" href="manifest.webmanifest">'
        '<meta name="apple-mobile-web-app-title" content="Crosswords"><meta name="theme-color" content="#1f7a33"></head><body>\n')

out = pathlib.Path(sys.argv[1])
page = re.sub(r"<title>.*?</title>", "", (ROOT / "app" / "template.html").read_text(), count=1)  # the title is in HEAD
out.mkdir(parents=True, exist_ok=True)
for f in (ROOT / "site").iterdir():
    shutil.copy(f, out / f.name)
(out / "index.html").write_text(HEAD + page + "</body></html>\n")
print("->", out / "index.html")
