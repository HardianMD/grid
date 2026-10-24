  // Create: the solver's own puzzles. Each is a draft d, kept in Firestore at users/{uid}/made/<id> as {j, u}: its number
  // n, title, note, date made, grid rows ("#" black), clue wording (clues) and linked answers (links), keyed by a slot's
  // first square and direction ("r,c,a"), and word breaks (brk: "," or "-" after a square, keyed "r,c,dir"), so each
  // stays with its slot while other squares change. Its letters (f, rows), parsings (p) and definitions (d, by slot too)
  // travel scrambled in x. The editor plays a draft as a puzzle (P.ed, made by edPuzzle) and numbers it like any other.
  // Once added, a draft is also a puzzle in the list (madePuzzle, p.made), built here rather than stored again.
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
      b.appendChild(mk("div", "hs", d.added ? "Added" : "Draft"));
      b.addEventListener("click", function () { edOpen(d); });
      box.appendChild(b);
    });
  }
  function newMade(g) {
    var n = Object.keys(MADE).reduce(function (m, k) { return Math.max(m, MADE[k].n || 0); }, 0) + 1, id = "made-" + n;
    var d = { id: id, n: n, title: "Crossword No. " + n, note: "", date: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10),
      grid: g, f: g.map(function (row) { return row.replace(/./g, " "); }), clues: {}, brk: {}, links: [], p: {}, d: {}, sym: 1 };
    madeSave(d); edOpen(d);
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
    $("hintTitle").textContent = wordName(w); $("hintText").hidden = true; $("clueForm").hidden = $("clueParse").hidden = false;
    $("clueLen").textContent = "(" + ((w.clue.match(/\(([\d,\-]+)\)$/) || [])[1] || w.cells.length) + ")";
    $("clueText").value = ED.d.clues[skey(w)] || "";
    $("clueAns").value = any ? w.cells.map(function (rc, i) { return (fill[rc[0]][rc[1]] || "?") + (br[i] || ""); }).join("") : "";
    // Linking: the other slots this answer runs on into, in order; slots in other links are not offered.
    var k = skey(w), links = ED.d.links || [], other = {}, box = $("clueLink"), sl = slotsOf(ED.d.grid);
    ED.tails = ((links.filter(function (g) { return g[0] === k; })[0]) || [k]).slice(1);
    links.forEach(function (g) { if (g[0] !== k) g.forEach(function (x) { other[x] = 1; }); });
    var name = function (t) { var s = sl.filter(function (x) { return skey(x) === t; })[0]; return s.num + (s.dir === "a" ? " Across" : " Down"); };
    var sum = function () { $("clueLinkSum").textContent = ED.tails.length ? "· " + ED.tails.map(name).join(", ") : ""; };
    box.innerHTML = ""; $("clueLinkBox").open = ED.tails.length > 0; sum();
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
    var n = w.cells.length, i = 0;
    if (v && v.replace(/[^A-Z?]/g, "").length !== n) return toast("The answer needs " + n + " letters");
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
    $("edAdd").parentNode.hidden = !!d.added; $("edAdded").hidden = !d.added; $("edPdfOpts").hidden = true;
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
  // Add to puzzles: once every square has a letter and every clue its wording, the puzzle joins the list on the day it
  // was made; later changes reach it too.
  function edReady() {
    save();
    var todo = words.filter(function (w) { return !filled(w); }).length, nc = words.filter(function (w) { return !ED.d.clues[skey(w)]; }).length;
    if (todo || nc) toast("First " + [todo ? plural(todo, "answer") + " to fill" : "", nc ? plural(nc, "clue") + " to write" : ""].filter(Boolean).join(" and "));
    return !todo && !nc;
  }
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
  // Export as an A4 PDF to print: title, author and note, the grid with the clues beside and below it; then, as chosen
  // (k: 0 clues only, 1 with the solution, 2 with the solution and each answer's definition and parsing), a solution page.
  // It uses the PDF's own Helvetica (nothing embedded); its widths here wrap the clues.
  var HW = ("278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278," + "556,".repeat(10) + "278,278,584,584,584,556,1015,667,667,722,722," +
    "667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556," +
    "500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584").split(",");
  function pdfFile(p, k, d) {
    var PW = 595, PH = 842, M = 40, pages = [], o = "", f = function (n) { return +n.toFixed(1); };
    var esc = function (s) { return String.fromCharCode.apply(null, lat(s)).replace(/[\\()]/g, "\\$&"); };
    var wid = function (s, z) { return lat(s).reduce(function (n, c) { return n + +(HW[c - 32] || 556); }, 0) * z / 1000; };
    var text = function (s, x, y, z, b) { o += "BT /F" + (b ? 2 : 1) + " " + z + " Tf " + f(x) + " " + f(y) + " Td (" + esc(s) + ") Tj ET\n"; };
    var wrap = function (s, z, w) {
      var out = [], line = "";
      String(s || "").split(/\s+/).forEach(function (t) { if (line && wid(line + " " + t, z) > w) { out.push(line); line = t; } else line = line ? line + " " + t : t; });
      return out.concat(line ? [line] : []);
    };
    var grid = function (x, top, c, sol) {
      o += "0.6 w\n";
      p.grid.forEach(function (row, r) { Array.from(row).forEach(function (ch, k) {
        o += f(x + k * c) + " " + f(top - (r + 1) * c) + " " + c + " " + c + " re " + (ch === "#" ? "B" : "S") + "\n";
        if (sol && ch !== "#") text(sol[r * row.length + k], x + k * c + (c - wid(sol[r * row.length + k], c * 0.55)) / 2, top - (r + 1) * c + c * 0.25, f(c * 0.55), 1);
      }); });
      slotsOf(p.grid).forEach(function (w) { text(String(w.num), x + w.cells[0][1] * c + 1.5, top - w.cells[0][0] * c - c * 0.33, f(c * 0.3)); });
      o += "1.5 w " + f(x) + " " + f(top - p.grid.length * c) + " " + p.grid[0].length * c + " " + p.grid.length * c + " re S\n";
    };
    var page = function () { if (o) pages.push(o); o = ""; };
    // Page 1: heading, then the grid; the clues run beside it, under it, then in two columns on further pages.
    var y = PH - M - 16, c = 17, gw = c * p.grid[0].length;
    text(p.title, M, y, 18, 1);
    if (p.setter) text(p.setter, M, y -= 17, 11);
    wrap(p.note, 10, PW - 2 * M).forEach(function (l) { text(l, M, y -= 13, 10); });
    var top = y - 14, cols = [[M + gw + 20, top, PW - 2 * M - gw - 20], [M, top - c * p.grid.length - 18, gw]], ci = 0;
    grid(M, top, c);
    y = cols[0][1];
    var half = function (t) { return [[M, t, (PW - 2 * M - 20) / 2], [PW / 2 + 10, t, (PW - 2 * M - 20) / 2]]; };
    var put = function (h, draw) {
      while (y - h < M) {
        if (++ci >= cols.length) { page(); cols = cols.concat(half(PH - M)); }
        y = cols[ci][1];
      }
      draw(cols[ci][0], cols[ci][2]); y -= h;
    };
    ["a", "d"].forEach(function (dir, i) {
      put(i ? 26 : 14, function (x) { text(dir === "a" ? "Across" : "Down", x, y - (i ? 24 : 12), 12, 1); });
      slotsOf(p.grid).filter(function (w) { return w.dir === dir; }).forEach(function (w) {
        var ls = wrap(p[dir === "a" ? "across" : "down"][w.num], 10, cols[0][2] - 20);  // the narrowest column
        put(4 + ls.length * 12, function (x) { text(String(w.num), x, y - 14, 10, 1); ls.forEach(function (l, j) { text(l, x + 20, y - 14 - j * 12, 10); }); });
      });
    });
    page();
    // The solution on a page of its own, then the parsings in two columns under it.
    if (k) { text("Solution: " + p.title, M, PH - M - 16, 14, 1); grid(M, PH - M - 34, 22, solOf(p)); }
    if (k > 1) {
      var sl = slotsOf(d.grid), by = {}, tails = {}, links = d.links || [];
      sl.forEach(function (w) { by[skey(w)] = w; });
      links.forEach(function (g) { g.slice(1).forEach(function (t) { tails[t] = 1; }); });
      cols = half(PH - M - 34 - 22 * p.grid.length - 16); ci = 0; y = cols[0][1];
      ["a", "d"].forEach(function (dir) {
        sl.filter(function (w) { return w.dir === dir && !tails[skey(w)]; }).forEach(function (w) {
          // The answer across every part it runs into, with its spaces and hyphens.
          var g = (links.filter(function (l) { return l[0] === skey(w); })[0] || [skey(w)]).map(function (t) { return by[t]; }).filter(Boolean), ans = "";
          g.forEach(function (s) { s.cells.forEach(function (rc) { var b = d.brk[rc.concat(s.dir).join()]; ans += d.f[rc[0]][rc[1]] + (b === "-" ? "-" : b ? " " : ""); }); });
          var x = (d.p || {})[skey(w)], df = ((d.d || {})[skey(w)] || [])[0], cw = cols[0][2];
          var ls = (df ? wrap("Definition: " + df, 9.5, cw) : []).concat(x ? wrap([x.type, (x.wordplay || "").replace(/_([^_]+)_/g, "$1").replace(/~([^~]+)~/g, "-$1")].filter(Boolean).join(": "), 9.5, cw) : []);
          put(18 + ls.length * 11.5, function (cx) {
            text(w.num + (dir === "a" ? " Across  " : " Down  ") + ans.trim(), cx, y - 12, 10, 1);
            ls.forEach(function (l, j) { text(l, cx, y - 24 - j * 11.5, 9.5); });
          });
        });
      });
    }
    page();
    var objs = ["<< /Type /Catalog /Pages 2 0 R >>", "", "Helvetica", "Helvetica-Bold"].map(function (s, i) { return i < 2 ? s : "<< /Type /Font /Subtype /Type1 /BaseFont /" + s + " /Encoding /WinAnsiEncoding >>"; }), kids = [];
    pages.forEach(function (s) {
      kids.push(objs.length + 1 + " 0 R");
      objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + (objs.length + 2) + " 0 R >>");
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
  $("edPdf").addEventListener("click", function () { $("edPdfOpts").hidden = !$("edPdfOpts").hidden; });
  $("edPdfOpts").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) edExport("pdf", +b.dataset.k); });
  function edExport(ext, k) {
    if (!edReady()) return;
    var p = madePuzzle(ED.d), name = (p.title.replace(/[^\w ]+/g, "").trim() || "crossword") + "." + ext;
    var file = new File([ext === "pdf" ? pdfFile(p, k, ED.d) : puzFile(p)], name, { type: ext === "pdf" ? "application/pdf" : "application/octet-stream" }), a = mk("a");
    // Phones share the file (a Home Screen app can't download); computers download it.
    if (matchMedia("(pointer: coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file] }).catch(function () {});
    a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }
  $("edDone").addEventListener("click", function () { $("edSheet").hidden = true; });
  $("edSheet").addEventListener("click", function (e) { if (e.target === this) this.hidden = true; });
