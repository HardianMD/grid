  function build() {
    $("title").textContent = P.title.replace(/ No\. /, " ");
    $("meta").textContent = metaText(P);
    $("infoBtn").hidden = !P.note || !!P.ed;
    var g = $("grid");
    g.innerHTML = ""; g.classList.remove("no");  // a wrong Quickfire answer's flash would replay on the new cells
    g.style.gridTemplateColumns = "repeat(" + C + ", var(--cs))";
    g.style.gridTemplateRows = "repeat(" + R + ", var(--cs))";
    cellEls = [];
    for (var r = 0; r < R; r++) {
      cellEls.push([]);
      for (var c = 0; c < C; c++) {
        var d = document.createElement("div"), cell = cells[r][c];
        d.className = "c" + (cell.b ? " b" : "");
        d.setAttribute("role", "gridcell");
        d.dataset.r = r; d.dataset.c = c;
        if (!cell.b) {
          if (cell.num) d.appendChild(mk("span", "n", cell.num));
          d.appendChild(mk("span", "l"));
        }
        g.appendChild(d); cellEls[r].push(d);
      }
    }
    words.forEach(function (w) {
      w.breaks.forEach(function (b) {
        var rc = w.cells[b.after];
        if (!rc || w.ends.indexOf(b.after) >= 0) return;
        var cls = (w.cdir[b.after] === "a" ? (b.kind === "," ? "br" : "hr") : (b.kind === "," ? "bb" : "hb"));
        cellEls[rc[0]][rc[1]].classList.add(cls);
      });
    });
    ["acrossList", "downList"].forEach(function (id) { $(id).innerHTML = ""; });
    var items = [];
    words.forEach(function (w, i) {
      var el = document.createElement("div");
      el.className = "clue"; el.tabIndex = 0; el.dataset.i = i;
      var b = mk("b", null, numsOf(w));
      var s = document.createElement("span"); w.span = s; clueInto(s, w);
      el.appendChild(b); el.appendChild(s);
      w.el = el; items.push({ dir: w.dir, num: w.num, el: el });
    });
    SEES.forEach(function (t) {
      var el = document.createElement("div"), h = t.head;
      el.className = "clue see"; el.tabIndex = 0; el.dataset.i = words.indexOf(h);
      var b = mk("b", null, t.num);
      var s = mk("span", null, "See " + h.num + (h.dir !== t.dir ? (h.dir === "a" ? " Across" : " Down") : ""));
      el.appendChild(b); el.appendChild(s); items.push({ dir: t.dir, num: t.num, el: el });
    });
    items.sort(function (x, y) { return x.num - y.num; }).forEach(function (it) {
      $(it.dir === "a" ? "acrossList" : "downList").appendChild(it.el);
    });
    size();
  }

  // A clue's number as the clue list shows it: linked answers list every part ("1, 6d").
  function numsOf(w) { return w.parts ? w.parts.map(function (x) { return x.num + (x.dir === w.dir ? "" : x.dir); }).join(", ") : w.num; }

  function isWide() { return window.matchMedia("(min-width: 900px) and (min-height: 700px), (min-width: 900px) and (pointer: fine)").matches; }

  function size() {
    if (!P) return;
    var pad = getComputedStyle($("app").querySelector(".gridwrap"));
    var inner = $("app").clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    var wide = isWide(), bar = $("solvedBar"), cs;
    // Wide screens: the grid fills the window's height above the buttons and, once finished, the finish bar (measured
    // at the grid's width, so its height is known on the second pass).
    for (var i = 0; i < (wide && !bar.hidden ? 2 : 1); i++) {
      var side = wide ? Math.min(inner * 0.6, $("main").clientHeight - $("checks").offsetHeight - (i ? bar.offsetHeight + 8 : 0) - 8) : inner;
      cs = Math.floor((Math.max(180, side) - 4 - (C - 1)) / C);
      $("checks").style.maxWidth = bar.style.maxWidth = wide ? (cs * C + C + 3) + "px" : "";
    }
    if (P.qf || P.bank) cs = qfLines(inner);
    $("grid").style.setProperty("--cs", cs + "px");
    // Phones: a finished grid shrinks so the finish bar fits on screen with the clue box and keys.
    var over = isWide() || $("solvedBar").hidden ? 0 : $("main").scrollHeight - $("main").clientHeight;
    if (over > 0) $("grid").style.setProperty("--cs", Math.max(10, cs - Math.ceil(over / R)) + "px");
    var home = isWide() || P.bank ? $("main") : $("app").querySelector(".dock");
    if ($("clues").parentNode !== home) home.appendChild($("clues"));
  }

  // Quickfire squares run at most QF_LINE to a line, wrapping between words where they can; returns the square size.
  var QF_LINE = 10;
  function qfLines(inner) {
    var lines = [[]], g = $("grid"), cs = 52;
    g.querySelectorAll(".qbr").forEach(function (x) { x.remove(); });
    cellEls[0].forEach(function (el) { el.classList.remove("eol"); });
    var ends = words[0].breaks.map(function (b) { return b.after; }).concat(C - 1), from = 0;
    ends.forEach(function (end) {
      // A word that won't fit starts a new line; one longer than a line is split into even parts.
      var len = end - from + 1, part = len > QF_LINE ? Math.ceil(len / Math.ceil(len / QF_LINE)) : len;
      for (var i = from; i <= end; i++) {
        var line = lines[lines.length - 1];
        if (line.length && (i === from ? line.length + Math.min(len, part) > QF_LINE : (i - from) % part === 0)) lines.push(line = []);
        line.push(i);
      }
      from = end + 1;
    });
    lines.forEach(function (line, n) {
      var gaps = line.filter(function (i) { return ends.indexOf(i) >= 0 && i !== line[line.length - 1]; }).length;
      cs = Math.min(cs, Math.floor((inner - 4 * (line.length - 1) - 8 * gaps) / line.length));
      if (!n) return;
      var br = mk("i", "qbr");
      g.insertBefore(br, cellEls[0][line[0]]); cellEls[0][line[0] - 1].classList.add("eol");
    });
    return cs;
  }
  function curWord(s) { s = s || sel; return words[cells[s.r][s.c][s.dir]]; }
  function filled(w) { return w.cells.every(function (rc) { return fill[rc[0]][rc[1]]; }); }

  function render() {
    var w = curWord(), other = cells[sel.r][sel.c][sel.dir === "a" ? "d" : "a"];
    var inWord = {};
    w.cells.forEach(function (rc) { inWord[rc[0] + "," + rc[1]] = 1; });
    var inCross = {};
    if (other >= 0) words[other].cells.forEach(function (rc) { inCross[rc[0] + "," + rc[1]] = 1; });
    var total = 0, done = 0, bad = 0, gap = 0, g = helpOf({ used: USED, mode: MODE, hn: HN, rev: REV, revw: REVW }), revDnf = g.rd;
    // Revealed squares are amber; a marked Hard or Competition grid shows right squares green and wrong or blank ones amber. REVW lists, per revealed answer, the
    // squares the reveal filled (1: all of them), so crossing letters already green stay green.
    var rv = {};
    words.forEach(function (x) {
      var v = REVW[x.dir + x.num];
      if (v) x.cells.forEach(function (rc, i) { if (v === 1 || v.indexOf(i) >= 0) rv[rc[0] + "," + rc[1]] = 1; });
    });
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      if (cells[r][c].b) continue;
      var el = cellEls[r][c], k = r + "," + c, a = SUB && solAt(r, c);
      total++; if (fill[r][c]) done++;
      if (a && fill[r][c] !== a) { bad++; if (!fill[r][c]) gap++; }
      el.classList.toggle("rv", !!rv[k] || (!!a && fill[r][c] !== a));
      el.classList.toggle("word", !!inWord[k]);
      el.classList.toggle("cross", !inWord[k] && !!inCross[k]);
      el.classList.toggle("cur", r === sel.r && c === sel.c);
      el.classList.toggle("ok", !!a ? fill[r][c] === a : !HARD && !SUB && (solved || !!ok[k]));  // a solved Easy or Medium grid is green throughout (a submitted one is unmarked)
      el.lastChild.textContent = fill[r][c];
    }
    var fl = favs(), nh = noHints();
    words.forEach(function (x) {
      x.el.classList.toggle("on", x === w);
      x.el.classList.toggle("fav", isFav(fl, P.id, x.dir + x.num));
      var k = x.dir + x.num, sig = [HARD, nh, hinted[k] || 0, hinted[k] ? parseFor(x).type : "", myDefs[k] || ""].join("|");
      if (x.sig !== sig) { x.sig = sig; clueInto(x.span, x); }
      x.el.classList.toggle("done", filled(x));
      x.el.classList.toggle("right", !HARD && !SUB && (solved || x.cells.every(function (rc) { return ok[rc[0] + "," + rc[1]]; })));
      x.el.classList.toggle("rev", !!REVW[x.dir + x.num]);  // a revealed answer's number is amber, not green
    });
    $("nowTag").textContent = P.bank ? "Clue" : !P.qf ? wordName(w) : locked(w) ? QF.c.p.title + " \u00b7 " + QF.name : "Clue";
    var fv = isFav(fl, P.id, w.dir + w.num);
    $("favBtn").classList.toggle("on", fv); $("favBtn").setAttribute("aria-pressed", String(fv));
    clueInto($("nowTxt"), w);
    $("now").classList.toggle("long", $("nowTxt").textContent.length > 70);
    // A clue that still overflows its box (large text on a small phone) steps down in size, to 12px at the least.
    var nb = $("now"); nb.style.fontSize = "";
    for (var fz = parseFloat(getComputedStyle(nb).fontSize); nb.scrollHeight > nb.clientHeight + 1 && fz > 12;) nb.style.fontSize = --fz + "px";
    // Any filled word can be looked up, in every mode, and is looked up in the background as soon as it is filled.
    $("dictBtn").hidden = !filled(w) && !P.qf;  // Quickfire always shows it, and asks for the squares first
    $("findBtn").hidden = !!P.qf || CHAMP || prefs().find === false || locked(w);  // never in Competition; Settings can switch it off
    $("wheelBtn").hidden = P.qf && locked(w);  // a solved or revealed Quickfire clue swaps the wheel for the dictionary
    words.forEach(function (x) { if (filled(x)) lookup(answerText(x)); });
    // Check needs a known answer; Competition never checks or hints, and a submitted grid is final.
    $("checkWordBtn").hidden = !known(w);
    $("chk").hidden = CHAMP || !!SUB || solved || !words.some(known); pop("chkPop", false); pop("hintPop", false);
    // With a square filled, Hard and Competition can give up with the rest blank; Easy and Medium submit a full grid whose answers aren't out.
    $("submitBtn").hidden = solved || !done || !HARD && (!!SOL || done < total);
    $("noAns").hidden = !!SUB || words.some(known) || !$("submitBtn").hidden;  // in the Hint slot until the answers arrive, or Submit shows
    BLANKS = total - done;
    // A prize puzzle (P.entry from the updater: the closing date and an email address `to` or postal address lines `post`)
    // offers the full grid as an entry until it closes: by email, or as a page to print and post.
    var open = P.entry && !P.qf && !P.ed && done === total && new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10) <= P.entry.by;
    $("clearBtn").hidden = solved; $("clearBtn").disabled = !done;  // first after the clue list, so the row never shifts
    $("mailBtn").hidden = !(open && P.entry.to); $("postBtn").hidden = !(open && P.entry.post);
    $("hintWrap").hidden = (HARD && !solved) || (!SOL && !DEFS && !PARSES);
    $("hintBtn").textContent = { parse: "Parse", add: "Add answer", hint: "Hint", reveal: "Reveal" }[nextAction(w)];
    if (!solved && done && USED === 3) USED = RANK[MODE];
    if (SOL && !HARD && !solved && !P.qf && done === total && allRight()) {
      stopClock(); solved = true; save();
      toast("Solved in " + fmt(elapsed));
      return render();
    }
    $("timer").classList.toggle("stopped", solved);
    var bl = solved && blogFor(P);
    var barWas = !$("solvedBar").hidden;
    $("solvedBar").hidden = !solved || !!P.qf;
    $("app").classList.toggle("fin", solved && !P.qf);
    $("qfSolve").disabled = locked(w);
    $("nitchBtn").hidden = !(solved && P.nitch);
    if (solved && P.nitch) { $("nitchBtn").textContent = ngrade(P.nitch.n); $("nitchBtn").style.background = ncol(P.nitch.n); }
    $("solvedBar").classList.toggle("dnf", revDnf || (!!SUB && SUB.res === "dnf"));
    if (solved) {
      var nr = g.rv, help = helpText(g);
      $("solvedTxt").textContent = revDnf && !(SUB && SUB.res === "dnf") ? (help ? "DNF in " + fmt(elapsed) + " - " + help : "DNF in " + fmt(elapsed) + ": " + (nr ? plural(nr, "answer") : "answers") + " revealed")
        : !SUB && help ? "\u2713 Solved in " + fmt(elapsed) + " - " + help
        : !SUB ? "\u2713 Solved in " + fmt(elapsed) : SUB.res === "ok" ? "\u2713 Finished in " + fmt(elapsed)
        : SUB.res === "dnf" ? dnfText(elapsed, bad, gap) : "Submitted in " + fmt(elapsed) + ". The answers aren\u2019t out yet";
      $("blogLink").hidden = !bl;
      // A grid submitted before its answers are out hasn't been marked, so it can still be reopened: once in Hard, as often
      // as wanted in Easy or Medium (with no Hard or Competition play recorded) until the parsings arrive, never in Competition.
      $("editBtn").hidden = !(SUB && !SUB.res && (HARD ? MODE === "hard" && !EDITED : USED < RANK.hard && !PARSES));
      if (bl) { $("blogLink").href = bl.url; $("blogLink").textContent = "Blog \u2197"; $("blogLink").title = bl.exact ? "Read the blog" : "Find the blog"; }
    }
    if ((solved || barWas) && !P.qf) size();
    scrollClue(w.el);
  }

  // Timer: counts up while the page is open and visible, stops when every answer is right.
  function now() { return elapsed + (since ? Date.now() - since : 0); }
  function fmt(ms) { var t = Math.floor(ms / 1000), m = Math.floor(t / 60), sec = t % 60; return m + ":" + (sec < 10 ? "0" : "") + sec; }
  function tick() { $("timer").textContent = fmt(now()); }
  function startClock() { if (!solved && since === null && !document.hidden && $("home").hidden) since = Date.now(); tick(); }
  function stopClock() { elapsed = now(); since = null; tick(); }
  function allRight() {
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      if (cells[r][c].b) continue;
      var a = solAt(r, c);
      if (!fill[r][c] || (a && fill[r][c] !== a)) return false;
    }
    return true;
  }
  setInterval(function () { if (since !== null) { tick(); if (Math.floor(now() / 1000) % 5 === 0) save(); } }, 1000);
  // Hidden: save and upload now (iOS may not come back). Changes from other devices arrive through cloudListen.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (P) { stopClock(); save(); } cloudFlush(); }
    else if (P) startClock();
  });
  window.addEventListener("pagehide", function () { if (P) save(); cloudFlush(); });

  function scrollClue(el) {
    if (!isWide()) return;
    var box = $("main"), top = el.offsetTop - box.offsetTop, h = el.offsetHeight;
    if (top < box.scrollTop + 24 || top + h > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: Math.max(0, top - 30), behavior: "smooth" });
    }
  }

  function select(r, c, dir) {
    var cell = cells[r][c];
    if (cell.b || cell.a < 0 && cell.d < 0) return;  // a draft's square in no answer
    if (cell[dir] < 0) dir = dir === "a" ? "d" : "a";
    sel = { r: r, c: c, dir: dir };
    render(); save();
  }

  function tapCell(r, c) {
    var cell = cells[r][c];
    if (cell.b) return;
    if (sel.r === r && sel.c === c) {
      var nd = sel.dir === "a" ? "d" : "a";
      if (cell[nd] >= 0) select(r, c, nd);
      return;
    }
    select(r, c, cell.a >= 0 ? "a" : "d");
  }

  function firstEmpty(w) {
    for (var i = 0; i < w.cells.length; i++) if (!fill[w.cells[i][0]][w.cells[i][1]]) return w.cells[i];
    return w.cells[0];
  }

  function gotoWord(i) {
    var w = words[i], rc = firstEmpty(w);
    sel = { r: rc[0], c: rc[1], dir: w.cdir[w.cells.indexOf(rc)] };
    render(); save();
  }

  function nextWord(step) {
    var cur = cells[sel.r][sel.c][sel.dir], n = words.length;
    for (var k = 1; k <= n; k++) {
      var i = ((cur + step * k) % n + n) % n;
      if (!filled(words[i])) return gotoWord(i);
    }
    gotoWord(((cur + step) % n + n) % n);
  }

  // Typing moves one square at a time. On a green (checked) square, the same letter just steps over it;
  // a different letter lands in the next square instead.
  function typeLetter(ch) {
    var w = curWord(), idx = indexIn(w), wasFull = filled(w);
    var k = sel.r + "," + sel.c;
    if (lockedCell(k) && fill[sel.r][sel.c] !== ch) {
      var nx = w.cells[idx + 1];
      if (!nx) return;
      sel = { r: nx[0], c: nx[1], dir: w.cdir[idx + 1] };
      return typeLetter(ch);
    }
    put(sel.r, sel.c, ch);
    var pf = prefs(), nx2 = idx + 1;
    if (!wasFull && filled(w)) { flash(w); if (pf.jump) { save(); return nextWord(1); } }
    // Skip filled squares: the next empty one in the word, if any.
    for (var j = nx2; pf.skip && j < w.cells.length; j++) if (!fill[w.cells[j][0]][w.cells[j][1]]) { nx2 = j; break; }
    var rc = w.cells[nx2];
    if (rc) sel = { r: rc[0], c: rc[1], dir: w.cdir[nx2] };
    render(); save();
  }

  // A letter into a square that isn't locked; a changed letter is no longer checked.
  function put(r, c, ch) { var k = r + "," + c; if (lockedCell(k)) return; if (fill[r][c] !== ch) delete ok[k]; fill[r][c] = ch; }
  function indexIn(w) {
    for (var i = 0; i < w.cells.length; i++) if (w.cells[i][0] === sel.r && w.cells[i][1] === sel.c) return i;
    return 0;
  }

  function del() {
    var w = curWord(), idx = indexIn(w);
    if (fill[sel.r][sel.c] && !lockedCell(sel.r + "," + sel.c)) put(sel.r, sel.c, "");
    else if (idx > 0) {
      var rc = w.cells[idx - 1];
      sel = { r: rc[0], c: rc[1], dir: w.cdir[idx - 1] };
      put(rc[0], rc[1], "");
    }
    render(); save();
  }

  // Known letter for a square: the stored solution, else an answer the solver added; null when nobody knows it.
  function solAt(r, c) {
    var v = SOL && SOL[r] && SOL[r][c];
    if (v && v !== "?") return v;
    return userSol[r + "," + c] || null;
  }
  function known(w) {
    var key = w.dir + w.num;
    if (UNSOLVED[key] && !userAns[key]) return false;
    return w.cells.every(function (rc) { return solAt(rc[0], rc[1]); });
  }
  function hasDef(w) { return hintSpans(w).length > 0; }
  function hasType(w) { return !!(PARSES && PARSES[w.dir] && PARSES[w.dir][w.num]); }
  // What the Hint button does next for this clue: the hints not yet shown (the definition, the clue type), then Reveal.
  function hintsLeft(w) { var k = w.dir + w.num; return { def: !hintDef(k) && hasDef(w), type: !hintType(k) && hasType(w) }; }
  function nextAction(w) {
    var h = hintsLeft(w);
    if (locked(w)) return "parse";
    if (!known(w)) return "add";
    return h.def || h.type ? "hint" : "reveal";
  }

  // Check: wrong letters are removed, right ones stay; a fully right word turns green and locks.
  // Squares nobody knows the answer to are left alone.
  function check(list) {
    if (MED || HARD) return checkWords(list);
    var removed = 0, right = 0, unknown = 0;
    list.forEach(function (w) {
      w.cells.forEach(function (rc) {
        var v = fill[rc[0]][rc[1]], a = solAt(rc[0], rc[1]);
        if (v && a && v !== a) { fill[rc[0]][rc[1]] = ""; removed++; }
      });
      if (!known(w)) { unknown++; return; }
      if (filled(w)) { right++; w.cells.forEach(function (rc) { ok[rc[0] + "," + rc[1]] = 1; }); }
    });
    render(); save();
    return { removed: removed, right: right, unknown: unknown };
  }

  // Medium and Hard: right words are marked (green in Medium only); a word with any wrong letter is emptied, keeping marked squares.
  function checkWords(list) {
    var cleared = 0, right = 0, unknown = 0, bad = [];
    list.forEach(function (w) {
      if (!known(w)) { unknown++; return; }
      var wrong = w.cells.some(function (rc) { var v = fill[rc[0]][rc[1]], a = solAt(rc[0], rc[1]); return v && a && v !== a; });
      if (wrong) bad.push(w);
      else if (filled(w)) { right++; w.cells.forEach(function (rc) { ok[rc[0] + "," + rc[1]] = 1; }); }
    });
    bad.forEach(function (w) {
      w.cells.forEach(function (rc) { if (!ok[rc[0] + "," + rc[1]]) fill[rc[0]][rc[1]] = ""; });
      cleared++;
    });
    render(); save();
    return { cleared: cleared, right: right, unknown: unknown, removed: 0 };
  }

  function plural(n, s) { return n + " " + s + (n === 1 ? "" : "s"); }
  // A submitted grid marked wrong: bad squares wrong or blank, gap of them blank.
  function dnfText(t, bad, gap) { return "DNF in " + fmt(t) + ": " + (gap ? (bad > gap ? plural(bad - gap, "wrong square") + ", " : "") + gap + " blank" : plural(bad, "wrong square")); }

  // Submitted grid (Hard, Competition, or Easy and Medium before the answers are out): SUB.res is "ok" when every known square is right, "dnf" when any is wrong, "" while no answers are known.
  function grade() {
    var any = false, bad = 0;
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      var a = !cells[r][c].b && solAt(r, c);
      if (!a) continue;
      any = true; if (fill[r][c] !== a) bad++;
    }
    SUB.res = !any ? "" : bad ? "dnf" : "ok";
    return bad;
  }
  // A submitted grid can't be changed, so Submit asks first; in Hard and Competition, submitting with blank squares is giving up.
  // A yes/cancel question in the hint pop-up; its yes button acts on askMode.
  function askReset(no) {
    $("clueForm").hidden = $("clueParse").hidden = $("parseNote").hidden = $("parseForm").hidden = $("parseEdit").hidden = $("parseReset").hidden = $("parseView").hidden = $("findBox").hidden = true;
    $("hintText").hidden = false; $("hintNo").hidden = false; $("hintNo").textContent = no; $("hintYes").hidden = false;
  }
  function confirmAsk(mode, title, text, yes) {
    askMode = mode; askReset("Cancel");
    $("ansRow").hidden = true;
    $("hintTitle").textContent = title; $("hintText").textContent = text;
    $("hintYes").textContent = yes;
    $("hintAsk").hidden = false;
  }
  $("submitBtn").addEventListener("click", function () {
    confirmAsk("submit", BLANKS ? "Give up?" : "Submit puzzle?",
      (BLANKS ? plural(BLANKS, "square") + (BLANKS === 1 ? " is" : " are") + " still blank, so this will be a DNF. " : "") +
      (!HARD ? "The answers aren't out yet. The timer stops now, and until the parsings arrive you can reopen the grid with Edit as often as you like."
        : MODE === "hard" && !words.some(known) && !EDITED ? "The answers aren't out yet, so until they are you can reopen it once with Edit. Are you sure?" : "A submitted grid can't be changed. Are you sure?"),
      BLANKS ? "Give up" : "Submit");
  });
  function submit() {
    stopClock(); solved = true; SUB = { at: Date.now() }; grade();
    save(); render();
    toast(SUB.res === "ok" ? "Finished in " + fmt(elapsed) : SUB.res === "dnf" ? "DNF" : "Submitted");
  }

  $("editBtn").addEventListener("click", function () {
    confirmAsk("unsubmit", "Edit your grid?", "The answers aren't out yet, so your grid hasn't been marked. It will open again for you to change, " +
      "and the timer carries on from " + fmt(elapsed) + (!HARD ? ". You can do this as often as you like until the parsings arrive." : ". You can only do this once: after you submit again, the grid is final."), "Edit grid");
  });

  // The tick opens the two checks (and Hint its two hints); any other tap closes them.
  function pop(id, on) { $(id).hidden = !on; $(id).previousElementSibling.setAttribute("aria-expanded", on); }
  $("checkBtn").addEventListener("click", function () { pop("chkPop", $("chkPop").hidden); });
  document.addEventListener("click", function (e) {
    ["chkPop", "hintPop"].forEach(function (id) { if (!$(id).parentNode.contains(e.target) || $(id).contains(e.target)) pop(id, false); });
  }, true);
  $("checkWordBtn").addEventListener("click", function () {
    var res = check([curWord()]);
    if (MED || HARD) return toast(res.right ? "Correct" : res.cleared ? "Not right – word cleared" : "Nothing wrong so far");
    if (res.right) toast("Correct");
    else if (res.removed) toast("Removed " + plural(res.removed, "wrong letter"));
    else toast("No wrong letters yet");
  });
  $("checkAllBtn").addEventListener("click", function () {
    var res = check(words), tail = res.unknown ? ". " + plural(res.unknown, "clue") + " couldn't be checked" : "";
    if (res.right === words.length) toast("Puzzle complete");
    else if (MED || HARD) toast((res.cleared ? "Cleared " + plural(res.cleared, "wrong word") + ", " : "No wrong words, ") + plural(res.right, "word") + " correct" + tail);
    else if (res.removed) toast("Removed " + plural(res.removed, "wrong letter") + ", " + plural(res.right, "word") + " correct" + tail);
    else toast("No wrong letters, " + plural(res.right, "word") + " correct" + tail);
  });

  function move(dr, dc) {
    var r = sel.r, c = sel.c, dir = dc ? "a" : "d";
    if (sel.dir !== dir && cells[r][c][dir] >= 0) return select(r, c, dir);
    do { r += dr; c += dc; } while (r >= 0 && r < R && c >= 0 && c < C && cells[r][c].b);
    if (r >= 0 && r < R && c >= 0 && c < C) select(r, c, dir);
  }

  function flash(w) {
    w.cells.forEach(function (rc) { var el = cellEls[rc[0]][rc[1]]; el.animate && el.animate([{ filter: "brightness(1.15)" }, { filter: "none" }], { duration: 350 }); });
  }

  // The grid as a picture (squares, numbers, letters), shared to be saved where the device can share files, else downloaded; then an
  // email opens with the address, subject and answers, to attach it to. A share to Mail drops the subject and address, and iPhone
  // opens an email only from a tap, so there each step asks first (askMode "entry", then "email"; ENTRY holds the picture and email).
  var ENTRY = null;
  function entryShare() {
    navigator.share({ files: [ENTRY.f] }).catch(function () {}).then(function () {
      confirmAsk("email", "Open the email?", "Mail opens with the address, subject and answers filled in. Attach the picture you saved to it.", "Open email");
    });
  }
  $("mailBtn").addEventListener("click", function () {
    var s = 40, m = 20, top = 56, cv = document.createElement("canvas"), x = cv.getContext("2d");
    cv.width = C * s + 2 * m; cv.height = R * s + top + m;
    x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height);
    x.fillStyle = "#000"; x.font = "bold 20px sans-serif"; x.fillText(P.title, m, 34);
    x.lineWidth = 1.5; x.textAlign = "center"; x.textBaseline = "middle";
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      var px = m + c * s, py = top + r * s;
      if (cells[r][c].b) { x.fillRect(px, py, s, s); continue; }
      x.strokeRect(px, py, s, s);
      x.font = "24px sans-serif"; x.fillText(fill[r][c], px + s / 2, py + s / 2 + 3);
      if (cells[r][c].num) { x.textAlign = "left"; x.font = "10px sans-serif"; x.fillText(cells[r][c].num, px + 2, py + 8); x.textAlign = "center"; }
    }
    var url = cv.toDataURL("image/png"), bin = atob(url.split(",")[1]), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    var f = new File([a], P.id + ".png", { type: "image/png" }), to = P.entry.to, sub = P.entry.subject || P.title;
    // The answers, then the sender's name, address and phone from Settings (as on a postal entry).
    var me = store.get("crossword:post") || {}, who = [me.name, me.addr, me.phone].filter(function (v) { return v; }).join("\n");
    var text = entryAnswers().map(function (l) { return l.join("\n"); }).join("\n\n") + (who ? "\n\n" + who : "");
    ENTRY = { f: f, mail: "mailto:" + to + "?subject=" + encodeURIComponent(sub) + "&body=" + encodeURIComponent(text) };
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      return confirmAsk("entry", "Email your entry", "First save the picture: choose Save Image, not Mail. Then Mail opens with the address, subject and answers, and you attach the picture.", "Save picture");
    }
    var d = mk("a"); d.href = url; d.download = f.name; d.click();
    toast("Picture saved: attach it to the email");
    location.href = ENTRY.mail;
  });

  // Every answer in capitals under its clue number: [Across lines, Down lines], each list headed by its name.
  function entryAnswers() {
    return ["a", "d"].map(function (d) {
      return [d === "a" ? "Across" : "Down"].concat(words.filter(function (w) { return w.dir === d; }).sort(function (x, y) { return x.num - y.num; })
        .map(function (w) { return numsOf(w) + " " + answerText(w).toUpperCase(); }));
    });
  }
  // A postal entry: an A4 PDF to print, with the entry address at the top, the sender's details from Settings (lines to
  // write on where none are saved), the filled grid and the answers in two columns.
  $("postBtn").addEventListener("click", function () {
    var PW = 595, PH = 842, M = 50, o = "", y = PH - M, me = store.get("crossword:post") || {}, f = function (n) { return +n.toFixed(2); };
    var esc = function (s) { return String.fromCharCode.apply(null, lat(s)).replace(/[\\()]/g, "\\$&"); };
    var wid = function (s, z) { return lat(s).reduce(function (n, c) { return n + +(FW.H[c - 32] || 556); }, 0) * z * 1.06 / 1000; };  // Helvetica-Bold
    var text = function (s, x, y, ft, z) { o += "BT /" + ft + " " + z + " Tf " + f(x) + " " + f(y) + " Td (" + esc(s) + ") Tj ET\n"; };
    text("Entries to:", M, y, "H", 10); y -= 18;
    P.entry.post.forEach(function (l) { text(l, M, y, "HB", 13); y -= 17; });
    y -= 12; text("From:", M, y, "H", 10); y -= 20;
    var addr = (me.addr || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    [["Name", me.name]].concat((addr.length ? addr : ["", ""]).map(function (l, i) { return [i ? "" : "Address", l]; }), [["Phone", me.phone]]).forEach(function (r) {
      if (r[0]) text(r[0], M, y, "H", 10);
      if (r[1]) text(r[1], M + 60, y, "H", 12); else o += "0.5 w " + (M + 60) + " " + f(y - 3) + " m " + (PW - M) + " " + f(y - 3) + " l S\n";
      y -= 20;
    });
    y -= 8; text(P.title, M, y, "HB", 14); y -= 14;
    var s = Math.min(22, (PW - 2 * M) / C), gx = (PW - C * s) / 2;
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      var x = gx + c * s, yy = y - (r + 1) * s;
      if (cells[r][c].b) { o += f(x) + " " + f(yy) + " " + f(s) + " " + f(s) + " re f\n"; continue; }
      o += "0.6 w " + f(x) + " " + f(yy) + " " + f(s) + " " + f(s) + " re S\n";
      if (cells[r][c].num) text(cells[r][c].num, x + 1.5, yy + s - 6.5, "H", 6);
      if (fill[r][c]) text(fill[r][c], x + (s - wid(fill[r][c], s * .55)) / 2, yy + s * .22, "HB", f(s * .55));
    }
    y -= R * s + 24;
    var cols = entryAnswers(), lh = Math.min(12, (y - M) / Math.max(cols[0].length, cols[1].length));
    cols.forEach(function (l, i) { l.forEach(function (t, j) { text(t, i ? PW / 2 : M, y - j * lh, j ? "H" : "HB", Math.min(10, lh - 1)); }); });
    giveFile(new File([pdfDoc([o], { H: "Helvetica", HB: "Helvetica-Bold" }, PW, PH)], P.id + " entry.pdf", { type: "application/pdf" }));
  });

  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 1600);
  }

  // Keyboard
  var ROWS = ["QWERTYUIOP", "ASDFGHJKL", "↕ZXCVBNM⌫"];
  ROWS.forEach(function (row) {
    var d = mk("div", "row");
    Array.from(row).forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "key"; b.textContent = k; b.dataset.k = k;
      if (k === "⌫") { b.classList.add("wide"); b.setAttribute("aria-label", "Delete"); }
      if (k === "↕") { b.classList.add("wide"); b.setAttribute("aria-label", "Switch across or down"); }
      d.appendChild(b);
    });
    $("kb").appendChild(d);
  });
  // Anagram wheel: letters come from the current answer; keys add or remove letters while it is open.
  var AW = { open: false, tiles: [], slots: [], word: null, size: 260 };
