# Working on this repo (Claude)

Read this first, then `HANDOFF.md`, then `README.md` (map of `app/js`) and only the file you need. Fuller notes,
including the updater, its sources and their gotchas, are in the private updater repo `HardianMD/crossword-data`
(`CLAUDE.md`, `HANDOFF.md`, `README.md`).

## The project
A personal cryptic crossword app for the owner's iPhone (Home Screen) and desktop browser, live at
https://hardianmd.github.io/grid/. This public repo holds only the page. Puzzles, run status and progress live in
Firestore (project `crossword-d83c8`), written by the private updater and read after Google sign-in.
`HardianMD/crossword` is retired: never touch it.

## Rules from the owner
- **This repo is public and stays discreet**: no paper, blog or source names anywhere (code, comments, docs, commit
  messages, branch names, PR titles and descriptions). Display names arrive only as Firestore data.
- Answers ship scrambled (`unscramble`); keep them out of anything readable. Never show puzzle answers in chat: refer to
  clues by puzzle and number.
- Never expose the owner's username, email or passwords.
- Merge your own PRs once tested; don't wait for the owner.
- "Don't change anything / just explore / report back" means make no changes.
- No AI in the app. Vanilla JS, no dependencies; keep it lean. Everything stays free (GitHub Pages, Firebase Spark).

## Build, test, deploy
- `python3 tools/build.py [--min] OUT` builds the page into `OUT/index.html`.
- `node tools/check.js`: the CI check (`check.yml` on PRs, and before each publish). It also fails on duplicate
  function names, since all `app/js` files share one scope, and runs the parsing tree cases.
- Before/after app test with no sign-in: build old and new into two folders, then in the updater repo run
  `node tools/apptest.js OLD_DIR NEW_DIR` (a few minutes). A clean-up must report no differences; for a feature, read the
  differences it lists, and add steps there when a feature lands.
- Deploy: merging to main runs `pages.yml` (check, `build.py --min`, GitHub Pages). Fallback to the pre-rebuild app:
  branch `pre-rebuild`.
- Shared with the updater repo, change both together: `tools/tree-cases.json`, the tree checker (`app/js/17-tree.js`),
  abbreviations (`app/js/16-abbr.js` is a copy of the updater's canonical list).
- From a Claude cloud container, `gh` is not logged in (use the GitHub MCP tools) and the container's network filter
  blocks hardianmd.github.io; check the live site from a workflow or trust the Pages run.

## Keeping the handover current
After a change worth knowing about, add a dated line to `HANDOFF.md` (newest first, PR numbers) and trim what the code
or README now explain. Anything that names a source goes in the updater repo's `HANDOFF.md` instead.
