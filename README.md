# Grid

Private crossword app, requiring sign in with Google. Puzzles and progress live in Firestore; this repo holds only the
page. Live at https://hardianmd.github.io/grid/ (Pages publishes every push to `main`).

## Files
- `app/style.css`, `app/page.html`, `app/js/*.js`: the page's styles, markup and vanilla JS (no dependencies). The JS
  files share one scope: the build joins them in name order inside one function.
- `tools/build.py OUT`: joins them into `OUT/index.html` under the page head (the font loads in the background, so it
  never holds up sign-in) and copies `site/` (icons, manifest, word list).
- `tools/check.js`: checks that the finish bar and Stats read every kind of saved record (old ones included) the same
  way (`helpOf`, `helpText`). Runs on each pull request (`check.yml`) and before each publish (`pages.yml`).
- `site/words.txt`: the UKACD18 word list (licence in `site/words-licence.txt`) for the anagram solver and word finder.

## Map of `app/js`
Search for the function name; the comment above each says what it does.
- Storage and sync: `store` (localStorage, then `cloudPut` to Firestore `users/{uid}/state`), `cloudListen` (merge by
  `at`, `rank`), `KEEP` (synced records besides puzzles: `mode`, `favs`, `prefs`, `notes`).
- Speed: `store.peek` (a record for reading only, parsed again only when it changes), `pc` (facts worked out once per
  copy of a puzzle: `solOf`, `jsonOf`, `linksFor`, clue starts, Quickfire clues), `progressOf` (kept per record),
  `fmtDate` and `cmp` (date formats and text order, each made once).
- Sign-in and data: `fbInit` (Firebase compat SDK from gstatic, puzzles read incrementally by `u`), `gotPuzzles`,
  `showStatus` (update problems, refresh spinner), `runUpdate`/`dispatch` (starts the updater with the saved key).
- Modes: comment block above `RANK`; `setMode`, `lastMode`, `prefs`/`setPref`.
- Solving: `load` (grid numbering, linked clues, saved record), `build`, `size`, `render`, `typeLetter`, `del`,
  `check`/`checkWords`, `grade`/`submit` (Hard and Champ), `save` (record format), `blank`.
- Hints and parsings: `nextAction`, the `hintBtn` and `hintYes` handlers (one pop-up, `askMode`), `showParse`,
  `openEditor` (definition picker, clue type chips, mark-up bar `MARKS`).
- Tools: anagram wheel (`wheelOpen` … `wheelKey`, `solveAnagram`, `combos`), word finder (`findBtn`), dictionary
  (`lookup`, `DICTS`).
- Home: `showHome` (two weeks at a time, `FROM`), filters (`FILT`), Favourites (`showFavs`, `answerOf`), Stats
  (`showStats`, `helpOf`), bell (`checkSubs`, `markOf`, `notes`), Settings (`showSettings`, `applyPrefs`).
- Quickfire: `qfPool` (clues from finished puzzles, with `rawAnswer` and `qfTypes`), `qfNext` (loads one clue as a one-row
  puzzle, `P.qf`: Easy tools, nothing saved), the clue-type filter (`crossword:qf`, this device only).
- Difficulty scores (`p.nitch`, added by the updater): `ncol`, `ngrade`, `mineOf` (personal score), `showNitch` (finish bar
  pill and results sheet with `ncurve`), `nitchTable` (Stats).

## Rules
- No paper, blog or source names anywhere here (code, README, commits, PR text): display names arrive as data
  (`publication`, `badge`, `blog_name`, `blog_search`) after sign-in.
- Answers ship XOR-scrambled with the puzzle id (`unscramble`); keep them out of anything readable.
- To test a change without signing in, see the updater repo's `tools/apptest.js` (before/after comparison).
