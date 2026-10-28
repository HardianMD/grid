  // Phones: the All clues button swaps the keyboard for the clue list, centred on the current clue.
  function showList(on) {
    $("app").classList.toggle("cl", on);
    $("cluesBtn").setAttribute("aria-pressed", on ? "true" : "false");
    var box = $("clues"), cur = on && box.querySelector(".clue.on");
    if (cur) box.scrollTop = cur.offsetTop - box.offsetTop - (box.clientHeight - cur.offsetHeight) / 2;
  }
  $("cluesBtn").addEventListener("click", function () { showList(!$("app").classList.contains("cl")); });
  $("prevBtn").addEventListener("click", function () { nextWord(-1); });
  $("nextBtn").addEventListener("click", function () { nextWord(1); });

  // Puzzle sheet
  function openSheet() {
    // A finished puzzle keeps its mode, and one that has had a hint or reveal can't move up to Hard or Competition.
    var helped = HN > 0 || REV;
    Array.prototype.forEach.call(document.querySelectorAll("#sheet .modesw button"), function (b) { b.disabled = solved || (helped && RANK[b.dataset.mode] >= 2); });
    $("sheet").hidden = false;
  }
  function closeSheet() { $("sheet").hidden = true; }

  // Home: every puzzle, newest first, grouped by date.
  function pubOf(p) {
    return p.publication || "";
  }
  function typeOf(p) { return p.type || "Other"; }
  // The paper's coloured tag, as on the home list.
  function badgeEl(p) {
    var tg = mk("i", "src"); tg.style.fontStyle = "normal"; tg.textContent = pubOf(p);
    if (p.badge) { tg.style.background = p.badge.bg; tg.style.color = p.badge.fg; }
    return tg;
  }
  function kindOf(p) { return (pubOf(p) + " " + typeOf(p)).trim(); }
  // Exact blog post when known (p.blog), else a search on the usual blog for that paper.
  function blogFor(p) {
    if (p.blog) return { url: p.blog, exact: true };
    return p.blog_search ? { url: p.blog_search, exact: false } : null;
  }
  // Records from before the mode was tracked (used -1) count at the mode the puzzle was played in.
  // How much help a saved record had, read the same way by the finish bar and Stats (tools/check.js tests it).
  // u: the recorded mode's rank; older records without one count at the mode played in. hn: hints given; saves
  // from before hn was kept count each clue's hint level. rv: answers revealed; rf: any reveal, which older
  // records kept without the list. rd: a DNF from a reveal (any mode but Easy); dnf also counts a wrong submit.
  function helpOf(s) {
    var h = s.hints || {}, u = s.used >= 0 ? s.used : RANK[s.mode], rd = !!s.rev && u !== 0;
    return { u: u, rd: rd, dnf: rd || !!(s.sub && s.sub.res === "dnf"), rf: !!s.rev, rv: Object.keys(s.revw || {}).length,
      hn: typeof s.hn === "number" ? s.hn : Array.isArray(h) ? h.length : Object.keys(h).reduce(function (n, k) { return n + (+h[k] || 0); }, 0) };
  }
  // The finish bar's help line, said on Easy and Medium only.
  function helpText(g) {
    return g.u === 0 || g.u === 1 ? plural(g.hn, "hint") + " and " + (g.rv || !g.rf ? plural(g.rv, "reveal") : "reveals") : "";
  }
  // Worked out again only when the puzzle or its record changes.
  var PROG = {};
  function progressOf(p) {
    var s0 = store.peek("crossword:" + p.id), c = PROG[p.id];
    if (!c || c.p !== p || c.s !== s0) {
      var s = s0 || {}, n = 0, t = 0, g = helpOf(s);
      p.grid.forEach(function (row, r) { Array.from(row).forEach(function (ch, c) {
        if (ch === "#") return; t++;
        if (s.fill && s.fill[r] && (s.fill[r][c] || " ").trim()) n++;
      }); });
      PROG[p.id] = c = { p: p, s: s0, g: Object.assign(g, { n: n, t: t, solved: !!s.solved, time: s.time || 0, mode: MODES[g.u], sub: s.sub }) };
    }
    return Object.assign({}, c.g);
  }
  function dayLabel(d) {
    if (!d) return "Undated";
    var a = new Date(d + "T12:00:00"), t = new Date(); t.setHours(12, 0, 0, 0);
    var diff = Math.round((t - a) / 864e5);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return fmtDate(a, { weekday: "long", day: "numeric", month: "long", year: a.getFullYear() === t.getFullYear() ? undefined : "numeric" });
  }
  var FILT = store.get("crossword:filter") || {};
  // A puzzle's status, counted as Stats counts it: a submitted grid is a DNF once marked with any wrong square.
  function statusOf(p) {
    var g = progressOf(p);
    if (!g.solved) return g.n ? "In progress" : "New";
    return g.dnf || g.sub && !g.sub.res && markOf(p, store.peek("crossword:" + p.id) || {}).bad > 0 ? "DNF" : "Solved";
  }
  function filterOk(p) {
    if (FILT.status && FILT.status.length && FILT.status.indexOf(statusOf(p)) < 0) return false;
    if (FILT.pub && FILT.pub.length && FILT.pub.indexOf(pubOf(p)) < 0) return false;
    if (FILT.type && FILT.type.length && FILT.type.indexOf(typeOf(p)) < 0) return false;
    if (FILT.setter && (p.setter || "") !== FILT.setter) return false;
    if (FILT.made && p.made) return false;
    if (FILT.from && (p.date || "") < FILT.from) return false;
    if (FILT.to && (p.date || "9999") > FILT.to) return false;
    return true;
  }
  function filterCount() { return (FILT.status || []).length + (FILT.pub || []).length + (FILT.type || []).length + (FILT.setter ? 1 : 0) + (FILT.from || FILT.to ? 1 : 0) + (FILT.made ? 1 : 0); }
  function chipSet(box, values, key) {
    box.innerHTML = "";
    values.forEach(function (v) {
      var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = v;
      if ((FILT[key] || []).indexOf(v) >= 0) b.classList.add("on");
      b.addEventListener("click", function () {
        var a = FILT[key] = FILT[key] || [], i = a.indexOf(v);
        if (i >= 0) a.splice(i, 1); else a.push(v);
        filterChanged();
      });
      box.appendChild(b);
    });
  }
  function uniq(f) { var o = {}; PUZZLES.forEach(function (p) { var v = f(p); if (v) o[v] = 1; }); return Object.keys(o).sort(); }
  function buildFilters() {
    chipSet($("fStatus"), ["Solved", "DNF", "In progress", "New"], "status");
    chipSet($("fPub"), uniq(pubOf), "pub");
    chipSet($("fType"), uniq(typeOf), "type");
    // Created puzzles: shown, or hidden (FILT.made).
    var fm = $("fMade"); fm.innerHTML = ""; fm.parentNode.hidden = !PUZZLES.some(function (p) { return p.made; });
    ["Show", "Hide"].forEach(function (v, i) {
      var b = mk("button", "chip" + (!!FILT.made === !!i ? " on" : ""), v); b.type = "button";
      b.addEventListener("click", function () { FILT.made = i || undefined; filterChanged(); });
      fm.appendChild(b);
    });
    var sel = $("fSetter"); sel.innerHTML = "";
    [""].concat(uniq(function (p) { return p.setter; })).forEach(function (v) {
      var o = document.createElement("option"); o.value = v; o.textContent = v || "Any setter"; sel.appendChild(o);
    });
    sel.value = FILT.setter || "";
    $("fFrom").value = FILT.from || ""; $("fTo").value = FILT.to || "";
  }
  function filterChanged() { store.set("crossword:filter", FILT); buildFilters(); showHome(true); }
  $("filterBtn").addEventListener("click", function () {
    if ($("home").hidden) { QF.was = qfPick().join(); qfFilter(); $("qfSheet").hidden = false; return; }  // Quickfire's own filter
    var open = $("fpanel").hidden;
    if (TAB) { TAB = ""; showHome(true); }
    $("fpanel").hidden = !open; this.setAttribute("aria-expanded", String(open));
    if (open) buildFilters();
  });
  $("fSetter").addEventListener("change", function () { FILT.setter = this.value; filterChanged(); });
  $("fFrom").addEventListener("change", function () { FILT.from = this.value; filterChanged(); });
  $("fTo").addEventListener("change", function () { FILT.to = this.value; filterChanged(); });
  $("filterClear").addEventListener("click", function () { FILT = {}; filterChanged(); });
  // Favourites tab: each starred clue with no hints; Parse shows its parsing in place, and tapping it opens the clue.
  // Home tabs: "" (the puzzle list), "favs", "stats" or "make" (Create); tapping the open tab's button goes back to the list.
  var TAB = "";
  ["favs", "stats", "make"].forEach(function (t) { $(t + "Btn").addEventListener("click", function () { TAB = TAB === t ? "" : t; showHome(); }); });
  // A favourite's answer, from the puzzle's grid and solution (or the solver's own answer, from its record s if given),
  // without loading the puzzle.
  function rawAnswer(p, k, s) {
    var R0 = p.grid.length, C0 = p.grid[0].length, at = pc(p).at, flat = solOf(p);
    var open = function (r, c) { return r >= 0 && r < R0 && c >= 0 && c < C0 && p.grid[r][c] !== "#"; };
    if (!at) { at = pc(p).at = {}; slotsOf(p.grid).forEach(function (w) { at[w.num] = w.cells[0]; }); }  // the square each clue number starts on, found once
    var a = ((s || store.peek("crossword:" + p.id) || {}).answers || {})[k] || ((linksFor(p).filter(function (g) { return g[0] === k; })[0] || [k]).map(function (x) {
      var s = "", rc = at[x.slice(1)] || [-1, -1], dr = x[0] === "d" ? 1 : 0;
      for (var rr = rc[0], cc = rc[1]; open(rr, cc); rr += dr, cc += 1 - dr) s += flat[rr * C0 + cc] || "";
      return s;
    }).join(""));
    return a && a.indexOf("?") < 0 ? a : "";
  }
  function answerOf(p, k, clue) {
    var a = rawAnswer(p, k);
    if (!a) return "The answer isn\u2019t known yet.";
    var br = seps(parseEnum(joinEnum(clue)));
    return Array.from(a).map(function (ch, i) { return ch + (br[i] || ""); }).join("");
  }
  // Shown once the starred clues' puzzles are read (full); FAVT drops an older showing still reading.
  var FAVT = 0;
  function showFavs() {
    var byId = {}, tk = ++FAVT;
    PUZZLES.forEach(function (p) { byId[p.id] = p; });
    var list = favs().filter(function (f) { return byId[f.p]; });
    Promise.all(list.map(function (f) { return full(byId[f.p]).catch(function () { return null; }); })).then(function (ps) {
      if (tk === FAVT) favList(list.filter(function (f, i) { return byId[f.p] = ps[i]; }), byId);
    });
  }
  function favList(list, byId) {
    var box = $("favList");
    box.innerHTML = "";
    if (!list.length) { var e = mk("p", "hempty", "No favourites yet. Tap the star by a clue to add it."); box.appendChild(e); }
    list.forEach(function (f) {
      var p = byId[f.p], dir = f.k[0], num = f.k.slice(1);
      var el = mk("div", "clue");
      var b = mk("b", "fn", num);
      var s = mk("span", null, (p[dir === "a" ? "across" : "down"] || {})[num] || "");
      s.appendChild(mk("small", "fm", (dir === "a" ? "Across" : "Down") + " \u00b7 " + p.title + " \u00b7 " + metaText(p)));
      var fb = mk("div", "fb");
      // Each button shows its line under the clue, or hides it again; the answer line stays above the parsing.
      [["Solution", "pans", function (x) { x.textContent = answerOf(p, f.k, s.firstChild.textContent); }],
       ["Parse", "pwp", function (x) {
        var mine = ((store.peek("crossword:" + p.id) || {}).parses || {})[f.k], blog = ((jsonOf(p, "parses") || {})[dir] || {})[num];
        if (mine && mine.off) mine = null;
        var r = mine || blog || { type: "Not parsed", wordplay: "No parsing for this clue yet." };
        var t = mk("i", null, ctype(r.type)); var wp = mk("span"); markup(wp, r.wordplay || "");
        x.appendChild(t); x.appendChild(wp);
        if (mine) x.appendChild(mk("small", null, " \u00b7 " + editedBy()));
      }]].forEach(function (d) {
        var bt = document.createElement("button"); bt.type = "button"; bt.className = "btn mini"; bt.textContent = d[0];
        bt.addEventListener("click", function (e) {
          e.stopPropagation();
          var x = el.querySelector("." + d[1]);
          bt.classList.toggle("solid", !x);
          if (x) return el.removeChild(x);
          x = mk("p", d[1]); d[2](x);
          el.insertBefore(x, d[1] === "pans" ? el.querySelector(".pwp") : null);
        });
        fb.appendChild(bt);
      });
      el.appendChild(b); el.appendChild(s); el.appendChild(fb);
      el.addEventListener("click", function () {
        openPuzzle(p).then(function () {
          var i = words.findIndex(function (w) { return w.dir === dir && String(w.num) === num; });
          if (i < 0) i = words.findIndex(function (w) { return (w.parts || []).some(function (x) { return x.dir === dir && String(x.num) === num; }); });
          if (i >= 0) gotoWord(i);
        });
      });
      box.appendChild(el);
    });
  }
  // Quickfire: random clues from finished puzzles (solved or DNF), one at a time in a one-row grid with the Easy
  // tools. Nothing is saved, so its hints and reveals never count; the clue-type filter is kept on this device.
  var QF = null;  // {pool, c: the clue in play, name}
