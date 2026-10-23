  // The list shows two weeks, from today or from the newest puzzle the filters match; each View more adds the two
  // weeks before the newest puzzle still hidden.
  function weeks2(d) { var a = new Date(d + "T12:00:00"); a.setDate(a.getDate() - 13); return d ? a.toISOString().slice(0, 10) : ""; }
  var FROM = weeks2(new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10));
  function showHome(keepScroll) {
    if (P) { save(); stopClock(); }
    qfHead(false);
    checkSubs();
    ["favs", "stats"].forEach(function (t) { $(t + "Btn").classList.toggle("on", TAB === t); $(t + "Btn").setAttribute("aria-pressed", String(TAB === t)); });
    $("homeList").hidden = !!TAB; $("favList").hidden = TAB !== "favs"; $("statBody").hidden = TAB !== "stats";
    if (TAB) { $("fpanel").hidden = true; $("filterBtn").setAttribute("aria-expanded", "false"); if (TAB === "favs") showFavs(); else showStats(); }
    var list = $("homeList"), last = null;
    list.innerHTML = "";
    var all = PUZZLES.slice().sort(function (x, y) { return cmp(y.date || "", x.date || "") || cmp(y.id, x.id); });
    var pf = prefs(), hideDone = pf.hideDone && !(FILT.status || []).length;
    var match = all.filter(function (p) { return filterOk(p) && !(hideDone && (store.peek("crossword:" + p.id) || {}).solved); }), nf = filterCount();
    var from = match.length && !(match[0].date >= FROM) ? weeks2(match[0].date) : FROM;
    var shown = nf ? match : match.filter(function (p) { return p.date >= from; }), more = match[shown.length];  // a filter shows every match
    $("filterClear").hidden = !nf; $("filterBtn").classList.toggle("on", !!nf);
    $("filterBtn").textContent = nf ? "Filter (" + nf + ")" : "Filter";
    if (!match.length) { var e = document.createElement("p"); e.className = "hempty"; e.textContent = "No puzzles match these filters."; list.appendChild(e); }
    shown.forEach(function (p) {
      var g = progressOf(p), pub = pubOf(p);
      if (p.date !== last) {
        last = p.date;
        var h = document.createElement("h2"); h.className = "hday"; h.textContent = dayLabel(p.date); list.appendChild(h);
      }
      var b = document.createElement("button"), state = g.solved ? "done" : g.n ? "prog" : "new";
      b.type = "button"; b.className = "hitem " + state;
      var ht = document.createElement("div"); ht.className = "ht";
      if (pub) ht.appendChild(badgeEl(p));
      var tt = document.createElement("span"); tt.textContent = pub ? p.title.replace(new RegExp("^(The )?" + pub + "\\s+", "i"), "") : p.title; ht.appendChild(tt);
      var hm = document.createElement("div"); hm.className = "hm"; hm.textContent = metaText(p);
      if (pf.listN && p.nitch && (state === "done" || pf.listNWhen === "always"))
        hm.insertAdjacentHTML("beforeend", '<span class="nb" style="background:' + ncol(p.nitch.n) + '">' + ngrade(p.nitch.n) + " \u00b7 " + p.nitch.n + "</span>");
      var hs = document.createElement("div"); hs.className = "hs";
      if (state === "done") {
        if (g.dnf) b.classList.add("dnf");
        hs.textContent = g.dnf ? "DNF" : g.sub && !g.sub.res ? "Submitted" : "\u2713 Solved";
        var sm = document.createElement("small");
        sm.textContent = (g.mode ? g.mode.charAt(0).toUpperCase() + g.mode.slice(1) + " \u00b7 " : "") + fmt(g.time); hs.appendChild(sm);
      }
      else if (state === "prog") { hs.textContent = Math.round(100 * g.n / g.t) + "% filled"; var sm2 = document.createElement("small"); sm2.textContent = fmt(g.time); hs.appendChild(sm2); }
      else { var st = document.createElement("span"); st.className = "st"; st.textContent = "New"; hs.appendChild(st); }
      // Parsed means a blog's explanations are in; until then any parsings are unverified.
      if (!p.blog) { var pz = document.createElement("small"); pz.className = "pz"; pz.textContent = "Unparsed"; hs.appendChild(pz); }
      b.appendChild(ht); b.appendChild(hm); b.appendChild(hs);
      b.addEventListener("click", function () { openPuzzle(p); });
      list.appendChild(b);
    });
    if (more) {
      var mb = document.createElement("button"); mb.type = "button"; mb.className = "btn hmore"; mb.textContent = "View more";
      mb.addEventListener("click", function () { FROM = weeks2(more.date); showHome(true); });
      list.appendChild(mb);
    }
    // The summary counts every puzzle, not just those in view.
    var todo = 0, prog = 0, done = 0;
    PUZZLES.forEach(function (p) { var g = progressOf(p); if (g.solved) done++; else if (g.n) prog++; else todo++; });
    $("homeSum").textContent = todo + " new \u00b7 " + prog + " in progress \u00b7 " + done + " completed";
    $("home").hidden = false;
    if (keepScroll !== true) $("home").scrollTop = 0;
  }
  function openPuzzle(p) {
    var nl = notes(), left = nl.filter(function (n) { return n.id !== p.id; });
    if (left.length !== nl.length) setNotes(left);  // opening a puzzle, from the bell or the list, reviews its notification
    showList(false); qfHead(false);
    $("home").hidden = true;
    if (p !== P || P.stale) load(p); else { startClock(); render(); }  // a new copy (answers or parsings arrived) loads afresh
    size();
  }
  $("homeBtn").addEventListener("click", showHome);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#sheet .modesw button");
    if (b) setMode(b.dataset.mode);
  });
  $("menuBtn").addEventListener("click", openSheet);
  $("closeBtn").addEventListener("click", closeSheet);
  $("sheet").addEventListener("click", function (e) { if (e.target === $("sheet")) closeSheet(); });
  $("clearBtn").addEventListener("click", function () {
    if (!confirming) { confirming = true; $("clearBtn").textContent = "Tap again to clear every letter"; return; }
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) fill[r][c] = "";
    ok = {};  // the time, recorded mode and reveals stay: clearing never makes a fresh attempt
    save(); render(); closeSheet(); toast("Grid cleared");
  });

  window.addEventListener("resize", function () { size(); });

  // Settings (the cog on the home page). BUILT is the build time, filled in by tools/build.py.
  var BUILT = "__BUILT__";
