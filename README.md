# Grid

Private crossword app, requiring sign in with Google. Puzzles and progress live in Firestore; this repo holds only the
page. 

## Files
- `app/style.css`, `app/page.html`, `app/js/*.js`: the page's styles, markup and vanilla JS (no dependencies). The JS
  files share one scope: the build joins them in name order inside one function.
- `tools/build.py [--min] OUT`: joins them into `OUT/index.html` under the page head (the font loads in the background,
  so it never holds up sign-in) and copies `site/` (icons, manifest, offline helper, word list). Publishing uses `--min`, which shrinks
  the styles and script with esbuild (pinned in `build.py`, fetched by npx); the app test checks the two builds match.
- `tools/check.js`: checks that the finish bar and Stats read every kind of saved record (old ones included) the same
  way (`helpOf`, `helpText`). Runs on each pull request (`check.yml`) and before each publish (`pages.yml`).
- `site/words.txt`: the UKACD18 word list (licence in `site/words-licence.txt`) for the anagram solver and word finder;
  the build splits it by letter count into `words/N.txt`, and the app reads only the lengths it needs.
- `site/sw.js`: keeps the page, the Firebase SDK, the font and fetched word lists so the app opens with no signal
  (the page from the network when it answers within 3 seconds); a new build drops the old copies.

## Map of `app/js`
Search for the function name; the comment above each says what it does.
- Storage and sync: `store` (localStorage, then `cloudPut` to Firestore `users/{uid}/state`; finished puzzles' records
  leave localStorage once synced and live in memory, read from Firestore's offline copy at sign-in: `shed`, `cloudMemo`), `cloudListen` (merge by
  `at`, `rank`), `KEEP` (synced records besides puzzles: `mode`, `favs`, `prefs`, `notes`).
- Speed: `store.peek` (a record for reading only, parsed again only when it changes), `pc` (facts worked out once per
  copy of a puzzle: `solOf`, `jsonOf`, `linksFor`, clue starts, Quickfire clues), `progressOf` (kept per record),
  `fmtDate` and `cmp` (date formats and text order, each made once).
- Sign-in and data: `fbInit` (Firebase compat SDK from gstatic; puzzle heads from `meta/h_<id>`, read incrementally by
  `u`, are all `PUZZLES` holds), `full` (a whole puzzle from `puzzles/<id>`, read when opened, for Favourites and
  each Quickfire clue), `gotPuzzles`,
  `showStatus` (update problems, refresh spinner), `runUpdate`/`dispatch` (starts the updater with the saved key).
- Modes: comment block above `RANK`; `setMode`, `lastMode`, `prefs`/`setPref`.
- Elements: `mk(tag, class, text)` builds one.
- Solving: `load` (grid numbering, linked clues, saved record), `build`, `size`, `render`, `typeLetter`, `del`, `put`,
  `check`/`checkWords`, `grade`/`submit` (Hard and Champ), `save` (record format), `blank`, the `mailBtn` and `postBtn` handlers (a full grid as a prize entry while `P.entry.by` is not past: emailed to `P.entry.to`, or an A4 PDF to post to `P.entry.post` with the sender's details from Settings, kept on this device as `crossword:post`; `entryAnswers`, `pdfDoc`, `giveFile`).
- Hints and parsings: `nextAction`, the `hintBtn` and `hintYes` handlers (one pop-up, `askMode`), `showParse`,
  `openEditor` (definition picker, clue type chips, mark-up bar `MARKS`).
- Tools: anagram wheel (`wheelOpen` … `wheelKey`, `solveAnagram`, `combos`), word finder (`findBtn`, its own button unless Settings switch it off; `partWords` for each word of a longer answer), dictionary
  (`lookup`, `DICTS`).
- Home: `showHome` (two weeks at a time, `FROM`), filters (`FILT`), Favourites (`showFavs`, `answerOf`), Stats
  (`showStats`, `helpOf`), bell (`checkSubs`, `markOf`, `notes`), Settings (`showSettings`, `applyPrefs`).
- Quickfire: `qfPool` (clues from finished puzzles' heads, `h.qc`, with `qfTypes`; `qfLoad` reads the clue's puzzle), `qfNext` (loads one clue as a one-row
  puzzle, `P.qf`: Easy tools, nothing saved), the clue-type filter (`crossword:qf`, this device only).
- Create (`14-create.js`): the solver's own puzzles as drafts in Firestore `users/{uid}/made/<id>` (`MADE`, `madeSave`,
  `madeFlush`), the Create tab (`showMade`), the grid library (`gridPick`: starting points, `genGrid` lattice grids, every
  15x15 layout in the puzzles; `gridCheck` for the usual grid rules), and the editor, which plays a draft as a puzzle
  (`edPuzzle`, `P.ed`: Squares, Break, the clue sheet `edClue` with linked answers and Parsing, details `edMenu` with Add
  to puzzles). An added draft is built into a puzzle in the shared format (`madePuzzle`, `p.made`, with `qc` for
  Quickfire) and joins `PUZZLES` beside the shared ones (`SHARED`, `mergeMade`); `full` returns it as it is. Filters can
  hide created puzzles (`FILT.made`); `puzFile` exports a draft as Across Lite .puz; a puzzle's note shows from the i button (`infoBtn`). `slotsOf` numbers any grid.
- Difficulty scores (`p.nitch`, added by the updater): `ncol`, `ngrade`, `mineOf` (personal score), `showNitch` (finish bar
  pill and results sheet with `ncurve`), `ntiles` (Stats).

## Rules
- No paper, blog or source names anywhere here (code, README, commits, PR text): display names arrive as data
  (`publication`, `badge`, `blog_name`, `blog_search`) after sign-in.
- Answers ship XOR-scrambled with the puzzle id (`unscramble`); keep them out of anything readable.
- To test a change without signing in, see the updater repo's `tools/apptest.js` (before/after comparison).
