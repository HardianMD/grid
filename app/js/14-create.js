  // Create: the solver's own puzzles. Each is a draft d, kept in Firestore at users/{uid}/made/<id> as {j, u}: its number
  // n, title, note, date made, grid rows ("#" black), clue wording (clues) and linked answers (links), keyed by a slot's
  // first square and direction ("r,c,a"), and word breaks (brk: "," or "-" after a square, keyed "r,c,dir"), so each
  // stays with its slot while other squares change. Its letters (f, rows) travel scrambled in x. The editor plays a
  // draft as a puzzle (P.ed, made by edPuzzle) and numbers it like any other.
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
      try { d = JSON.parse(x.j); d.f = JSON.parse(unscramble(d.x, id)).f; delete d.x; } catch (e) { return; }
      if (!MADE[id] || (d.at || 0) > (MADE[id].at || 0)) MADE[id] = d;
    });
    if (!$("home").hidden && TAB === "make") showMade();
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
      var o = Object.assign({}, q[id], { x: scramble(JSON.stringify({ f: q[id].f }), id) }); delete o.f;
      MADECOL.doc(id).set({ j: JSON.stringify(o), u: new Date().toISOString() }).then(syncOk, function (e) { if (!madeQ[id]) madeQ[id] = q[id]; syncErr(e); });
    });
  }

  // The Create tab: a New puzzle button, then each puzzle in number order.
  function showMade() {
    var box = $("makeList"), nb = mk("button", "btn solid mknew", "New puzzle");
    box.innerHTML = ""; nb.type = "button"; box.appendChild(nb);
    nb.addEventListener("click", function () { gridPick(newMade); });
    var list = Object.keys(MADE).map(function (k) { return MADE[k]; }).sort(function (a, b) { return a.n - b.n; });
    if (!list.length) box.appendChild(mk("p", "hempty", "Puzzles you make appear here, in number order."));
    list.forEach(function (d) {
      var b = mk("button", "hitem"); b.type = "button";
      b.appendChild(mk("div", "ht")).appendChild(mk("span", null, d.title));
      b.appendChild(mk("div", "hm", plural(slotsOf(d.grid).length, "clue") + " · " + fmtDate(new Date(d.date + "T12:00:00"), { day: "numeric", month: "short", year: "numeric" })));
      b.appendChild(mk("div", "hs", "Draft"));
      b.addEventListener("click", function () { edOpen(d); });
      box.appendChild(b);
    });
  }
  function newMade(g) {
    var n = Object.keys(MADE).reduce(function (m, k) { return Math.max(m, MADE[k].n || 0); }, 0) + 1, id = "made-" + n;
    var d = { id: id, n: n, title: "Crossword No. " + n, note: "", date: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10),
      grid: g, f: g.map(function (row) { return row.replace(/./g, " "); }), clues: {}, brk: {}, links: [], sym: 1 };
    madeSave(d); edOpen(d);
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
    var p = { id: "edit", ed: 1, title: d.title, note: d.note, setter: prefs().name || "", date: d.date, grid: d.grid, across: {}, down: {}, links: [] };
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
    $("edSq").setAttribute("aria-pressed", String(ED.sq));
    load(edPuzzle(d)); size(); edStat();
  }
  function edSave() {
    var f = fill.map(function (row) { return row.map(function (x) { return x || " "; }).join(""); });
    ED.d.sel = sel;
    if (f.join() !== ED.d.f.join()) { ED.d.f = f; madeSave(ED.d); edStat(); }
  }
  function edStat() {
    var k = gridCheck(ED.d.grid), warn = [], todo = words.filter(function (w) { return !filled(w); }).length, nc = words.filter(function (w) { return !ED.d.clues[skey(w)]; }).length;
    if (!k.sym) warn.push("not symmetric");
    if (!k.joined) warn.push("squares cut off");
    if (k.short) warn.push(plural(k.short, "2-letter answer"));
    if (k.lone) warn.push(plural(k.lone, "square") + " in no answer");
    if (k.bad) warn.push(plural(k.bad, "answer") + " lightly checked");
    var el = $("edStat"); el.textContent = plural(words.length, "clue") + ", " + k.black + "% black · ";
    el.appendChild(warn.length ? mk("b", null, "⚠ " + warn.join(", ")) : document.createTextNode("✓ Usual grid rules"));
    el.appendChild(document.createTextNode(" · " + (todo ? todo + " to fill" : "All filled") + ", " + (nc ? nc + " clues to write" : "all clues written")));
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
    $("hintTitle").textContent = wordName(w); $("hintText").hidden = true; $("clueForm").hidden = false;
    $("clueLen").textContent = "(" + ((w.clue.match(/\(([\d,\-]+)\)$/) || [])[1] || w.cells.length) + ")";
    $("clueText").value = ED.d.clues[skey(w)] || "";
    $("clueAns").value = any ? w.cells.map(function (rc, i) { return (fill[rc[0]][rc[1]] || "?") + (br[i] || ""); }).join("") : "";
    $("hintYes").textContent = "Save"; $("hintAsk").hidden = false;
  }
  function edClueSave(w) {
    var d = ED.d, v = $("clueAns").value.toUpperCase().trim(), n = w.cells.length, i = 0;
    if (v && v.replace(/[^A-Z?]/g, "").length !== n) return toast("The answer needs " + n + " letters");
    d.clues[skey(w)] = $("clueText").value.replace(/\s+/g, " ").trim().replace(/\s*\([\d,\-\s]+\)$/, "");  // the count is added for you
    if (v) {
      w.cells.forEach(function (rc, j) { delete d.brk[rc.concat(w.cdir[j]).join()]; });
      Array.from(v).forEach(function (ch) {
        if (/[A-Z?]/.test(ch)) { var rc = w.cells[i++]; fill[rc[0]][rc[1]] = ch === "?" ? "" : ch; }
        else if (/[ \-]/.test(ch) && i > 0 && i < n) d.brk[w.cells[i - 1].concat(w.cdir[i - 1]).join()] = ch === "-" ? "-" : ",";
      });
      save();
    }
    $("hintAsk").hidden = true; madeSave(d); edLoad();
  }
  // Puzzle details: title, note, symmetry, another grid, or deleting the puzzle.
  $("edMenu").addEventListener("click", function () {
    var d = ED.d;
    $("edName").value = d.title; $("edNote").value = d.note || ""; $("edSym").checked = !!d.sym;
    $("edSheet").hidden = false;
  });
  $("edName").addEventListener("change", function () { ED.d.title = this.value.trim() || "Crossword No. " + ED.d.n; madeSave(ED.d); edLoad(); });
  $("edNote").addEventListener("change", function () { ED.d.note = this.value.trim(); madeSave(ED.d); });
  $("edSym").addEventListener("change", function () { ED.d.sym = this.checked ? 1 : 0; madeSave(ED.d); });
  $("edLayout").addEventListener("click", function () { $("edSheet").hidden = true; save(); gridPick(function (g) { edGrid(g); edLoad(); }); });
  $("edDel").addEventListener("click", function () {
    if (!sure(this, "Tap to delete")) return;
    var id = ED.d.id;
    delete MADE[id]; delete madeQ[id]; if (MADECOL) MADECOL.doc(id).delete();
    $("edSheet").hidden = true; stopClock(); ED = null; P = null; TAB = "make"; showHome();
  });
  $("edDone").addEventListener("click", function () { $("edSheet").hidden = true; });
  $("edSheet").addEventListener("click", function (e) { if (e.target === this) this.hidden = true; });
