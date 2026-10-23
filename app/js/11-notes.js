  // Notifications: a submitted grid is marked as soon as its answers arrive, and the bell says how it went;
  // a puzzle finished before its parsings gets one when they arrive.
  // Opening the list clears the red dot; each notification stays until its puzzle is opened.
  function notes() { return (store.peek("crossword:notes") || {}).list || []; }
  function setNotes(list) { store.set("crossword:notes", { list: list, at: Date.now() }); bellDot(); }
  function bellDot() { $("bellDot").hidden = !notes().some(function (n) { return !n.seen; }); }
  function checkSubs() {
    var add = [];
    PUZZLES.forEach(function (p) {
      var k = "crossword:" + p.id, s = store.peek(k), m;
      if (!s || (P && P.id === p.id && $("home").hidden)) return;  // the open puzzle is marked on screen instead
      if (s.np && p.parsed) { s = store.get(k); delete s.np; store.set(k, s); add.push({ id: p.id, res: "parse" }); }
      // a DNF is marked again in case its answers were corrected since
      if (!s.sub || s.sub.res === "ok" || !p.solution) return;
      if (!(m = markOf(p, s)).any || (m.bad ? "dnf" : "ok") === s.sub.res) return;
      s = store.get(k); s.sub.res = m.bad ? "dnf" : "ok"; store.set(k, s);
      if (P && P.id === p.id) P.stale = true;
      add.push({ id: p.id, res: s.sub.res, bad: m.bad, gap: m.gap, time: s.time || 0 });
    });
    if (add.length) setNotes(notes().concat(add)); else bellDot();
  }
  $("bellBtn").addEventListener("click", function () {
    var list = notes(), box = $("noteList");
    box.innerHTML = "";
    var e = mk("p", "sub");
    e.textContent = list.length ? "Tap a puzzle to review it. Each notification stays here until its puzzle has been opened." : "No notifications.";
    box.appendChild(e);
    list.forEach(function (n) {
      var p = PUZZLES.filter(function (x) { return x.id === n.id; })[0];
      if (!p) return;
      var b = document.createElement("button"), t = document.createElement("b"), r = document.createElement("span");
      b.type = "button"; b.className = "note-item " + n.res;
      t.textContent = p.title.replace(/ No\. /, " ") + (n.res === "parse" ? " has its parsings" : " has been checked");
      r.textContent = n.res === "parse" ? "Tap to see how the clues work" : n.res === "ok" ? "\u2713 Finished in " + fmt(n.time)
        : dnfText(n.time, n.bad, n.gap);
      b.appendChild(t); b.appendChild(r);
      b.addEventListener("click", function () { $("noteSheet").hidden = true; openPuzzle(p); });
      box.appendChild(b);
    });
    if (list.some(function (n) { return !n.seen; })) setNotes(list.map(function (n) { return Object.assign({}, n, { seen: true }); }));
    $("noteSheet").hidden = false;
  });
  function closeNotes() { $("noteSheet").hidden = true; }
  $("noteDone").addEventListener("click", closeNotes);
  $("noteSheet").addEventListener("click", function (e) { if (e.target === this) closeNotes(); });
  // A saved grid against the puzzle's known answers: any (some answer is known), bad (squares wrong or blank), gap (blank).
  function markOf(p, s) {
    var flat = solOf(p), w = p.grid[0].length, m = { any: false, bad: 0, gap: 0 };
    p.grid.forEach(function (row, r) { Array.from(row).forEach(function (ch, c) {
      var a = flat[r * w + c], f = (s.fill && s.fill[r] && s.fill[r][c] || " ").trim();
      if (ch === "#" || !a || a === "?") return;
      m.any = true; if (f !== a) { m.bad++; if (!f) m.gap++; }
    }); });
    return m;
  }
