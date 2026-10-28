  // Parsed types mapped onto the editor's list; anything else is left out of the filter.
  function qfTypes(x) {
    var out = [];
    ctype(x && x.type).replace(/\band lit\b/ig, "&lit").split(/\s*(?:,|\+|\band\b|\bwith\b)\s*/i).forEach(function (t) {
      t = TYPES.filter(function (y) { return y.toLowerCase() === t.toLowerCase(); })[0];
      if (t && out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }
  // The pool comes from the finished puzzles' heads (h.qc: each playable clue's blog type, and whether its answer is
  // known), worked out again only when the puzzle or its record changes; a clue's puzzle is read whole (full) only
  // when the clue comes up.
  function qfPool() {
    var out = [];
    PUZZLES.forEach(function (h) {
      if (!h.qc || !/^(Solved|DNF)$/.test(statusOf(h))) return;
      var s = store.peek("crossword:" + h.id) || {}, c = pc(h);
      if (!c.qf || c.qf.s !== s) c.qf = { s: s, list: qfClues(h, s) };
      out.push.apply(out, c.qf.list);
    });
    return out;
  }
  // Clues with a known answer, or one the solver added.
  function qfClues(h, s) {
    var out = [], mine = s.parses || {}, ans = s.answers || {};
    ["a", "d"].forEach(function (dir) {
      Object.keys(h.qc[dir] || {}).forEach(function (num) {
        var k = dir + num, x = h.qc[dir][num];
        if (x[1] || /^[A-Z]+$/.test(ans[k] || "")) out.push({ h: h, k: k, t: qfTypes(mine[k] || (x[0] ? { type: x[0] } : null)) });
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
    // The screen switches only once the first clue's puzzle is read, so the last grid never shows meanwhile.
    QF = { pool: qfPool(), seen: [], at: -1, first: true };
    if (!QF.pool.length) return toast("Finish a puzzle first: Quickfire uses clues from your finished puzzles");
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
    QF.want = c; $("qfPrev").disabled = !QF.at;
    full(c.h).then(function (p) {
      if (QF.want !== c) return;
      if (QF.first) { QF.first = false; showList(false); $("home").hidden = true; TAB = ""; qfHead(true); }
      QF.c = c; qfLoad(c, p);
    }, function () { toast("Couldn\u2019t load that clue. Check your connection."); });
  }
  function qfLoad(c, p) {
    var dir = c.k[0], num = c.k.slice(1), d = ((jsonOf(p, "hints") || {})[dir] || {})[num], rec = store.get("crossword:" + p.id) || {};
    c.p = p; c.a = rawAnswer(p, c.k, rec); c.clue = joinEnum((p[dir === "a" ? "across" : "down"] || {})[num] || "");
    c.blog = ((jsonOf(p, "parses") || {})[dir] || {})[num]; c.mine = (rec.parses || {})[c.k]; if (c.mine && c.mine.off) c.mine = null;
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
