# Crosswords

A crossword app, requiring sign in with Google. Data lives in Firestore.

- `app/template.html`: the whole page (vanilla JS, no build step).
- `tools/build.py OUT`: wraps the template into `OUT/index.html` and copies the icons, manifest and word list from `site/`.
- `.github/workflows/pages.yml`: builds and publishes on every push to `main`.
- `site/words.txt`: the UKACD18 word list (licence in `site/words-licence.txt`) for the anagram solver.


