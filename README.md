# Crosswords

A crossword solving page for phones, published with GitHub Pages. It shows nothing until you sign in with Google;
the puzzles, and the progress sync, live in the owner's Firestore database, which only their account can read.

- `app/template.html`: the whole page (vanilla JS, no build step).
- `tools/build.py OUT`: wraps the template into `OUT/index.html` and copies the icons, manifest and word list from `site/`.
- `.github/workflows/pages.yml`: builds and publishes on every push to `main`.
- `site/words.txt`: the UKACD18 word list (licence in `site/words-licence.txt`) for the anagram solver.

The Firebase web key in the page is public by design; Firestore's rules are what protect the data.
