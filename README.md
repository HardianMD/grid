# Grid

Private app, requiring sign in with Google. Data lives in Firestore.

- `app/template.html`: the whole page (vanilla JS, no build step).
- `tools/build.py OUT`: wraps the template into `OUT/index.html` and copies the icons, manifest and word list from `site/`.
- `tools/check.js`: checks that the finish bar and Stats read every kind of saved record (old ones included) the same way. Runs on each pull request and before each publish.
- `.github/workflows/pages.yml`: builds and publishes on every push to `main`.
- `site/words.txt`: the UKACD18 word list (licence in `site/words-licence.txt`) for the anagram solver.


