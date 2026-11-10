# Handover

Current state of the app and recent changes, newest first. Last updated 10 Nov 2026. Source-specific notes live in the
private updater repo.

## Recent changes
- 10 Nov: part-done parsings (a note, definitions or indicators, no wordplay yet) are saved with their tree and shown
  again (`partEdit`); a blog parsing, when there is one, still gives the type and tiles. One saved before the blog had
  parsed the clue carries `wait`, and the bell says when the blog's parsing arrives (`res: "part"`, via the head's `qc`) (#197).
- 3 Nov: two-tap buttons (`sure()`: Delete, Unpublish, Sign out, Replace) disarm on the confirming tap (#194).
- 3 Nov: Palindrome step on a piece (#193, tree node `pal {of}`) and a markable palindrome indicator (#192, kept as the
  parsing's loose `ind`). `tMarks` no longer writes clue offsets into saved trees; old records keep stray `"37":0`
  keys, harmless.
- 3 Nov: rebus clues (#190, #191): tree node `rebus {of, a, t}`; in the editor select the clue words, Rebus…, parse the
  answer's words (`PE.rb`), then "Done: back to the clue".
- Late Oct: Parse all in the desktop clue list (#185, #186), spoonerisms by sound (#182, #184), guided editor steps
  (#179), Favourites tiles (#178, #181).
- 28 Oct: parse editor redesign (#150): tap words (or letters in Letters mode), say what they are; tiles build as pieces
  are added; toggles for Double definition, Cryptic definition, &lit, Palindrome; a Notes box (`note`). "Use original"
  sets the solver's parsing aside (`off`, defs in `off.defs`); Quickfire and lists ignore `off` records.
- 28 Oct: fill log `lg` (`logFill`, `logOf`), Heat on the finish bar (#146) and solve replay (#148, `RP`: nothing saves
  while it plays). Structured parsings in the parse view (#144, #145, #147).
- 26 Oct: clue bank in Create (#139), prize entries by email (#125) and by post (#127).
- 23 Oct: page split into `app/style.css`, `app/page.html`, `app/js/NN-*.js`, with a shrunk build (#90 to #94).

## Parse editor details worth knowing
- Pieces store where they were tapped: `c` (clue offset) and `x` (letters within), so the view tints the right
  occurrence; definitions carry a run number per word (`data-d`) so side-by-side double definitions stay two.
- A reversal indicator can cover several pieces: `s.rv = [{i, p: [...]}]`; indicator kinds saved as `s.it`. A Stands
  for piece can drop letters: `o: "del"` with `f` (full) and `d` (dropped indices).

## Ideas parked by the owner
Ghost races against a recorded solve; saving a puzzle's clue into the clue bank; sharing the app with friends.
