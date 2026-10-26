  // Difficulty scores (p.nitch, added by the updater): n, the field's score (100 = the reference solvers' usual time,
  // 150 = half as long again); c, the solvers behind it; t, every reference solver's time in seconds, sorted; f, final
  // (until then it moves during the day). Colours follow the score's own scale: green at 57 or less, yellow at 100,
  // red at 170 or more.
  function ncol(n) {
    var a = n <= 100 ? [[99, 190, 123], [255, 235, 137], (Math.max(n, 57) - 57) / 43] : [[255, 235, 137], [248, 105, 107], (Math.min(n, 170) - 100) / 70];
    return "rgb(" + a[0].map(function (x, i) { return Math.round(x + (a[1][i] - x) * a[2]); }).join(",") + ")";
  }
  function ngrade(n, full) {
    var i = n < 64 ? 0 : n < 94 ? 1 : n < 109 ? 2 : n < 139 ? 3 : 4;
    return (full ? ["Very easy", "Easier", "Moderate", "Harder", "Very hard"] : ["V Easy", "Easy", "Mod", "Hard", "V Hard"])[i];
  }
  function nchip(n) { return n ? '<span class="nb" style="background:' + ncol(n) + '">' + n + "</span>" : '<span class="sub">\u2013</span>'; }
  function mean(a) { return a.length ? a.reduce(function (n, v) { return n + v; }, 0) / a.length : 0; }
  // The user's usual time for a series, worked out the way the score is for each solver: the average of solves
  // that are not DNFs (hints and reveals count) in the six months up to the puzzle's date, leaving out any under 40% or over 250% of the
  // median. Needs 5 such solves. Personal NITCH: this time against the usual; WITCH: that against the field's score.
  function mineOf(p) {
    var g = progressOf(p), from = new Date(Date.parse(p.date) - 183 * 864e5).toISOString().slice(0, 10), ts = [], ser = series(p);
    PUZZLES.forEach(function (q) {
      if (!q.date || q.date < from || q.date > p.date || series(q) !== ser) return;
      var h = progressOf(q);
      if (h.solved && !h.dnf && h.time) ts.push(h.time / 1000);
    });
    ts.sort(function (a, b) { return a - b; });
    var md = ts[ts.length >> 1], ok = ts.filter(function (x) { return x >= md * 0.4 && x <= md * 2.5; }),
      u = ok.length >= 5 && !g.dnf ? mean(ok) : 0, pn = u && Math.round(100 * g.time / 1000 / u);
    return { g: g, u: u, pn: pn, w: pn && Math.round(100 * pn / p.nitch.n) };
  }
  // Where the user's time sits in the field: a smoothed curve of the field's times, shaded up to the user's line.
  function ncurve(t, me) {
    var hi = Math.max(t[t.length - 1], me), bw = Math.max(20, hi / 22), W = 320, H = 110, pts = [], top = 0;
    for (var i = 0; i <= 120; i++) {
      var x = hi * i / 120, y = t.reduce(function (n, v) { return n + Math.exp(-0.5 * Math.pow((x - v) / bw, 2)); }, 0);
      pts.push([x, y]); top = Math.max(top, y);
    }
    var X = function (v) { return (v / hi * W).toFixed(1); }, Y = function (v) { return (H - v / top * (H - 22)).toFixed(1); },
      line = pts.map(function (q) { return X(q[0]) + "," + Y(q[1]); }).join(" L"), left = pts.filter(function (q) { return q[0] <= me; }),
      md = t.length % 2 ? t[t.length >> 1] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2, ax = "";
    for (var m = 0; m * 60 <= hi; m += hi > 3600 ? 20 : 10) ax += '<text x="' + X(m * 60) + '" y="' + (H + 13) + '" text-anchor="middle">' + m + "m</text>";
    return '<svg viewBox="0 0 ' + W + " " + (H + 16) + '" font-size="10" fill="var(--ink-soft)">' +
      '<path d="M' + line + " L" + W + "," + H + " L0," + H + ' Z" fill="var(--word)"/>' +
      (left.length ? '<path d="M' + left.map(function (q) { return X(q[0]) + "," + Y(q[1]); }).join(" L") + " L" + X(me) + "," + H + " L0," + H + ' Z" fill="var(--accent)" opacity=".35"/>' : "") +
      '<path d="M' + line + '" fill="none" stroke="var(--accent)" stroke-width="2"/><line x1="0" x2="' + W + '" y1="' + H + '" y2="' + H + '" stroke="var(--rule)"/>' + ax +
      '<line x1="' + X(md) + '" x2="' + X(md) + '" y1="18" y2="' + H + '" stroke="var(--ink)" stroke-dasharray="3 3" opacity=".6"/><text x="' + (+X(md) + 4) + '" y="' + (H - 6) + '">median ' + fmt(md * 1000) + "</text>" +
      '<line x1="' + X(me) + '" x2="' + X(me) + '" y1="14" y2="' + H + '" stroke="var(--bad)" stroke-width="2.5"/><text x="' + X(me) + '" y="10" text-anchor="' + (me > hi * 0.75 ? "end" : "start") + '" font-weight="700" font-size="11" fill="var(--bad)">You ' + fmt(me * 1000) + "</text></svg>";
  }
  function showNitch(p) {
    var x = p.nitch, t = x.t, m = mineOf(p), me = m.g.time / 1000, n = t.length, s = function (v) { return "<b>" + fmt(v * 1000) + "</b>"; };
    var row = function (k, v) { return '<div class="nrow"><span>' + k + "</span>" + v + "</div>"; },
      md = n % 2 ? t[n >> 1] : (t[n / 2 - 1] + t[n / 2]) / 2, beat = Math.round(100 * t.filter(function (v) { return v > me; }).length / n);
    $("nitchTitle").textContent = p.title;
    // Three blocks (field, where you sit, you): stacked on phones, two columns on wide screens.
    $("nitchBody").innerHTML = "<div><p>" + (x.f ? "Final" : "Still moving today") + " \u00b7 scored from " + x.c + " reference solvers; times from all " + n + "</p><h4>Field</h4>" +
      row("NITCH \u00b7 " + ngrade(x.n, 1), nchip(x.n)) + row("Fastest", s(t[0])) + row("Median", s(md)) + row("Average", s(mean(t))) + row("Slowest", s(t[n - 1])) + "</div><div>" +
      (m.g.dnf ? "" : '<h4>Where you sit</h4><div class="ncurve">' + ncurve(t, me) + "</div><p>" +
        (beat >= 50 ? "You beat " + beat + "% of solvers" : (100 - beat) + "% of solvers beat you") + "</p>") +
      "</div><div><h4>You</h4>" + row("Your time", m.g.dnf ? '<b class="rv">DNF</b>' : s(me)) +
      row("Your usual (last 6 months)", m.u ? s(m.u) : '<span class="sub">after 5 solves</span>') +
      (m.pn ? row("Personal NITCH", nchip(m.pn)) + row("WITCH", nchip(m.w)) : "") + "</div>";
    $("nitchSheet").hidden = false;
  }
  $("nitchBtn").addEventListener("click", function () { showNitch(P); });
  $("nitchDone").addEventListener("click", function () { $("nitchSheet").hidden = true; });
  $("nitchSheet").addEventListener("click", function (e) { if (e.target === this) this.hidden = true; });
  // A Stats table's puzzle cell: its date and setter, which open the puzzle.
  function hdt(p, d) {
    return '<td class="hdt" data-id="' + p.id + '">' + d + (p.setter ? " <small>" + p.setter.replace(/[&<>"]/g, function (ch) { return "&#" + ch.charCodeAt(0) + ";"; }) + "</small>" : "") + "</td>";
  }
  // Stats: a series' average scores, above its chart.
  function ntiles(list) {
    var ms = list.map(function (x) { return mineOf(x.p); }), d = mk("div", "sfig ntiles"),
      tile = function (v, l) { v = Math.round(v); return "<div" + (v ? ' style="background:' + ncol(v) + '"' : "") + "><b>" + (v || "\u2013") + "</b><span>" + l + "</span></div>"; },
      got = function (k) { return mean(ms.map(function (m) { return m[k]; }).filter(Boolean)); };
    d.innerHTML = tile(mean(list.map(function (x) { return x.p.nitch.n; })), "avg NITCH") + tile(got("pn"), "your NITCH") + tile(got("w"), "avg WITCH");
    return d;
  }
