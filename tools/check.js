// Checks how saved records are read for the finish bar and Stats: node tools/check.js
// Pulls the shared helpers out of app/js and runs them on every kind of record the app has saved.
const fs = require("fs"), vm = require("vm"), dir = __dirname + "/../app/js/";
const src = fs.readdirSync(dir).sort().map((f) => fs.readFileSync(dir + f, "utf8")).join("");
function grab(name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error("missing " + name);
  let d = 0, j = src.indexOf("{", i);
  for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && !--d) break; }
  return src.slice(i, j + 1);
}
const ctx = {};
vm.runInNewContext(src.match(/var RANK = [^;]+;/)[0] + ["plural", "helpOf", "helpText"].map(grab).join("\n") +
  "; this.helpOf = helpOf; this.helpText = helpText; this.MODES = MODES;", ctx);

// [what, record, mode letter, hints, reveals shown, DNF, finish bar help line]
const CASES = [
  ["Easy, hints and a reveal", { used: 0, mode: "easy", hn: 2, rev: true, revw: { a1: 1 } }, "easy", 2, "1", false, "2 hints and 1 reveal"],
  ["Medium, a reveal", { used: 1, mode: "medium", hn: 0, rev: true, revw: { a1: [0, 2] } }, "medium", 0, "1", true, "0 hints and 1 reveal"],
  ["Medium, no help", { used: 1, mode: "medium", hn: 0, rev: false, revw: {} }, "medium", 0, "0", false, "0 hints and 0 reveals"],
  ["Hard, submitted right", { used: 2, mode: "hard", hn: 0, sub: { res: "ok" } }, "hard", 0, "0", false, ""],
  ["Hard, gave up", { used: 2, mode: "hard", hn: 0, sub: { res: "dnf" } }, "hard", 0, "0", true, ""],
  ["Champ, answers not out", { used: 4, mode: "champ", sub: { res: "" } }, "champ", 0, "0", false, ""],
  ["Easy then Hard after a hint", { used: 0, mode: "hard", hn: 1 }, "easy", 1, "0", false, "1 hint and 0 reveals"],
  ["old Easy, hint levels only", { mode: "easy", hints: { a1: 2, d3: 1 } }, "easy", 3, "0", false, "3 hints and 0 reveals"],
  ["old Easy, hint list", { mode: "easy", hints: ["a1", "d3"] }, "easy", 2, "0", false, "2 hints and 0 reveals"],
  ["old Medium, reveal flag only", { used: -1, mode: "medium", rev: true }, "medium", 0, "reveals", true, "0 hints and reveals"],
  ["old Hard, reveal flag only", { mode: "hard", rev: true }, "hard", 0, "reveals", true, ""],
];
let bad = 0;
for (const [what, rec, mode, hn, rv, dnf, text] of CASES) {
  const g = ctx.helpOf(rec), got = [ctx.MODES[g.u], g.hn, g.rv ? String(g.rv) : g.rf ? "reveals" : "0", g.dnf, ctx.helpText(g)];
  const want = [mode, hn, rv, dnf, text];
  if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.log("FAIL " + what + "\n  want " + JSON.stringify(want) + "\n  got  " + JSON.stringify(got)); }
}
console.log(bad ? bad + " of " + CASES.length + " failed" : "all " + CASES.length + " records read the same way");
// The parsing tree: the same cases as crossword-data's tools/tree.py (tools/tree-cases.json is a copy of its file).
const tree = {};
vm.runInNewContext(fs.readFileSync(dir + "17-tree.js", "utf8") + fs.readFileSync(dir + "20-ind.js", "utf8") + "; this.tCheck = tCheck; this.tFit = tFit; this.tUnits = tUnits; this.tLetters = tLetters; this.tValid = tValid; this.tFromFlat = tFromFlat;", tree);
const canon = (o) => JSON.stringify(o, (k, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => ((a[x] = v[x]), a), {}) : v);
const TC = JSON.parse(fs.readFileSync(__dirname + "/tree-cases.json", "utf8"));
let tbad = 0;
for (const c of TC) {
  if (c.flat && canon(tree.tFromFlat(c.flat, c.clue, c.answer)) !== canon(c.parse)) { tbad++; console.log("FAIL tree " + c.name + ": a different tree from the flat structure"); }
  const t = c.parse.t, v = tree.tCheck(c.parse, c.clue, c.answer), pieces = t ? tree.tFit(t, tree.tLetters(c.answer), c.clue, tree.tUnits(t)) : null;
  if (v !== c.v || (c.pieces && JSON.stringify(pieces) !== JSON.stringify(c.pieces)) || (t && tree.tValid(t).length)) { tbad++; console.log("FAIL tree " + c.name + ": v " + v + " (want " + c.v + "), pieces " + JSON.stringify(pieces)); }
}
bad += tbad;
console.log(tbad ? tbad + " of " + TC.length + " tree cases failed" : "all " + TC.length + " tree cases check the same way");
// The files share one scope (tools/build.py), so a second function of the same name silently replaces the first.
const seen = {};
for (const m of src.matchAll(/^  function ([A-Za-z_$][\w$]*)\(/gm)) { if (seen[m[1]]) { bad++; console.log("FAIL two functions named " + m[1]); } seen[m[1]] = 1; }
process.exit(bad ? 1 : 0);
