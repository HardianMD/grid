  // Parsed types mapped onto the editor's list; anything else is left out of the filter.
  function qfTypes(x) {
    var out = [];
    ctype(x && x.type).replace(/\band lit\b/ig, "&lit").split(/\s*(?:,|\+|\band\b|\bwith\b)\s*/i).forEach(function (t) {
      t = TYPES.filter(function (y) { return y.toLowerCase() === t.toLowerCase(); })[0];
      if (t && out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }
  // A finished puzzle's clues are worked out again only when the puzzle or its record changes.
  function qfPool() {
    var out = [];
    PUZZLES.forEach(function (p) {
      if (!/^(Solved|DNF)$/.test(statusOf(p))) return;
      var s = store.peek("crossword:" + p.id) || {}, c = pc(p);
      if (!c.qf || c.qf.s !== s) c.qf = { s: s, list: qfClues(p, s) };
      out.push.apply(out, c.qf.list);
    });
    return out;
  }
  function qfClues(p, s) {
    var out = [], mine = s.parses || {}, blog = jsonOf(p, "parses") || {}, tails = {};
    linksFor(p).forEach(function (g) { g.slice(1).forEach(function (k) { tails[k] = 1; }); });
    ["a", "d"].forEach(function (dir) {
      var list = p[dir === "a" ? "across" : "down"] || {};
      Object.keys(list).forEach(function (num) {
        var k = dir + num, a = !tails[k] && rawAnswer(p, k, s), clue = joinEnum(list[num]), m = clue.match(/\(([\d,\-\s]+)\)\s*$/);
        // Only clues whose enumeration matches a fully known answer.
        if (!a || !/^[A-Z]+$/.test(a) || !m || m[1].split(/[,\-\s]+/).reduce(function (n, x) { return n + (+x || 0); }, 0) !== a.length) return;
        var b = blog[dir] && blog[dir][num], x = mine[k] || b;
        out.push({ p: p, k: k, clue: clue, a: a, blog: b, mine: mine[k], t: qfTypes(x) });
      });
    });
    return out;
  }
  function qfPick() { return (store.get("crossword:qf") || {}).types || []; }
  function qfMatch() {
    var pick = qfPick();
    return QF.pool.filter(function (c) { return !pick.length || c.t.some(function (t) { return pick.indexOf(t) >= 0; }); });
  }
  function openQuickfire() {
    QF = { pool: qfPool(), seen: [], at: -1 };
    if (!QF.pool.length) return toast("Finish a puzzle first: Quickfire uses clues from your finished puzzles");
    showList(false); $("home").hidden = true; TAB = ""; qfHead(true);
    qfNext();
  }
  // › moves on (back through any clues ‹ stepped over, then a new one); ‹ goes back to the clues seen before.
  function qfNext() {
    if (QF.at < QF.seen.length - 1) return qfShow(QF.seen[++QF.at]);
    var pool = qfMatch().filter(function (c) { return c !== QF.c; });
    if (!pool.length) pool = qfMatch();
    if (!pool.length) return toast("No clues of these types yet");
    QF.at = QF.seen.push(pool[Math.floor(Math.random() * pool.length)]) - 1;
    qfShow(QF.seen[QF.at]);
  }
  function qfShow(c) {
    QF.c = c; $("qfPrev").disabled = !QF.at;
    var dir = c.k[0], num = c.k.slice(1), d = ((jsonOf(c.p, "hints") || {})[dir] || {})[num], rec = store.get("crossword:" + c.p.id) || {};
    QF.name = num + (dir === "a" ? " Across" : " Down");
    load({ id: "quickfire", qf: 1, title: "Quickfire", grid: [c.a.replace(/./g, ".")], across: { 1: c.clue },
      blog: c.p.blog, blog_name: c.p.blog_name, blog_keys: (c.p.blog_keys || []).indexOf(c.k) >= 0 ? ["a1"] : [] });
    SOL = [c.a]; DEFS = d ? { a: { 1: d } } : null; PARSES = c.blog ? { a: { 1: c.blog } } : null;
    myParses = c.mine ? { a1: c.mine } : {}; myDefs = (rec.defs || {})[c.k] ? { a1: rec.defs[c.k] } : {};
    render();
  }
  // Quickfire is a home tab: the home page's heading, summary and tabs move above it, and back when it closes.
  function qfHead(on) {
    var h = $("home").querySelector(".hwrap"), q = $("qfHead").firstChild;
    if (on && !q.firstChild) [".hhead", ".hsub", ".fbar"].forEach(function (c) { q.appendChild(h.querySelector(c)); });
    if (!on && q.firstChild) { h.insertBefore(q.firstChild, $("problems")); h.insertBefore(q.firstChild, $("problems")); h.insertBefore(q.firstChild, $("fpanel")); }
    $("homeSum").classList.toggle("qft", on); $("qfBtn").classList.toggle("on", on);
    if (on) $("homeSum").textContent = "Quickfire";
  }
  $("qfBtn").addEventListener("click", function () { if ($("home").hidden) showHome(); else openQuickfire(); });
  $("qfNext").addEventListener("click", qfNext);
  $("qfPrev").addEventListener("click", function () { if (QF.at > 0) qfShow(QF.seen[--QF.at]); });
  $("qfSolve").addEventListener("click", function () {
    var w = words[0];
    if (!filled(w)) return toast("Fill every square first");
    if (allRight()) { w.cells.forEach(function (rc) { ok[rc[0] + "," + rc[1]] = 1; }); solved = true; flash(w); toast("Correct"); }
    else {
      w.cells.forEach(function (rc) { fill[rc[0]][rc[1]] = ""; }); sel = { r: 0, c: 0, dir: "a" }; toast("Incorrect, try again");
      $("grid").classList.remove("no"); void $("grid").offsetWidth; $("grid").classList.add("no");
    }
    render();
  });
  // The filter: a switch per clue type, read from the parsings (none on: every type).
  function qfFilter() {
    var pick = qfPick(), n = {}, box = $("qfTypes");
    QF.pool.forEach(function (c) { c.t.forEach(function (t) { n[t] = (n[t] || 0) + 1; }); });
    box.innerHTML = '<span>Clue types</span><div class="set"><span>Clues in play</span><span class="sval" id="qfCount"></span></div>';
    TYPES.forEach(function (t) {
      if (!n[t]) return;
      var l = document.createElement("label"), v = document.createElement("span"), x = document.createElement("input");
      l.className = "tog"; l.textContent = t; v.className = "sval"; v.textContent = n[t];
      x.type = "checkbox"; x.dataset.t = t; x.checked = pick.indexOf(t) >= 0;
      v.appendChild(x); l.appendChild(v); box.appendChild(l);
    });
    $("qfCount").textContent = qfMatch().length + (pick.length ? "" : ", all types");
  }
  $("qfTypes").addEventListener("change", function (e) {
    var t = e.target.dataset.t, pick = qfPick().filter(function (x) { return x !== t; });
    store.local("crossword:qf", { types: e.target.checked ? pick.concat([t]) : pick });
    $("qfCount").textContent = qfMatch().length + (qfPick().length ? "" : ", all types");
  });
  function qfDone() { $("qfSheet").hidden = true; if (qfPick().join() !== QF.was) { QF.seen.length = QF.at + 1; qfNext(); } }
  $("qfDone").addEventListener("click", qfDone);
  $("qfSheet").addEventListener("click", function (e) { if (e.target === this) qfDone(); });
