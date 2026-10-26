  // The list shows two weeks, from today or from the newest puzzle the filters match; each View more adds the two
  // weeks before the newest puzzle still hidden.
  function weeks2(d) { var a = new Date(d + "T12:00:00"); a.setDate(a.getDate() - 13); return d ? a.toISOString().slice(0, 10) : ""; }
  var FROM = weeks2(new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10));
  function showHome(keepScroll) {
    if (P) { save(); stopClock(); }
    qfHead(false); mergeMade();
    checkSubs();
    ["favs", "stats", "make"].forEach(function (t) { $(t + "Btn").classList.toggle("on", TAB === t); $(t + "Btn").setAttribute("aria-pressed", String(TAB === t)); });
    $("homeList").hidden = !!TAB; $("favList").hidden = TAB !== "favs"; $("statBody").hidden = TAB !== "stats"; $("makeList").hidden = TAB !== "make";
    if (TAB) { $("fpanel").hidden = true; $("filterBtn").setAttribute("aria-expanded", "false"); (TAB === "favs" ? showFavs : TAB === "stats" ? showStats : showMade)(); }
    var list = $("homeList"), last = null;
    list.innerHTML = "";
    var all = PUZZLES.slice().sort(function (x, y) { return cmp(y.date || "", x.date || "") || cmp(y.id, x.id); });
    var pf = prefs(), hideDone = pf.hideDone && !(FILT.status || []).length;
    var match = all.filter(function (p) { return filterOk(p) && !(hideDone && (store.peek("crossword:" + p.id) || {}).solved); }), nf = filterCount();
    var from = match.length && !(match[0].date >= FROM) ? weeks2(match[0].date) : FROM;
    var shown = nf ? match : match.filter(function (p) { return p.date >= from; }), more = match[shown.length];  // a filter shows every match
    $("filterClear").hidden = !nf; $("filterBtn").classList.toggle("on", !!nf);
    $("filterBtn").textContent = nf ? "Filter (" + nf + ")" : "Filter";
    if (!match.length) list.appendChild(mk("p", "hempty", "No puzzles match these filters."));
    shown.forEach(function (p) {
      var g = progressOf(p), pub = pubOf(p);
      if (p.date !== last) {
        last = p.date;
        list.appendChild(mk("h2", "hday", dayLabel(p.date)));
      }
      var b = document.createElement("button"), state = g.solved ? "done" : g.n ? "prog" : "new";
      b.type = "button"; b.className = "hitem " + state;
      var ht = mk("div", "ht");
      if (pub) ht.appendChild(badgeEl(p));
      ht.appendChild(mk("span", null, pub ? p.title.replace(new RegExp("^(The )?" + pub + "\\s+", "i"), "") : p.title));
      var hm = mk("div", "hm", metaText(p));
      if (pf.listN && p.nitch && (state === "done" || pf.listNWhen === "always"))
        hm.insertAdjacentHTML("beforeend", '<span class="nb" style="background:' + ncol(p.nitch.n) + '">' + ngrade(p.nitch.n) + " \u00b7 " + p.nitch.n + "</span>");
      var hs = mk("div", "hs");
      if (state === "done") {
        if (g.dnf) b.classList.add("dnf");
        hs.textContent = g.dnf ? "DNF" : g.sub && !g.sub.res ? "Submitted" : "\u2713 Solved";
        hs.appendChild(mk("small", null, (g.mode ? g.mode.charAt(0).toUpperCase() + g.mode.slice(1) + " \u00b7 " : "") + fmt(g.time)));
      }
      else if (state === "prog") { hs.textContent = Math.round(100 * g.n / g.t) + "% filled"; hs.appendChild(mk("small", null, fmt(g.time))); }
      else hs.appendChild(mk("span", "st", "New"));
      // Parsed means a blog's explanations are in; until then any parsings are unverified. A source no blog covers says noblog.
      if (!p.blog && !p.made && !p.noblog) hs.appendChild(mk("small", "pz", "Unparsed"));
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
  function openPuzzle(h) {
    var nl = notes(), left = nl.filter(function (n) { return n.id !== h.id; });
    if (left.length !== nl.length) setNotes(left);  // opening a puzzle, from the bell or the list, reviews its notification
    return full(h).then(function (p) {
      showList(false); qfHead(false);
      $("home").hidden = true;
      if (p !== P || p.stale) { p.stale = false; load(p); } else { startClock(); render(); }  // a new copy (answers or parsings arrived) loads afresh
      size();
    }, function () { toast("Couldn\u2019t open the puzzle. Check your connection."); });
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
    confirmAsk("clear", "Clear the grid?", "Every letter will be removed. Your time, hints and reveals stay.", "Clear");
  });

  window.addEventListener("resize", function () { size(); });

  // Settings (the cog on the home page). BUILT is the build time, filled in by tools/build.py.
  var BUILT = "__BUILT__";
