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
process.exit(bad ? 1 : 0);
