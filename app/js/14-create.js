  // Create: the solver's own puzzles. Each is a draft d, kept in Firestore at users/{uid}/made/<id> as {j, u}: its number
  // n, title, note, date made, grid rows ("#" black), clue wording (clues) and linked answers (links), keyed by a slot's
  // first square and direction ("r,c,a"), and word breaks (brk: "," or "-" after a square, keyed "r,c,dir"), so each
  // stays with its slot while other squares change. Its letters (f, rows), parsings (p) and definitions (d, by slot too)
  // travel scrambled in x. The editor plays a draft as a puzzle (P.ed, made by edPuzzle) and numbers it like any other.
  // Once added, a draft is also a puzzle in the list (madePuzzle, p.made), built here rather than stored again.
  // The clue bank's clues are drafts too (bank: 1), each a single row whose one slot is "0,0,a", edited the same way.
  var MADE = {}, MADECOL = null, madeQ = {}, madeT = null, ED = null;
  function scramble(s, key) {
    var b = new TextEncoder().encode(s), out = "";
    for (var i = 0; i < b.length; i++) out += String.fromCharCode(b[i] ^ key.charCodeAt(i % key.length));
    return btoa(out);
  }
  function gotMade(snap) {
    snap.docChanges().forEach(function (ch) {
      var id = ch.doc.id, x = ch.doc.data(), d = null;
      if (ch.type === "removed") { delete MADE[id]; return; }
      try { d = JSON.parse(x.j); Object.assign(d, JSON.parse(unscramble(d.x, id))); delete d.x; } catch (e) { return; }
      if (!MADE[id] || (d.at || 0) > (MADE[id].at || 0)) MADE[id] = d;
    });
    if (BOOTED && !$("home").hidden) showHome(true);
  }
  function madeSave(d) {
    d.at = Date.now(); MADE[d.id] = madeQ[d.id] = d;
    if (!madeT) madeT = setTimeout(madeFlush, 1500);
  }
  function madeFlush() {
    clearTimeout(madeT); madeT = null;
    if (!MADECOL) return;
    var q = madeQ; madeQ = {};
    Object.keys(q).forEach(function (id) {
      var o = Object.assign({}, q[id], { x: scramble(JSON.stringify({ f: q[id].f, p: q[id].p, d: q[id].d }), id), f: undefined, p: undefined, d: undefined });
      MADECOL.doc(id).set({ j: JSON.stringify(o), u: new Date().toISOString() }).then(syncOk, function (e) { if (!madeQ[id]) madeQ[id] = q[id]; syncErr(e); });
    });
  }

  // The Create tab: New puzzle and New clue, each puzzle in number order, then the clue bank.
  function showMade() {
    var box = $("makeList"), row = mk("div", "mkrow"), nb = mk("button", "btn solid mknew", "New puzzle"), nc = mk("button", "btn mknew", "New clue");
    box.innerHTML = ""; nb.type = nc.type = "button"; row.appendChild(nb); row.appendChild(nc); box.appendChild(row);
    nb.addEventListener("click", function () { gridPick(newMade); });
    nc.addEventListener("click", newClue);
    var list = Object.keys(MADE).map(function (k) { return MADE[k]; }).filter(function (d) { return !d.bank; }).sort(function (a, b) { return a.n - b.n; }), bank = bankList();
    box.appendChild(mk("h2", "hday", "Puzzles"));
    if (!list.length) box.appendChild(mk("p", "hempty", "Puzzles you make appear here, in number order."));
    list.forEach(function (d) {
      var b = mk("button", "hitem"); b.type = "button";
      b.appendChild(mk("div", "ht")).appendChild(mk("span", null, d.title));
      b.appendChild(mk("div", "hm", plural(slotsOf(d.grid).length, "clue") + " · " + fmtDate(new Date(d.date + "T12:00:00"), { day: "numeric", month: "short", year: "numeric" })));
      b.appendChild(mk("div", "hs", d.added ? "Added" : "Draft"));
      b.addEventListener("click", function () { edOpen(d); });
      box.appendChild(b);
    });
    box.appendChild(mk("h2", "hday", "Clue bank"));
    if (!bank.length) box.appendChild(mk("p", "hempty", "Clues you write on their own appear here, to browse while making a puzzle."));
    bank.forEach(function (c) { var b = bankItem(c); b.addEventListener("click", function () { edOpen(c); }); box.appendChild(b); });
  }
  function today() { return new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function newMade(g) {
    var n = Object.keys(MADE).reduce(function (m, k) { return MADE[k].bank ? m : Math.max(m, MADE[k].n || 0); }, 0) + 1, id = "made-" + n;
    var d = { id: id, n: n, title: "Crossword No. " + n, note: "", date: today(),
      grid: g, f: g.map(function (row) { return row.replace(/./g, " "); }), clues: {}, brk: {}, links: [], p: {}, d: {}, sym: 1 };
    madeSave(d); edOpen(d);
  }
  // A new clue opens at its clue sheet; it is kept once it has letters or wording, and the answer sets its length.
  function newClue() {
    edOpen({ id: "clue-" + Date.now().toString(36), bank: 1, title: "Clue bank", note: "", date: today(), grid: ["......."], f: ["       "], clues: {}, brk: {}, links: [], p: {}, d: {} });
    edClue(words[0]);
  }
  // The clue bank in answer order; a clue's answer with its spaces and hyphens ("?" for a square not filled).
  function bankList() { return Object.keys(MADE).map(function (k) { return MADE[k]; }).filter(function (d) { return d.bank; }).sort(function (a, b) { return cmp(bankAns(a), bankAns(b)); }); }
  function bankAns(c) { return Array.from(c.f[0]).map(function (ch, i) { var b = c.brk["0," + i + ",a"]; return (ch.trim() || "?") + (b === "-" ? "-" : b ? " " : ""); }).join("").trim(); }
  function bankItem(c, hs) {
    var b = mk("button", "hitem"), x = (c.p || {})["0,0,a"], t = x && x.type !== "Parsing" ? x.type : "";
    b.type = "button";
    b.appendChild(mk("div", "ht")).appendChild(mk("span", null, bankAns(c)));
    b.appendChild(mk("div", "hm", (c.clues["0,0,a"] || "No wording yet") + " (" + enumOf(c, Array.from(c.f[0]).map(function (ch, i) { return [0, i, "a"]; })) + ")"));
    b.appendChild(mk("div", "hs", hs || t || "No parsing"));
    return b;
  }

  // An added draft as a puzzle for the list, Quickfire and solving, in the shared puzzles' format (answers, definitions
  // and parsings scrambled; qc as the updater writes it); made again only when the draft changes.
  var MP = new WeakMap(), SHARED = [];
  // An added draft's id in the list: each publish after an unpublish gets a new one (d.r), so its progress starts afresh.
  function madeId(d) { return d.id + (d.r ? "-r" + d.r : ""); }
  function madePuzzle(d) {
    var c = MP.get(d);
    if (c && c.at === d.at) return c.p;
    var p = edPuzzle(d), id = madeId(d), nk = {}, hints = { a: {}, d: {} }, ps = { a: {}, d: {} }, qc = { a: {}, d: {} }, tail = {};
    slotsOf(d.grid).forEach(function (w) { nk[skey(w)] = w; });
    (d.links || []).forEach(function (g) { g.slice(1).forEach(function (k) { if (nk[k] && nk[g[0]]) tail[k] = nk[g[0]]; }); });
    Object.keys(nk).forEach(function (k) {
      var w = nk[k], n = w.num, h = tail[k], x = (d.p || {})[k], df = ((d.d || {})[k] || [])[0];
      if (h) { p[w.dir === "a" ? "across" : "down"][n] = "See " + h.num + (h.dir !== w.dir ? (h.dir === "a" ? " Across" : " Down") : ""); return; }
      if (x) ps[w.dir][n] = x;
      if (df) hints[w.dir][n] = df;
      qc[w.dir][n] = [x ? x.type : null, 1];
    });
    var flat = d.f.map(function (row, r) { return Array.from(row).map(function (ch, c) { return d.grid[r][c] === "#" ? "#" : ch.trim() || "?"; }).join(""); }).join("");
    delete p.ed;
    p = Object.assign(p, { id: id, made: 1, publication: "Created", badge: { bg: "#e8e0f4", fg: "#4b2c83" }, type: "Cryptic", solution_source: "published",
      solution: scramble(flat, id), hints: scramble(JSON.stringify(hints), id), parses: scramble(JSON.stringify(ps), id), qc: qc, u: String(d.at) });
    MP.set(d, { at: d.at, p: p });
    return p;
  }
  // The shared puzzles (SHARED, from Firestore) and the added drafts.
  function mergeMade() {
    PUZZLES = SHARED.concat(Object.keys(MADE).filter(function (k) { return MADE[k].added; }).map(function (k) { return madePuzzle(MADE[k]); }));
  }

  // The grid library: starting points, grids made here on the papers' lattice, and every 15x15 layout in the puzzles.
  function lattice(open) {
    var g = [];
    for (var r = 0; r < 15; r++) { var row = ""; for (var c = 0; c < 15; c++) row += !open && r % 2 && c % 2 ? "#" : "."; g.push(row); }
    return g;
  }
  // Black squares where odd rows meet odd columns, then pairs of squares (each with its half-turn twin) that split rows
  // and columns into answers of 3 letters or more, keeping every other letter checked, until there are 28 to 32 answers.
  function genGrid() {
    for (var t = 0; t < 50; t++) {
      var g = lattice().map(function (row) { return row.split(""); }), cand = [], want = 28 + Math.floor(Math.random() * 5), n = 16, rows;
      for (var r = 0; r < 15; r++) for (var c = 0; c < 15; c++) {
        var o = r % 2 ? r : c;
        if (r % 2 !== c % 2 && r * 15 + c < 112 && o >= 3 && o <= 11) cand.push([r, c]);
      }
      while (cand.length && n < want) {
        var x = cand.splice(Math.floor(Math.random() * cand.length), 1)[0], set = function (v) { g[x[0]][x[1]] = g[14 - x[0]][14 - x[1]] = v; };
        set("#"); rows = g.map(function (row) { return row.join(""); });
        var k = gridCheck(rows);
        if (k.short || k.lone || k.bad) set("."); else n = k.n;
      }
      if (n >= 28) return g.map(function (row) { return row.join(""); });
    }
    return lattice();
  }
  // Rules the papers' grids keep: half-turn symmetry, one connected area, answers of 3 or more letters, every square in
  // an answer, and at least half of each answer's letters checked with no two unchecked in a row.
  function gridCheck(g) {
    var R0 = g.length, C0 = g[0].length, sl = slotsOf(g), use = {}, white = 0, sym = true, bad = 0, short = 0, first = null;
    sl.forEach(function (w) { w.cells.forEach(function (rc) { use[rc] = (use[rc] || 0) + 1; }); });
    for (var r = 0; r < R0; r++) for (var c = 0; c < C0; c++) {
      if (g[r][c] !== "#") { white++; first = first || [r, c]; }
      if ((g[r][c] === "#") !== (g[R0 - 1 - r][C0 - 1 - c] === "#")) sym = false;
    }
    sl.forEach(function (w) {
      var ch = 0, run = 0, two = false;
      if (w.cells.length < 3) short++;
      w.cells.forEach(function (rc) { if (use[rc] > 1) { ch++; run = 0; } else if (++run > 1) two = true; });
      if (two || ch * 2 < w.cells.length) bad++;
    });
    var seen = {}, todo = first ? [first] : [], got = 0;
    while (todo.length) {
      var x = todo.pop(), k = x.join();
      if (seen[k] || x[0] < 0 || x[0] >= R0 || x[1] < 0 || x[1] >= C0 || g[x[0]][x[1]] === "#") continue;
      seen[k] = 1; got++;
      todo.push([x[0] + 1, x[1]], [x[0] - 1, x[1]], [x[0], x[1] + 1], [x[0], x[1] - 1]);
    }
    return { n: sl.length, black: Math.round(100 * (R0 * C0 - white) / (R0 * C0)), sym: sym, joined: got === white, short: short, bad: bad, lone: white - Object.keys(use).length };
  }
  function thumb(g) {
    var cv = document.createElement("canvas"), x = cv.getContext("2d"), s = 10;
    cv.width = cv.height = g.length * s;
    x.fillStyle = "#c9d1d7"; x.fillRect(0, 0, cv.width, cv.height);
    g.forEach(function (row, r) { Array.from(row).forEach(function (ch, c) {
      x.fillStyle = ch === "#" ? "#15191d" : "#fff"; x.fillRect(c * s, r * s, ch === "#" ? s : s - 1, ch === "#" ? s : s - 1);
    }); });
    return cv;
  }
  function gridPick(then) {
    var box = $("gridList"), seen = {}, pubs = {};
    var sec = function (name, list, more) {
      var el = mk("div", "gsec"), row = mk("div", "gthumbs");
      el.appendChild(mk("h4", null, name));
      list.forEach(function (g) {
        var b = mk("button", "gthumb"); b.type = "button"; b.appendChild(thumb(g));
        b.addEventListener("click", function () { $("gridSheet").hidden = true; then(g); });
        row.appendChild(b);
      });
      el.appendChild(row); if (more) el.appendChild(more);
      return box.appendChild(el);
    };
    box.innerHTML = "";
    sec("Start from", [lattice(), lattice(true)]);
    var mb = mk("button", "btn mini", "More like these"), made = function () { var l = []; for (var i = 0; i < 6; i++) l.push(genGrid()); return l; };
    mb.type = "button";
    var gen = sec("Made for you", made(), mb);
    mb.addEventListener("click", function () { box.replaceChild(sec("Made for you", made(), mb), gen); gen = mb.parentNode; });
    PUZZLES.slice().sort(function (a, b) { return cmp(b.date || "", a.date || ""); }).forEach(function (p) {
      var k = p.grid.join("");
      if (p.grid.length !== 15 || p.grid[0].length !== 15 || seen[k]) return;
      seen[k] = 1; (pubs[pubOf(p) || "Other"] = pubs[pubOf(p) || "Other"] || []).push(p.grid);
    });
    Object.keys(pubs).sort(cmp).forEach(function (n) { sec("From " + n, pubs[n]); });
    $("gridSheet").hidden = false; box.parentNode.scrollTop = 0;
  }
  $("gridDone").addEventListener("click", function () { $("gridSheet").hidden = true; });
  $("gridSheet").addEventListener("click", function (e) { if (e.target === this) this.hidden = true; });

  // The editor.
  function skey(w) { return w.cells[0][0] + "," + w.cells[0][1] + "," + w.dir; }
  // The letter count of squares cs ([r, c, dir] each), split at the breaks: "9", "6,3", "3-4".
  function enumOf(d, cs) {
    var out = "", n = 0;
    cs.forEach(function (x, i) { n++; var b = i < cs.length - 1 && d.brk[x.join()]; if (b) { out += n + b; n = 0; } });
    return out + n;
  }
  function edPuzzle(d) {
    var p = { id: "edit", ed: 1, title: d.bank ? "Clue bank" : d.title, note: d.note, setter: prefs().name || "", date: d.date, grid: d.grid, across: {}, down: {}, links: [] };
    var sl = slotsOf(d.grid), by = {}, head = {};
    sl.forEach(function (w) { by[skey(w)] = w; });
    (d.links || []).forEach(function (g) {
      if (!g.every(function (k) { return by[k]; })) return;
      p.links.push(g.map(function (k) { return by[k].dir + by[k].num; })); head[g[0]] = g;
    });
    sl.forEach(function (w) {
      var k = skey(w), cs = [];
      (head[k] || [k]).forEach(function (x) { by[x].cells.forEach(function (rc) { cs.push([rc[0], rc[1], by[x].dir]); }); });
      p[w.dir === "a" ? "across" : "down"][w.num] = ((d.clues[k] || "") + " (" + enumOf(d, cs) + ")").trim();
    });
    return p;
  }
  function edOpen(d) {
    ED = { d: d, sq: false };
    showList(false); qfHead(false); $("home").hidden = true;
    edLoad();
  }
  // Loads the draft again after a change to its squares, breaks or clues, keeping the cursor where it can.
  function edLoad() {
    var d = ED.d, s = d.sel, sl = slotsOf(d.grid), at = function (w) { return w.cells.some(function (rc) { return rc[0] === s.r && rc[1] === s.c; }); };
    if (s && !sl.some(function (w) { return w.dir === s.dir && at(w); })) { var w = sl.filter(at)[0]; d.sel = w ? { r: s.r, c: s.c, dir: w.dir } : null; }
    $("edSq").setAttribute("aria-pressed", String(ED.sq)); $("app").classList.toggle("bank", !!d.bank);
    load(edPuzzle(d)); size(); edStat();
  }
  // Parsings and definitions are kept by slot (d.p, d.d) and used by clue number (myParses, myDefs).
  function edByNum(o) { var out = {}; words.forEach(function (w) { var x = o && o[skey(w)]; if (x) out[w.dir + w.num] = x; }); return out; }
  function edBySlot(o, by) {
    var out = Object.assign({}, o);
    words.forEach(function (w) { var x = by[w.dir + w.num]; if (x) out[skey(w)] = x; else delete out[skey(w)]; });
    return out;
  }
  function edSave() {
    var d = ED.d, f = fill.map(function (row) { return row.map(function (x) { return x || " "; }).join(""); }), p = edBySlot(d.p, myParses), df = edBySlot(d.d, myDefs);
    d.sel = sel;
    if (f.join() !== d.f.join() || JSON.stringify([p, df]) !== JSON.stringify([d.p || {}, d.d || {}])) { d.f = f; d.p = p; d.d = df; madeSave(d); edStat(); }
  }
  // What a clue still needs before the puzzle can be added: its answer, wording, parsing, clue type and definition (a
  // cryptic definition or &lit is its own definition). A linked clue's later parts ("See 1 Across") need only letters.
  function edMiss(w) {
    var d = ED.d, k = skey(w), x = (d.p || {})[k] || {}, t = x.type || "", miss = [];
    if (!filled(w)) miss.push("answer");
    if ((d.links || []).some(function (g) { return g.indexOf(k) > 0; })) return miss;
    if (!d.clues[k]) miss.push("clue");
    if (!(x.wordplay || "").trim()) miss.push("parsing");
    if (!t || t === "Parsing") miss.push("clue type");
    if (!((d.d || {})[k] || []).length && !/\bCD\b|&lit/.test(t)) miss.push("definition");
    return miss;
  }
  // Above the clue list: the grid's shape, then how many clues still need each part, kept up to date while editing.
  function edStat() {
    if (ED.d.bank) { var m = edMiss(words[0]); $("edStat").textContent = m.length ? "Still needed: " + m.map(function (x) { return x === "clue" ? "wording" : x; }).join(", ") : "\u2713 Clue complete"; return; }
    var k = gridCheck(ED.d.grid), warn = [], need = {}, short = 0;
    if (!k.sym) warn.push("not symmetric");
    if (!k.joined) warn.push("squares cut off");
    if (k.short) warn.push(plural(k.short, "2-letter answer"));
    if (k.lone) warn.push(plural(k.lone, "square") + " in no answer");
    if (k.bad) warn.push(plural(k.bad, "answer") + " lightly checked");
    words.forEach(function (w) { var m = edMiss(w); if (m.length) short++; m.forEach(function (x) { need[x] = (need[x] || 0) + 1; }); });
    var el = $("edStat"); el.textContent = plural(words.length, "clue") + ", " + k.black + "% black · ";
    el.appendChild(warn.length ? mk("b", null, "⚠ " + warn.join(", ")) : document.createTextNode("✓ Usual grid rules"));
    el.appendChild(mk("br"));
    el.appendChild(document.createTextNode(short ? "Still needed: " + Object.keys(need).map(function (x) { return plural(need[x], x === "clue" ? "wording" : x); }).join(", ")
      : "✓ Every clue complete, ready to add to puzzles"));
  }
  // Squares on: a tap turns a square black or white, with its half-turn twin while Symmetric squares is on.
  $("edSq").addEventListener("click", function () { ED.sq = !ED.sq; this.setAttribute("aria-pressed", String(ED.sq)); $("app").classList.toggle("sq", ED.sq); });
  function edToggle(r, c) {
    save();
    var d = ED.d, g = d.grid.map(function (row) { return row.split(""); }), to = g[r][c] === "#" ? "." : "#";
    g[r][c] = to; if (d.sym) g[R - 1 - r][C - 1 - c] = to;
    g = g.map(function (row) { return row.join(""); });
    if (!slotsOf(g).length) return toast("A grid needs at least one answer");
    edGrid(g); d.sel = { r: r, c: c, dir: sel.dir }; edLoad();
  }
  // A new grid for the draft: letters stay in the squares still white.
  function edGrid(g) {
    var d = ED.d;
    d.f = d.f.map(function (row, r) { return Array.from(row).map(function (ch, c) { return g[r][c] === "#" ? " " : ch; }).join(""); });
    d.grid = g; madeSave(d);
  }
  // Break: none, then a space, then a hyphen after the selected square.
  $("edBrk").addEventListener("click", function () {
    var w = curWord(), i = indexIn(w), b = ED.d.brk;
    if (i === w.cells.length - 1) return toast("Pick the square before the break");
    var k = w.cells[i].concat(w.cdir[i]).join(), v = b[k] === "," ? "-" : b[k] === "-" ? "" : ",";
    if (v) b[k] = v; else delete b[k];
    toast(v === "," ? "Space after this square" : v ? "Hyphen after this square" : "No break here");
    madeSave(ED.d); edLoad();
  });
  // The clue sheet (tap the clue box): the clue's wording and its answer, whose spaces and hyphens set the breaks.
  function edClue(w) {
    var br = seps(w.breaks), any = w.cells.some(function (rc) { return fill[rc[0]][rc[1]]; });
    askMode = "clue"; askReset("Cancel");
    $("hintTitle").textContent = wordName(w); $("hintText").hidden = true; $("clueForm").hidden = $("clueParse").hidden = false;
    $("clueLen").textContent = ED.d.bank && !any ? "" : "(" + ((w.clue.match(/\(([\d,\-]+)\)$/) || [])[1] || w.cells.length) + ")";
    $("clueText").value = ED.d.clues[skey(w)] || "";
    $("clueAns").value = any ? w.cells.map(function (rc, i) { return (fill[rc[0]][rc[1]] || "?") + (br[i] || ""); }).join("") : "";
    // Linking: the other slots this answer runs on into, in order; slots in other links are not offered.
    var k = skey(w), links = ED.d.links || [], other = {}, box = $("clueLink"), sl = slotsOf(ED.d.grid);
    ED.tails = ((links.filter(function (g) { return g[0] === k; })[0]) || [k]).slice(1);
    links.forEach(function (g) { if (g[0] !== k) g.forEach(function (x) { other[x] = 1; }); });
    var name = function (t) { var s = sl.filter(function (x) { return skey(x) === t; })[0]; return s.num + (s.dir === "a" ? " Across" : " Down"); };
    var sum = function () { $("clueLinkSum").textContent = ED.tails.length ? "· " + ED.tails.map(name).join(", ") : ""; };
    box.innerHTML = ""; $("clueLinkBox").open = ED.tails.length > 0; $("clueLinkBox").hidden = !!ED.d.bank; sum();
    sl.forEach(function (s) {
      var sk = skey(s); if (sk === k || other[sk]) return;
      var b = mk("button", "chip", s.num + (s.dir === "a" ? " Across" : " Down") + " (" + s.cells.length + ")"); b.type = "button";
      b.classList.toggle("on", ED.tails.indexOf(sk) >= 0);
      b.addEventListener("click", function () {
        var i = ED.tails.indexOf(sk);
        if (i >= 0) ED.tails.splice(i, 1); else ED.tails.push(sk);
        b.classList.toggle("on", i < 0); sum();
        $("clueLen").textContent = "(" + ED.tails.reduce(function (n, t) { return n + sl.filter(function (x) { return skey(x) === t; })[0].cells.length; }, sl.filter(function (x) { return skey(x) === k; })[0].cells.length) + " letters)";
      });
      box.appendChild(b);
    });
    $("hintYes").textContent = "Save"; $("hintAsk").hidden = false;
  }
  $("clueParse").addEventListener("click", function () { if (edClueSave(curWord())) openEditor(curWord(), false); });
  function edClueSave(w) {
    var d = ED.d, v = $("clueAns").value.toUpperCase().trim(), k = skey(w), was = ((d.links || []).filter(function (g) { return g[0] === k; })[0] || [k]).slice(1);
    if (ED.tails.join() !== was.join()) {
      save();
      d.links = (d.links || []).filter(function (g) { return g[0] !== k; });
      if (ED.tails.length) d.links.push([k].concat(ED.tails));
      madeSave(d); edLoad();
      w = words.filter(function (x) { return skey(x) === k; })[0];
    }
    var n = w.cells.length, i = 0, len = v.replace(/[^A-Z?]/g, "").length;
    if (d.bank && v && len !== n) {  // a bank clue takes the answer's length
      if (len < 2 || len > 30) return toast("The answer needs 2 to 30 letters");
      d.grid = [".".repeat(len)]; d.f = [" ".repeat(len)]; d.brk = {}; d.sel = { r: 0, c: 0, dir: "a" }; edLoad(); w = words[0]; n = len;
    }
    if (d.bank && !MADE[d.id] && !v && !$("clueText").value.trim()) { $("hintAsk").hidden = true; return true; }  // a new clue left empty isn't kept
    if (v && len !== n) return toast("The answer needs " + n + " letters");
    d.clues[k] = $("clueText").value.replace(/\s+/g, " ").trim().replace(/\s*\([\d,\-\s]+\)$/, "");  // the count is added for you
    if (v) {
      w.cells.forEach(function (rc, j) { delete d.brk[rc.concat(w.cdir[j]).join()]; });
      Array.from(v).forEach(function (ch) {
        if (/[A-Z?]/.test(ch)) { var rc = w.cells[i++]; fill[rc[0]][rc[1]] = ch === "?" ? "" : ch; }
        else if (/[ \-]/.test(ch) && i > 0 && i < n) d.brk[w.cells[i - 1].concat(w.cdir[i - 1]).join()] = ch === "-" ? "-" : ",";
      });
      save();
    }
    $("hintAsk").hidden = true; madeSave(d); edLoad();
    return true;
  }
  // Puzzle details: title, note, symmetry, another grid, or deleting the puzzle.
  $("edMenu").addEventListener("click", function () {
    var d = ED.d;
    $("edName").value = d.title; $("edNote").value = d.note || ""; $("edSym").checked = !!d.sym;
    $("edAdd").parentNode.hidden = !!d.added; $("edAdded").hidden = !d.added; $("edPdfOpts").hidden = $("edCircRow").hidden = true;
    $("edSheet").hidden = false;
  });
  $("edName").addEventListener("change", function () { ED.d.title = this.value.trim() || "Crossword No. " + ED.d.n; madeSave(ED.d); edLoad(); });
  $("edNote").addEventListener("change", function () { ED.d.note = this.value.trim(); madeSave(ED.d); });
  $("edSym").addEventListener("change", function () { ED.d.sym = this.checked ? 1 : 0; madeSave(ED.d); });
  $("edLayout").addEventListener("click", function () { $("edSheet").hidden = true; save(); gridPick(function (g) { edGrid(g); edLoad(); }); });
  function edDrop() {
    if (!sure(this, "Tap to delete")) return;
    var id = ED.d.id;
    delete MADE[id]; delete madeQ[id]; if (MADECOL) MADECOL.doc(id).delete();
    $("edSheet").hidden = true; stopClock(); ED = null; P = null; TAB = "make"; showHome();
  }
  $("edDel").addEventListener("click", edDrop);
  $("edBankDel").addEventListener("click", edDrop);
  // The clue bank while making a puzzle: clues that fit the selected answer (its length, and any letters in the grid)
  // first, each put in with a tap (two when the answer has wording already), with its parsing and definition.
  $("edBank").addEventListener("click", function () {
    save();
    var w = curWord(), n = w.cells.length, box = $("bankList"), all = bankList(), had = ED.d.clues[skey(w)];
    var fit = function (c) { var a = c.f[0]; return a.length === n && a.indexOf(" ") < 0 && w.cells.every(function (rc, i) { var x = fill[rc[0]][rc[1]]; return !x || x === a[i]; }); };
    var yes = all.filter(fit), no = all.filter(function (c) { return !fit(c); });
    box.innerHTML = "";
    if (!all.length) box.appendChild(mk("p", "hempty", "No clues yet. Write some with New clue in the Create tab."));
    else if (!yes.length) box.appendChild(mk("p", "hempty", "None fits " + wordName(w) + " (" + n + ") yet."));
    [[yes, "Fits " + wordName(w) + " (" + n + ")"], [no, "Other clues"]].forEach(function (s) {
      if (!s[0].length) return;
      box.appendChild(mk("h2", "hday", s[1]));
      s[0].forEach(function (c) {
        var b = bankItem(c, s[0] === yes ? (had ? "Replace" : "Use") : null);
        b.addEventListener("click", function () {
          if (s[0] !== yes) return toast(c.f[0].length !== n ? "That answer has " + c.f[0].length + " letters, not " + n : "That doesn\u2019t fit the letters in the grid");
          if (had && !sure(b.lastChild, "Tap to replace")) return;
          edUse(w, c);
        });
        box.appendChild(b);
      });
    });
    $("bankSheet").hidden = false; box.parentNode.scrollTop = 0;
  });
  function edUse(w, c) {
    var d = ED.d, k = skey(w), x = (c.p || {})["0,0,a"], df = (c.d || {})["0,0,a"];
    ED.tails = ((d.links || []).filter(function (g) { return g[0] === k; })[0] || [k]).slice(1);
    $("clueText").value = c.clues["0,0,a"] || ""; $("clueAns").value = bankAns(c);
    edClueSave(w);
    d.p = d.p || {}; d.d = d.d || {};
    if (x) d.p[k] = x; else delete d.p[k];
    if (df) d.d[k] = df; else delete d.d[k];
    madeSave(d); edLoad(); $("bankSheet").hidden = true; toast("Clue put in " + wordName(w));
  }
  $("bankDone").addEventListener("click", function () { $("bankSheet").hidden = true; });
  $("bankSheet").addEventListener("click", function (e) { if (e.target === this) this.hidden = true; });
  // Add to puzzles and the exports wait until every clue is complete (edMiss); until then a sheet lists each one short,
  // and a tap opens that clue. A published puzzle joins the list on the day it was made; later changes reach it too.
  function edReady() {
    save();
    var box = $("edChkList"), short = 0;
    box.innerHTML = "";
    words.forEach(function (w, i) {
      var miss = edMiss(w);
      if (!miss.length) return;
      var b = mk("button", "note-item dnf"); b.type = "button"; short++;
      b.appendChild(mk("b", null, wordName(w))); b.appendChild(mk("span", null, "No " + miss.join(", ").replace(/, ([^,]+)$/, " or $1")));
      b.addEventListener("click", function () { $("edChkSheet").hidden = $("edSheet").hidden = true; gotoWord(i); edClue(words[i]); });
      box.appendChild(b);
    });
    if (short) { box.insertBefore(mk("p", "sub", (short === 1 ? "1 clue still needs" : short + " clues still need") + " work. Tap one to finish it."), box.firstChild); $("edChkSheet").hidden = false; }
    return !short;
  }
  $("edChkDone").addEventListener("click", function () { $("edChkSheet").hidden = true; });
  $("edChkSheet").addEventListener("click", function (e) { if (e.target === this) this.hidden = true; });
  $("edAdd").addEventListener("click", function () {
    if (!edReady()) return;
    ED.d.added = 1; madeSave(ED.d); this.parentNode.hidden = true; $("edAdded").hidden = false; toast("Added to your puzzles");
  });
  // Unpublish: off the puzzle list, Stats and Quickfire, and back to a draft. Its progress is deleted, and a later publish
  // has a new id, so a copy of the old progress still on another device is never counted again.
  $("edUnpub").addEventListener("click", function () {
    if (!sure(this, "Tap to unpublish")) return;
    var d = ED.d, pid = madeId(d), k = "crossword:" + pid;
    delete MEM[k]; delete cloudQ["p_" + pid]; try { localStorage.removeItem(k); } catch (e) {}
    if (CLOUD) CLOUD.doc("p_" + pid).delete().catch(function () {});
    delete d.added; d.r = (d.r || 0) + 1; madeSave(d);
    $("edAdded").hidden = true; $("edAdd").parentNode.hidden = false; toast("Back to drafts");
  });
  // Both exports write Latin-1 text, so curly quotes and dashes become plain ones and other characters "?".
  function lat(s) { return Array.from(String(s || "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-")).map(function (ch) { return ch.charCodeAt(0) < 256 ? ch.charCodeAt(0) : 63; }); }
  // Export as an Across Lite .puz file (version 1.3), the format most crossword apps open: grid, answers, clues with their
  // letter counts, title, author (the Settings name) and note, with the format's checksums.
  function puzFile(p) {
    var W = p.grid[0].length, H = p.grid.length, clues = [];
    var z = function (b) { return b.concat([0]); };
    var ck = function (b, c) { b.forEach(function (x) { c = ((c & 1 ? (c >> 1) + 0x8000 : c >> 1) + x) & 0xffff; }); return c; };
    slotsOf(p.grid).forEach(function (w) { clues.push(lat(p[w.dir === "a" ? "across" : "down"][w.num])); });
    var sol = lat(solOf(p).replace(/#/g, ".")), grid = sol.map(function (x) { return x === 46 ? 46 : 45; }), str = [lat(p.title), lat(p.setter), []], note = lat(p.note);
    var text = function (c) {
      str.forEach(function (b) { if (b.length) c = ck(z(b), c); });
      clues.forEach(function (b) { c = ck(b, c); });
      return note.length ? ck(z(note), c) : c;
    };
    var h = [], put = function (at, b) { b.forEach(function (x, i) { h[at + i] = x; }); };
    for (var i = 0; i < 0x34; i++) h.push(0);
    put(2, z(lat("ACROSS&DOWN"))); put(0x18, z(lat("1.3"))); put(0x2c, [W, H, clues.length & 255, clues.length >> 8, 1, 0]);
    var cib = ck(h.slice(0x2c), 0), cs = [cib, ck(sol, 0), ck(grid, 0), text(0)], all = text(ck(grid, ck(sol, cib)));
    put(0, [all & 255, all >> 8]); put(0x0e, [cib & 255, cib >> 8]);
    put(0x10, cs.map(function (c, i) { return "ICHE".charCodeAt(i) ^ c & 255; })); put(0x14, cs.map(function (c, i) { return "ATED".charCodeAt(i) ^ c >> 8; }));
    return new Uint8Array(h.concat(sol, grid, [].concat.apply([], str.map(z)), [].concat.apply([], clues.map(z)), z(note)));
  }
  // Export as an A4 PDF to print in The Punch's punk zine style: a black band with the masthead in cut-out letters, a
  // warning sticker and a typed strapline; the note; the grid centred with a hard shadow and one across answer circled
  // in red pen; Across and Down on red tape in two columns, sized to fit one page; a black footer band. As chosen (k: 0
  // the puzzle only, 1 with the solution, 2 with the solution and each answer's definition and parsing) solution pages
  // follow in the same style. It uses the PDF's own Helvetica, Times and Courier (nothing embedded); their widths here wrap text.
  var FW = { H: "278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278," + "556,".repeat(10) + "278,278,584,584,584,556,1015,667,667,722,722," +
    "667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556," +
    "500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584",
    T: "250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278," + "500,".repeat(10) + "278,278,564,564,564,444,921,722,667,667,722,611," +
    "556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444," +
    "500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541" };
  FW.H = FW.H.split(","); FW.T = FW.T.split(",");
  function pdfFile(p, k, d) {
    var PW = 595, PH = 842, M = 44, pages = [], o = "", f = function (n) { return +n.toFixed(2); };
    var INK = "0.08 0.08 0.1", RED = "0.84 0.12 0.14", YEL = "0.98 0.86 0.2", WHT = "1 1 1", SOFT = "0.3 0.3 0.32";
    var esc = function (s) { return String.fromCharCode.apply(null, lat(s)).replace(/[\\()]/g, "\\$&"); };
    // Widths: Courier is fixed at 600; bold faces run about 6% wider than the regular metrics here; tc is extra letter spacing.
    var wid = function (s, ft, z, tc) {
      return lat(s).reduce(function (n, c) { return n + (ft[0] === "C" ? 600 : +(FW[ft[0]][c - 32] || 556)); }, 0) * z / 1000 * (/B/.test(ft) && ft[0] !== "C" ? 1.06 : 1) + (tc || 0) * String(s).length;
    };
    var text = function (s, x, y, ft, z, col, align, tc) {
      s = String(s); x -= align === "c" ? wid(s, ft, z, tc) / 2 : align === "r" ? wid(s, ft, z, tc) : 0;
      o += col + " rg BT /" + ft + " " + z + " Tf " + (tc || 0) + " Tc " + f(x) + " " + f(y) + " Td (" + esc(s) + ") Tj ET\n";
    };
    var rect = function (x, y, w, h, col, stroke) { o += col + (stroke ? " RG " + stroke + " w " : " rg ") + f(x) + " " + f(y) + " " + f(w) + " " + f(h) + " re " + (stroke ? "S" : "f") + "\n"; };
    // Draw in a frame turned by a degrees about (x, y), scaled sx by sy.
    var turn = function (a, x, y, fn, sx, sy) {
      var r = a * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r); sx = sx || 1; sy = sy || 1;
      o += "q " + [cs * sx, sn * sx, -sn * sy, cs * sy, x, y].map(f).join(" ") + " cm\n"; fn(); o += "Q\n";
    };
    var wrap = function (s, ft, z, w) {
      var out = [], ln = "";
      String(s || "").split(/\s+/).forEach(function (t) { if (ln && wid(ln + " " + t, ft, z) > w) { out.push(ln); ln = t; } else ln = ln ? ln + " " + t : t; });
      return out.concat(ln ? [ln] : []);
    };
    var fit = function (s, ft, z, w) { while (z > 5 && wid(s, ft, z) > w) z = f(z - 0.25); return z; };
    var page = function () { if (o) pages.push(o); o = ""; };
    var N = p.grid.length, Cn = p.grid[0].length, sol = k ? solOf(p) : "", sl = slotsOf(p.grid);
    // The grid, centred, on a hard black shadow; letters for the solution.
    var grid = function (top, c, letters) {
      var x = (PW - Cn * c) / 2, nums = {};
      sl.forEach(function (w) { nums[w.cells[0].join()] = w.num; });
      rect(x + 7, top - N * c - 7, Cn * c, N * c, INK); rect(x, top - N * c, Cn * c, N * c, WHT);
      p.grid.forEach(function (row, r) { Array.from(row).forEach(function (ch, j) {
        var X = x + j * c, Y = top - (r + 1) * c;
        if (ch === "#") rect(X, Y, c, c, INK);
        else {
          rect(X, Y, c, c, "0.2 0.2 0.22", 0.5);
          if (nums[r + "," + j]) text(nums[r + "," + j], X + 1.4, top - r * c - c * 0.34, "H", f(c * 0.32), INK);
          if (letters) text(letters[r * Cn + j], X + c / 2, Y + c * 0.22, "HB", f(c * 0.55), INK, "c");
        }
      }); });
      rect(x, top - N * c, Cn * c, N * c, INK, 2.4);
      return x;
    };
    // The masthead band: THE PUNCH in cut-out scraps, a tilted sticker and a typed strapline.
    var SCRAP = [[INK, WHT, "HB"], [WHT, INK, "TB"], [RED, WHT, "CB"], [YEL, INK, "HBO"], [WHT, RED, "TBI"], [INK, YEL, "HB"], [RED, WHT, "TB"], [WHT, INK, "CB"], [YEL, INK, "HB"]];
    var TILT = [-6, 4, -3, 0, 7, -5, 3, -7, 5];
    var head = function (sticker, strap) {
      rect(0, PH - 150, PW, 150, INK);
      var x = 40;
      Array.from("THE PUNCH").forEach(function (ch, i) {
        if (ch === " ") { x += 14; return; }
        var s = SCRAP[(i + 2) % 9], z = 34 * (1 + (i + 2) % 3 * 0.12), w = wid(ch, s[2], z) + z * 0.3, h = z * 0.95;
        turn(TILT[(i + 2) % 9], x + w / 2, PH - 70, function () { rect(-w / 2, -h / 2, w, h, s[0]); rect(-w / 2, -h / 2, w, h, INK, 0.5); text(ch, 0, -z * 0.34, s[2], f(z), s[1], "c"); });
        x += w + 4;
      });
      turn(-8, PW - 78, PH - 76, function () {
        rect(-62, -30, 124, 60, YEL); rect(-58, -26, 116, 52, INK, 2);
        text(sticker[0], 0, 8, "HB", 12, INK, "c"); text(sticker[1], 0, -5, "HB", 9, INK, "c", 1); text(sticker[2], 0, -17, "HB", 9, INK, "c", 1);
      });
      strap = strap.join("  //  ").toUpperCase();
      text(strap, M, PH - 128, "CB", fit(strap, "CB", 9, PW - 2 * M), WHT);
      return PH - 150;
    };
    var foot = function (left) { rect(0, 0, PW, 36, INK); text(left, M, 14, "CB", 8.5, WHT); text("THE PUNCH", PW - M, 14, "HB", 9, YEL, "r", 1.5); };
    // Columns of items ({h, draw(x, y, w)}), split so the columns come out even; returns the height used.
    var cols = function (items, top, n, gap) {
      var cw = (PW - 2 * M - gap * (n - 1)) / n, total = items.reduce(function (s, it) { return s + it.h; }, 0), col = 0, y = top, used = 0, h = 0;
      items.forEach(function (it) {
        if (col < n - 1 && used && used + it.h > total / n + 8) { col++; h = Math.max(h, top - y); y = top; used = 0; if (it.gap) return; }
        it.draw(M + col * (cw + gap), y, cw); y -= it.h; used += it.h;
      });
      return Math.max(h, top - y);
    };
    var heading = function (s) {
      s = s.toUpperCase();
      return { h: 28, draw: function (x, y) { turn(2.5, x, y, function () { rect(0, -19, wid(s, "CB", 12, 2) + 14, 17, RED); text(s, 7, -14, "CB", 12, WHT, "", 2); }); } };
    };
    var gapItem = { h: 8, gap: 1, draw: function () {} };
    var clueItems = function (z, cw) {
      var lead = z * 1.23, out = [];
      ["a", "d"].forEach(function (dir) {
        if (dir === "d") out.push(gapItem);
        out.push(heading(dir === "a" ? "Across" : "Down"));
        sl.filter(function (w) { return w.dir === dir; }).forEach(function (w) {
          var ls = wrap(p[dir === "a" ? "across" : "down"][w.num], "H", z, cw - 17);
          out.push({ h: ls.length * lead + 2.4, draw: function (x, y) {
            text(w.num, x + 12, y - z, "HB", z, RED, "r");
            ls.forEach(function (l, i) { text(l, x + 17, y - z - i * lead, "H", z, INK); });
          } });
        });
      });
      return out;
    };
    var date = metaText({ date: p.date }) || "";
    // Page 1: the largest grid and clue size that leave everything on the page.
    var y = head(["WARNING:", "CONTAINS", "INNUENDO"], ["Filth, fun & fiendish clues", p.title, "Set by " + (p.setter || "you"), date].filter(Boolean)) - 26, cw = (PW - 2 * M - 26) / 2;
    var note = wrap(p.note, "C", 9.5, PW - 2 * M - 40);
    note.forEach(function (l) { text(l, PW / 2, y, "C", 9.5, SOFT, "c"); y -= 12; });
    y -= note.length ? 10 : 0;
    var room = function (c, z) { return y - N * c - 30 - clueItems(z, cw).reduce(function (s, it) { return s + it.h; }, 0) / 2 - 20 - 50; };
    var c = 20, z = 8.8;
    while (room(c, z) < 0 && c > 15) c--;
    while (room(c, z) < 0 && z > 6.6) z = f(z - 0.2);
    var gx = grid(y, c);
    // Red pen round the answer chosen in the export options (d.circ: a slot, "-" for none), else round the longest
    // across answer of up to 9 letters that reaches the right edge in the top half, below row 1; a word beside it in the margin.
    var mark = d && d.circ ? sl.filter(function (w) { return skey(w) === d.circ; })[0] :
      sl.filter(function (w) { return w.dir === "a" && w.cells.length < 10 && w.cells[0][0] && w.cells[0][0] < N / 2 && w.cells[w.cells.length - 1][1] === Cn - 1; })
        .sort(function (a, b) { return b.cells.length - a.cells.length; })[0];
    if (mark) {
      var ac = mark.dir === "a", half = mark.cells.length * c / 2 + 8, rx = ac ? half : c * 0.85, ry = ac ? c * 0.85 : half;
      var mx = gx + (mark.cells[0][1] + (ac ? mark.cells.length / 2 : 0.5)) * c, my = y - (mark.cells[0][0] + (ac ? 0.5 : mark.cells.length / 2)) * c;
      turn(-4, mx, my, function () {
        var kx = rx * 0.5523, ky = ry * 0.5523;
        o += RED + " RG 1.6 w " + [rx, 0].map(f).join(" ") + " m " + [rx, ky, kx, ry, 0, ry].map(f).join(" ") + " c " + [-kx, ry, -rx, ky, -rx, 0].map(f).join(" ") + " c " +
          [-rx, -ky, -kx, -ry, 0, -ry].map(f).join(" ") + " c " + [kx, -ry, rx, -ky, rx, 0].map(f).join(" ") + " c S\n";
      });
      // The word sits in the nearer margin, with a pen line to the circle when it's further off.
      var lw = wid("this one's filthy", "HBO", 9.5), right = mx >= PW / 2, lx = right ? gx + Cn * c + 14 : gx - 14 - lw, ex = right ? mx + rx : mx - rx;
      turn(-6, lx, my - 3, function () { text("this one's filthy", 0, 0, "HBO", 9.5, RED); });
      if (Math.abs((right ? lx - 4 : lx + lw + 4) - ex) > 8) o += RED + " RG 1 w " + f(right ? lx - 4 : lx + lw + 4) + " " + f(my) + " m " + f(ex) + " " + f(my) + " l S\n";
    }
    y -= N * c + 30;
    cols(clueItems(z, cw), y, 2, 26);
    foot((k ? "Answers overleaf  //  " : "") + "photocopy it, pass it round the office");
    page();
    if (k) {
      var top = head(["SPOILER:", "NO", "PEEKING"], ["Solution", p.title, "Set by " + (p.setter || "you")]) - 30, sc = k > 1 ? 15 : 22;
      grid(top, sc, sol); top -= N * sc + 30;
      if (k > 1) {
        var tails = {}, by2 = {}, links = d.links || [], items = [];
        sl.forEach(function (w) { by2[skey(w)] = w; });
        links.forEach(function (g) { g.slice(1).forEach(function (t) { tails[t] = 1; }); });
        ["a", "d"].forEach(function (dir) {
          if (dir === "d") items.push(gapItem);
          items.push(heading(dir === "a" ? "Across" : "Down"));
          sl.filter(function (w) { return w.dir === dir && !tails[skey(w)]; }).forEach(function (w) {
            // The answer across every part it runs into, with its spaces and hyphens.
            var g = (links.filter(function (l) { return l[0] === skey(w); })[0] || [skey(w)]).map(function (t) { return by2[t]; }).filter(Boolean), ans = "";
            g.forEach(function (s) { s.cells.forEach(function (rc) { var b = d.brk[rc.concat(s.dir).join()]; ans += d.f[rc[0]][rc[1]] + (b === "-" ? "-" : b ? " " : ""); }); });
            var x = (d.p || {})[skey(w)], df = ((d.d || {})[skey(w)] || [])[0];
            var wp = x ? wrap([x.type, (x.wordplay || "").replace(/_([^_]+)_/g, "$1").replace(/~([^~]+)~/g, "-$1")].filter(Boolean).join(": "), "C", 8, cw - 17) : [];
            var dl = df ? wrap("Definition: " + df, "HBO", 8.5, cw - 17) : [];
            items.push({ h: 13 + (dl.length + wp.length) * 10.4 + 3, draw: function (cx, cy) {
              text(w.num, cx + 12, cy - 9.5, "HB", 9, RED, "r"); text(ans.trim(), cx + 17, cy - 9.5, "CB", 9.5, INK, "", 0.6);
              dl.forEach(function (l, i) { text(l, cx + 17, cy - 21 - i * 10.4, "HBO", 8.5, SOFT); });
              wp.forEach(function (l, i) { text(l, cx + 17, cy - 21 - (dl.length + i) * 10.4, "C", 8, INK); });
            } });
          });
        });
        // Parsings that run past the page carry on over further pages, two columns each.
        while (items.length) {
          var put = [], hsum = 0, cap = 2 * (top - 60) - 40;
          while (items.length && hsum + items[0].h <= cap) { hsum += items[0].h; put.push(items.shift()); }
          if (!put.length) put.push(items.shift());
          cols(put, top, 2, 26);
          if (items.length) { foot("Continued overleaf"); page(); top = head(["STILL", "GOING,", "YOU ANIMAL"], ["Solution, continued", p.title]) - 30; }
        }
      }
      foot("Now go and wash your mind out");
      page();
    }
    return pdfDoc(pages, { H: "Helvetica", HB: "Helvetica-Bold", HBO: "Helvetica-BoldOblique", TB: "Times-Bold", TBI: "Times-BoldItalic", C: "Courier", CB: "Courier-Bold" }, PW, PH);
  }
  // A PDF of pages (each a content stream) in the PDF's own fonts, named here by their resource names.
  function pdfDoc(pages, fonts, PW, PH) {
    var objs = ["<< /Type /Catalog /Pages 2 0 R >>", ""], fr = [], kids = [];
    Object.keys(fonts).forEach(function (n) { objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /" + fonts[n] + " /Encoding /WinAnsiEncoding >>"); fr.push("/" + n + " " + objs.length + " 0 R"); });
    pages.forEach(function (s) {
      kids.push(objs.length + 1 + " 0 R");
      objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources << /Font << " + fr.join(" ") + " >> >> /Contents " + (objs.length + 2) + " 0 R >>");
      objs.push("<< /Length " + s.length + " >>\nstream\n" + s + "endstream");
    });
    objs[1] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + kids.length + " >>";
    var out = "%PDF-1.4\n", at = [];
    objs.forEach(function (s, i) { at.push(out.length); out += i + 1 + " 0 obj\n" + s + "\nendobj\n"; });
    var xref = out.length;
    out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + at.map(function (n) { return ("000000000" + n).slice(-10) + " 00000 n \n"; }).join("") +
      "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    return Uint8Array.from(out, function (ch) { return ch.charCodeAt(0); });
  }
  $("edPuz").addEventListener("click", function () { edExport("puz"); });
  $("edJson").addEventListener("click", function () { edExport("json"); });
  // The parsings as JSON, to take into another app: each answer (with its spaces and hyphens) with its clue, definitions
  // and parsing as stored ({type, wordplay}, wordplay in the parse editor's mark-up). Drafts in progress export as they stand.
  function jsonFile(d) {
    save();
    var out = { title: d.title, setter: prefs().name || "", note: d.note || "", date: d.date, grid: d.grid, clues: [] };
    words.forEach(function (w) {
      var k = skey(w), ans = "";
      w.cells.forEach(function (rc, j) { var b = d.brk[rc.concat(w.cdir[j]).join()]; ans += (fill[rc[0]][rc[1]] || "?") + (b === "-" ? "-" : b && j < w.cells.length - 1 ? " " : ""); });
      out.clues.push({ number: w.num, direction: w.dir === "a" ? "across" : "down", parts: (w.parts || []).map(function (x) { return x.num + (x.dir === "a" ? "a" : "d"); }),
        clue: w.clue, answer: ans.trim(), definitions: (d.d || {})[k] || [], parse: (d.p || {})[k] || null });
    });
    return JSON.stringify(out, null, 2);
  }
  // PDF: the choice of pages, and which answer the red pen circles (Auto picks one; kept on the draft as d.circ).
  $("edPdf").addEventListener("click", function () {
    var on = $("edPdfOpts").hidden, sel = $("edCirc"); $("edPdfOpts").hidden = $("edCircRow").hidden = !on;
    if (!on) return;
    sel.innerHTML = ""; sel.appendChild(new Option("Auto", "")); sel.appendChild(new Option("None", "-"));
    slotsOf(ED.d.grid).forEach(function (w) { sel.appendChild(new Option(w.num + (w.dir === "a" ? " Across" : " Down"), skey(w))); });
    sel.value = ED.d.circ || ""; if (sel.selectedIndex < 0) sel.value = "";
  });
  $("edCirc").addEventListener("change", function () { if (this.value) ED.d.circ = this.value; else delete ED.d.circ; madeSave(ED.d); });
  $("edPdfOpts").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) edExport("pdf", +b.dataset.k); });
  function edExport(ext, k) {
    if (ext !== "json" && !edReady()) return;
    var p = madePuzzle(ED.d), name = (p.title.replace(/[^\w ]+/g, "").trim() || "crossword") + (ext === "json" ? " parsings" : "") + "." + ext;
    giveFile(new File([ext === "pdf" ? pdfFile(p, k, ED.d) : ext === "json" ? jsonFile(ED.d) : puzFile(p)], name,
      { type: ext === "pdf" ? "application/pdf" : ext === "json" ? "application/json" : "application/octet-stream" }));
  }
  // Phones share a file (a Home Screen app can't download); computers download it.
  function giveFile(file) {
    if (matchMedia("(pointer: coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file] }).catch(function () {});
    var a = mk("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }
  $("edDone").addEventListener("click", function () { $("edSheet").hidden = true; });
  $("edSheet").addEventListener("click", function (e) { if (e.target === this) this.hidden = true; });
