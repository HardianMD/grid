  function showStats() {
    var all = tally(), types = {}, modes = {}, prog = 0, box = $("statBody");
    function tally() { return { n: 0, ok: 0, dnf: 0, time: 0, okTime: 0, best: 0, hn: 0, rv: 0, free: 0 }; }
    PUZZLES.forEach(function (p) {
      var g = progressOf(p), key = kindOf(p);
      if (!g.solved) { if (g.n) prog++; return; }
      if (g.sub && !g.sub.res) g.dnf = markOf(p, store.peek("crossword:" + p.id) || {}).bad > 0;
      (types[key] = types[key] || Object.assign(tally(), { p: p, key: key, list: [] })).list.push({ p: p, g: g });
      [all, types[key], modes[g.mode] = modes[g.mode] || tally()].forEach(function (t) {
        t.n++; t.time += g.time; t.hn += g.hn; t.rv += g.rv;
        if (g.dnf) { t.dnf++; return; }
        t.ok++; t.okTime += g.time; if (!t.best || g.time < t.best) t.best = g.time;
        if (!g.hn && !g.rf) t.free++;
      });
    });
    function hm(ms) { var m = Math.round(ms / 6e4); return m < 60 ? m + "m" : Math.floor(m / 60) + "h " + m % 60 + "m"; }
    function avg(t) { return t.ok ? fmt(t.okTime / t.ok) : "\u2013"; }
    function per(x, t) { return t.n ? (x / t.n).toFixed(1) : "\u2013"; }
    function figs(cls, list) {
      var d = mk("div", cls);
      list.forEach(function (f) {
        var c = mk("div"); c.appendChild(mk("b", null, f[0])); c.appendChild(mk("span", null, f[1])); d.appendChild(c);
      });
      return d;
    }
    function head(text) { box.appendChild(mk("h4", null, text)); }
    function card(name, t, mode) {
      var c = mk("div", "scard"), r = mk("div", "srow"), l = mk("span"), sm = mk("small");
      if (mode) { var i = mk("i", "mico"); i.dataset.mode = mode; i.textContent = name[0]; l.appendChild(i); }
      // Paper cards carry the paper's badge, as in the home list.
      if (t.p && pubOf(t.p)) { l.appendChild(badgeEl(t.p)); name = typeOf(t.p); }
      l.appendChild(document.createTextNode(name));
      sm.textContent = plural(t.ok, "solve") + (t.dnf ? " \u00b7 " + t.dnf + " DNF" : "") + (t.list ? (SOPEN[t.key] ? " \u25b4" : " \u25be") : "");
      r.appendChild(l); r.appendChild(sm); c.appendChild(r);
      c.appendChild(figs("sfig", [[avg(t), "average"], [t.best ? fmt(t.best) : "\u2013", "best"], [per(t.hn, t), "hints each"], [per(t.rv, t), "reveals each"]]));
      // A crossword's card opens its history when tapped.
      if (t.list) {
        c.classList.add("tap");
        c.addEventListener("click", function (e) {
          var dt = e.target.closest(".hdt");
          if (dt) return openPuzzle(t.list.find(function (x) { return x.p.id === dt.dataset.id; }).p);
          var nt = e.target.closest("[data-n]");
          if (nt) return showNitch(t.list.find(function (x) { return x.p.id === nt.dataset.n; }).p);
          if (e.target.closest(".hall")) SOPEN[t.key] = 2; else SOPEN[t.key] = SOPEN[t.key] ? 0 : 1;
          showStats();
        });
        if (SOPEN[t.key]) history(c, t);
      }
      box.appendChild(c);
    }
    // History: first against last solves, a trend line of clean solve times by puzzle date, and the latest solves.
    function history(c, t) {
      var list = t.list.slice().sort(function (a, b) { return cmp(a.p.date || "", b.p.date || ""); }),
        ok = list.filter(function (x) { return !x.g.dnf; }), k = Math.min(5, Math.floor(ok.length / 2));
      var mean = function (a) { return a.reduce(function (n, x) { return n + x.g.time; }, 0) / a.length; };
      if (k >= 2) {
        var a0 = mean(ok.slice(0, k)), a1 = mean(ok.slice(-k)), pc = Math.round(100 * (a1 - a0) / a0), hl = mk("div", "srow shl", "First " + k + " vs last " + k + ": " + fmt(a0) + " \u2192 " + fmt(a1)),
          b = mk("b", pc > 0 ? "up" : "down", (pc > 0 ? "\u25b2 " : "\u25bc ") + Math.abs(pc) + "%");
        hl.appendChild(b); c.appendChild(hl);
      }
      // A series with difficulty scores gets their averages above the chart and their columns in the table.
      var nl = list.filter(function (x) { return x.p.nitch; }), nt = nl.length;
      if (nt) c.appendChild(ntiles(nl));
      if (ok.length > 1) {
        var ts = ok.map(function (x) { return x.g.time; }), lo = Math.min.apply(null, ts), hi = Math.max.apply(null, ts) || 1;
        var pts = ts.map(function (v, i) { return (i * 300 / (ts.length - 1)).toFixed(1) + "," + (40 - 36 * (v - lo) / (hi - lo || 1)).toFixed(1); });
        var sv = mk("div", "spark");
        sv.innerHTML = '<svg viewBox="-4 0 308 44" preserveAspectRatio="none"><polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
        c.appendChild(sv);
      }
      var rows = list.slice().reverse(), shown = SOPEN[t.key] === 2 ? rows : rows.slice(0, 6), dot = function (on, cl) { return on ? '<span class="' + cl + '">\u25cf</span>' : ""; };
      var tb = mk("table", nt ? "htab ntab" : "htab"), hr = '<span class="hk"><span class="hh">Hints</span> <span class="rv">Reveals</span></span>';
      tb.innerHTML = (nt ? "<tr><th>Date and setter</th><th>NITCH</th><th>Time</th><th>You</th><th>WITCH</th><th>" + hr + '<span class="hl">Help</span>' : "<tr><th>Date and setter</th><th>Time</th><th></th><th>" + hr) + "</th></tr>" + shown.map(function (x) {
        var g = x.g, d = x.p.date ? fmtDate(new Date(x.p.date + "T12:00:00"), { day: "numeric", month: "short" }) : "", m = x.p.nitch ? mineOf(x.p) : {};
        return (x.p.nitch ? '<tr data-n="' + x.p.id + '">' : "<tr>") + hdt(x.p, d) + (nt ? "<td>" + nchip(x.p.nitch && x.p.nitch.n) + "</td>" : "") +
          '<td class="tm' + (g.dnf ? " rv" : "") + '">' + fmt(g.time) + (nt ? "" : "</td><td>") +
          (g.mode ? '<i class="mico" data-mode="' + g.mode + '">' + g.mode[0].toUpperCase() + "</i>" : "") + "</td>" + (nt ? "<td>" + nchip(m.pn) + "</td><td>" + nchip(m.w) + "</td>" : "") + "<td>" +
          // One dot for any hints, one for any reveals.
          (g.hn || g.rf ? dot(g.hn, "hh") + dot(g.rf || g.rv, "rv") :
            '<span class="free">\u2713<span class="nh"> no help</span></span>') + "</td></tr>";
      }).join("");
      c.appendChild(tb);
      if (shown.length < rows.length) { var all = document.createElement("button"); all.type = "button"; all.className = "btn mini hall"; all.textContent = "Show all " + rows.length; c.appendChild(all); }
    }
    box.innerHTML = "";
    if (!all.n) box.appendChild(mk("p", null, "Finish a puzzle to see your stats here."));
    else {
      box.appendChild(figs("stiles", [[all.ok, "solved"], [all.dnf, "DNF"], [prog, "in progress"],
        [hm(all.time), "total time"], [avg(all), "average solve"], [all.ok ? Math.round(100 * all.free / all.ok) + "%" : "\u2013", "solved with no help"]]));
      ["Solved", "DNF", "In progress"].forEach(function (v, i) {
        var t = box.firstChild.children[i]; t.className = "tap"; t.setAttribute("role", "button"); t.tabIndex = 0;
        t.addEventListener("click", function () { FILT = { status: [v] }; store.set("crossword:filter", FILT); TAB = ""; showHome(); });
      });
      head("By crossword");
      Object.keys(types).sort(function (x, y) { return types[y].n - types[x].n || cmp(x, y); }).forEach(function (k) { card(k, types[k]); });
      head("By mode");
      MODES.forEach(function (m) { if (m && modes[m]) card(m.charAt(0).toUpperCase() + m.slice(1), modes[m], m); });
      box.appendChild(mk("p", null, "Averages and bests count solves without a DNF. Hints and reveals are averaged over every finished puzzle. A solve counts at the mode it was finished in, or at the easiest mode used once a check, hint or reveal was used."));
    }
  }

