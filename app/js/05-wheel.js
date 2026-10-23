  function wheelOpen() {
    // Letters backed by a finished crossing answer (or checked correct) start in the boxes;
    // any other letters typed in this answer become wheel letters.
    var w = curWord(), letters = [];
    AW.slots = w.cells.map(function (rc, j) {
      var v = fill[rc[0]][rc[1]], x = cells[rc[0]][rc[1]][w.cdir[j] === "a" ? "d" : "a"];
      if (!v) return -1;
      if (lockedCell(rc[0] + "," + rc[1]) || (x >= 0 && filled(words[x]))) return v;
      letters.push(v); return -1;
    });
    AW.word = w; AW.tiles = []; AW.pick = AW.slots.indexOf(-1);
    $("ring").innerHTML = "";
    letters.forEach(addTile);
    // On phones the wheel covers everything down to the clue box, which shrinks to fit its clue meanwhile.
    var main = $("main"), el = $("wheel");
    showList(false); $("app").classList.add("aw");
    // In Quickfire it covers the clue and squares instead, from the header down to the keyboard.
    var hd = $("qfHead"), kb = $("kb"), top = P.qf ? hd.offsetTop + hd.offsetHeight : main.offsetTop;
    var h = P.qf ? (kb.offsetHeight ? kb.offsetTop : $("app").clientHeight) - top : isWide() ? main.offsetHeight : $("app").querySelector(".bar").offsetTop - main.offsetTop;
    el.style.top = top + "px";
    el.style.height = h + "px";
    el.classList.toggle("mid", P.qf && !kb.offsetHeight);  // no keyboard (desktop): centred and larger
    el.hidden = false; AW.open = true;
    $("wheelTitle").innerHTML = "";
    $("wheelTitle").appendChild(document.createTextNode(wordName(w)));
    var sm = document.createElement("small"); sm.textContent = "(" + (w.clue.match(/\(([^()]*)\)\s*$/) || [0, w.cells.length])[1] + ")";
    $("wheelTitle").appendChild(sm);
    // The clue, its letters tappable into the wheel.
    var wc = $("wheelClue"); wc.textContent = "";
    w.clue.split("").forEach(function (ch) {
      var L = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (!/^[A-Z]$/.test(L)) return wc.appendChild(document.createTextNode(ch));
      var sp = document.createElement("span"); sp.className = "wl"; sp.textContent = ch; sp.dataset.l = L; wc.appendChild(sp);
    });
    var avail = Math.min(main.clientWidth - 32, h - 205 - wc.offsetHeight, el.classList.contains("mid") ? 460 : 300);  // room for the hint line too
    AW.size = Math.max(180, avail);
    $("ring").style.width = $("ring").style.height = AW.size + "px";
    $("solveBtn").hidden = HARD;
    $("toGrid").textContent = P.qf ? "Fill squares" : "Put in grid";
    $("finds").hidden = true; AW.found = null;
    buildSlots(); layoutTiles(false); wheelRender();
  }
  function wheelClose() { $("wheel").hidden = true; AW.open = false; $("app").classList.remove("aw"); }
  function addTile(ch) {
    var t = { ch: ch, x: 0, y: 0, el: document.createElement("div") };
    t.el.className = "tile"; t.el.textContent = ch;
    $("ring").appendChild(t.el);
    AW.tiles.push(t);
    bindTile(t);
  }
  function layoutTiles(shuffle) {
    var n = AW.tiles.length, order = AW.tiles.map(function (_, i) { return i; });
    var prev = AW.order ? AW.order.join(",") : "";
    for (var tries = 0; shuffle && tries < 10; tries++) {
      for (var i = n - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = order[i]; order[i] = order[j]; order[j] = x; }
      if (n < 3 || order.join(",") !== prev) break;
    }
    AW.order = order.slice();
    AW.tiles.forEach(function (t) { t.el.classList.remove("drag"); });
    $("ring").classList.add("jump");
    requestAnimationFrame(function () { requestAnimationFrame(function () { $("ring").classList.remove("jump"); }); });
    var c = AW.size / 2, ts = Math.max(28, Math.min(44, Math.floor((Math.PI * (AW.size - 44)) / Math.max(n, 1) * 0.9)));
    $("ring").style.setProperty("--ts", ts + "px");
    var rad = n <= 1 ? 0 : c - ts / 2 - 6;
    order.forEach(function (ti, k) {
      var a = -Math.PI / 2 + (2 * Math.PI * k) / Math.max(n, 1), t = AW.tiles[ti];
      t.x = c + rad * Math.cos(a); t.y = c + rad * Math.sin(a);
    });
    wheelRender();
  }
  function buildSlots() {
    var box = $("slots"); box.innerHTML = "";
    var n = AW.slots.length, extra = AW.word.breaks.length * 8 + (n - 1) * 3;
    box.style.setProperty("--sw", Math.max(16, Math.min(30, Math.floor(($("main").clientWidth - 32 - extra) / n))) + "px");
    var br = {};
    AW.word.breaks.forEach(function (b) { br[b.after + 1] = b.kind; });
    AW.slots.forEach(function (_, i) {
      var d = document.createElement("button");
      d.type = "button"; d.className = "slot" + (br[i] === "," ? " gap" : br[i] === "-" ? " dash" : "");
      d.dataset.i = i; box.appendChild(d);
    });
  }
  // When the whole anagram fodder is typed in, tiles for letters already given by crossing answers are left over:
  // they are dimmed and not used.
  function coveredTiles() {
    var inSlot = {}, out = {}, extra = AW.tiles.length - AW.slots.filter(function (v) { return typeof v !== "string"; }).length;
    AW.slots.forEach(function (v) { if (typeof v === "number" && v >= 0) inSlot[v] = 1; });
    AW.slots.forEach(function (v) {
      if (typeof v !== "string" || extra <= 0) return;
      for (var i = AW.tiles.length - 1; i >= 0; i--) if (!inSlot[i] && !out[i] && AW.tiles[i].ch === v) { out[i] = 1; extra--; return; }
    });
    return out;
  }
  function wheelRender() {
    var used = coveredTiles();
    AW.slots.forEach(function (ti) { if (ti >= 0) used[ti] = 1; });
    AW.tiles.forEach(function (t, i) {
      t.el.style.left = t.x + "px"; t.el.style.top = t.y + "px";
      t.el.classList.toggle("used", !!used[i]);
    });
    Array.prototype.forEach.call($("slots").children, function (d, i) {
      var v = AW.slots[i];
      d.textContent = typeof v === "string" ? v : v >= 0 ? AW.tiles[v].ch : "";
      d.classList.toggle("given", typeof v === "string");
      d.classList.toggle("pick", i === AW.pick);
    });
    if (AW.found && AW.found !== wheelSet().key) { $("finds").hidden = true; AW.found = null; }
    var set = Object.keys(coveredTiles()).length;
    $("wheelHint").textContent = !AW.tiles.length ? "Type the anagram letters, or tap them in the clue, to add them to the wheel." :
      set ? "Grey letters are already in the grid." : "";
    $("wheelHint").hidden = !$("wheelHint").textContent;
  }
  function placeTile(i) {
    var at = AW.slots.indexOf(i);
    if (at >= 0) { AW.slots[at] = -1; AW.pick = at; return wheelRender(); }
    if (AW.pick < 0) AW.pick = AW.slots.indexOf(-1);
    if (AW.pick < 0) return;
    AW.slots[AW.pick] = i;
    AW.pick = nextFree(AW.pick);
    wheelRender();
  }
  // Next empty box after the one just filled, wrapping round; -1 when all are full.
  function nextFree(from) {
    var n = AW.slots.length;
    for (var k = 1; k <= n; k++) { var j = (from + k) % n; if (AW.slots[j] < 0) return j; }
    return -1;
  }
  function bindTile(t) {
    t.el.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var ring = $("ring").getBoundingClientRect(), sx = e.clientX, sy = e.clientY, moved = false;
      t.el.setPointerCapture && t.el.setPointerCapture(e.pointerId);
      t.el.classList.add("drag");
      function mv(ev) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) moved = true;
        if (!moved) return;
        t.x = Math.max(14, Math.min(AW.size - 14, ev.clientX - ring.left));
        t.y = Math.max(14, Math.min(AW.size - 14, ev.clientY - ring.top));
        t.el.style.left = t.x + "px"; t.el.style.top = t.y + "px";
      }
      function up() {
        t.el.removeEventListener("pointermove", mv); t.el.removeEventListener("pointerup", up); t.el.removeEventListener("pointercancel", up);
        t.el.classList.remove("drag");
        if (!moved) placeTile(AW.tiles.indexOf(t));
      }
      t.el.addEventListener("pointermove", mv); t.el.addEventListener("pointerup", up); t.el.addEventListener("pointercancel", up);
    });
  }
  // Keys in the wheel: a letter goes into the yellow box using a spare matching tile; delete empties boxes.
  // Only while the wheel holds fewer letters than the answer does typing add a new tile. The whole fodder can be
  // typed, letters already given by crossing answers included: those tiles are dimmed and set aside.
  function wheelKey(k) {
    var anyPlaced = AW.slots.some(function (ti) { return ti >= 0; });
    if (k === "⌫") {
      if (AW.pick >= 0 && AW.slots[AW.pick] !== -1) { AW.slots[AW.pick] = -1; return wheelRender(); }
      if (anyPlaced) {
        var from = AW.pick >= 0 ? AW.pick : AW.slots.length;
        for (var i = from - 1; i >= 0; i--) if (AW.slots[i] >= 0) { AW.slots[i] = -1; AW.pick = i; return wheelRender(); }
        for (i = AW.slots.length - 1; i >= 0; i--) if (AW.slots[i] >= 0) { AW.slots[i] = -1; AW.pick = i; return wheelRender(); }
        return;
      }
      var last = AW.tiles.length - 1; if (last < 0) return;
      AW.order = null;
      var gone = AW.tiles.pop(); gone.el.remove();
      if (gone.src) gone.src.classList.remove("used");
      layoutTiles(false);
      return;
    }
    if (!/^[A-Z]$/.test(k)) return;
    // Until a letter has been placed, typing fills the wheel, repeated letters included, up to the answer's length.
    var room = AW.slots.length;
    if (!anyPlaced && AW.tiles.length < room) { addTile(k); layoutTiles(false); return; }
    var used = coveredTiles();
    AW.slots.forEach(function (ti) { if (ti >= 0) used[ti] = 1; });
    var spare = -1;
    for (var t = 0; t < AW.tiles.length && spare < 0; t++) if (AW.tiles[t].ch === k && !used[t]) spare = t;
    if (spare < 0 && AW.tiles.length < room) { addTile(k); layoutTiles(false); spare = AW.tiles.length - 1; if (!anyPlaced) return; }
    var hasK = AW.tiles.some(function (t) { return t.ch === k; });
    if (spare < 0) return toast(AW.tiles.length >= room && !hasK ? "The wheel already has all " + room + " letters" : "No spare " + k + " in the wheel");
    if (AW.pick < 0) AW.pick = AW.slots.indexOf(-1);
    if (AW.pick < 0) return toast("All boxes are full");
    AW.slots[AW.pick] = spare;
    AW.pick = nextFree(AW.pick);
    wheelRender();
  }
  $("wheelBtn").addEventListener("click", wheelOpen);
  $("wheelClue").addEventListener("click", function (e) {
    var sp = e.target.closest(".wl");
    if (!sp || sp.classList.contains("used")) return;
    if (AW.tiles.length >= AW.slots.length) return toast("The wheel already has all " + AW.slots.length + " letters");
    addTile(sp.dataset.l); AW.tiles[AW.tiles.length - 1].src = sp; sp.classList.add("used");
    layoutTiles(false);
  });
  // Anagram solver, only inside the wheel so the letters have to be worked out first: answers from the word list
  // (words.txt, UKACD) using exactly the wheel letters around any letters fixed by crossing answers.
  var WORDS = null;
  function loadWords() {
    if (!WORDS) WORDS = fetch("words.txt").then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { return t.split(/\r?\n/); }, function (e) { WORDS = null; throw e; });
    return WORDS;
  }
  function plain(s) { return s.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase(); }
  // Word lengths as an enumeration: "play on words" -> "4,2,5", "rub-a-dub" -> "3-1-3".
  function shapeOf(s) { return s.normalize("NFD").replace(/[^A-Za-z -]/g, "").trim().replace(/[A-Za-z]+/g, function (m) { return m.length; }).replace(/ +/g, ","); }
  function partsOf(w) {
    var out = [], from = 0;
    w.breaks.forEach(function (b) { out.push({ at: from, len: b.after + 1 - from, kind: b.kind }); from = b.after + 1; });
    out.push({ at: from, len: w.cells.length - from, kind: "" });
    return out;
  }
  function wordShape(w) { return partsOf(w).map(function (p) { return p.len + p.kind; }).join(""); }
  // Whole entries in the list (phrases included) of the answer's length with any fixed letters in place, each once;
  // fit: the entry's word lengths match the answer's. keep(L), when given, filters further.
  function entries(list, w, fixed, keep) {
    var n = fixed.length, want = wordShape(w), seen = {}, out = [];
    list.forEach(function (e) {
      if (e.length < n) return;
      var L = plain(e);
      if (L.length !== n || seen[L]) return;
      for (var i = 0; i < n; i++) if (fixed[i] && L[i] !== fixed[i]) return;
      if (keep && !keep(L)) return;
      seen[L] = 1; out.push({ text: e.toUpperCase(), L: L, fit: shapeOf(e) === want });
    });
    return out;
  }
  // Load the word list for a button press: the button is disabled meanwhile.
  function withWords(btn, fn) {
    btn.disabled = true;
    loadWords().then(fn, function () { toast("The word list couldn't be loaded"); }).then(function () { btn.disabled = false; });
  }
  function chipList(box, hits, max, pick) {
    hits.slice(0, max).forEach(function (h) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = h.text;
      b.onclick = function () { pick(h); };
      box.appendChild(b);
    });
  }
  function counts(s) {
    var c = []; for (var i = 0; i < 26; i++) c.push(0);
    for (i = 0; i < s.length; i++) c[s.charCodeAt(i) - 65]++;
    return c;
  }
  var SINGLE = {};
  function singles(list, len) {
    if (!SINGLE[len]) {
      var seen = {}; SINGLE[len] = [];
      list.forEach(function (e, r) {
        if (e.length < len || /[ -]/.test(e)) return;
        var L = plain(e);
        if (L.length === len && !seen[L]) { seen[L] = 1; SINGLE[len].push({ L: L, c: counts(L), text: e.toUpperCase(), score: Math.log(r + 100) }); }
      });
    }
    return SINGLE[len];
  }
  // Answers of several words, such as (7,5): one single word per part that fits the part's fixed letters, together
  // using exactly the letters available. words.txt is ordered from common to rare words, so the search meets common
  // words first; it stops at 2000 answers, which are ranked by how common their words are.
  function combos(list, fixed, pool, parts) {
    var cand = parts.map(function (pt) {
      return singles(list, pt.len).filter(function (w) {
        for (var i = 0; i < pt.len; i++) if (fixed[pt.at + i] && w.L[i] !== fixed[pt.at + i]) return false;
        for (i = 0; i < 26; i++) if (w.c[i] > pool[i]) return false;
        return true;
      });
    });
    var order = parts.map(function (_, i) { return i; }).sort(function (a, b) { return cand[a].length - cand[b].length; });
    var out = [], pick = [], steps = 0;
    (function dfs(k) {
      if (k === order.length) { out.push(pick.slice()); return; }
      var ws = cand[order[k]];
      for (var j = 0; j < ws.length && out.length < 2000 && ++steps < 3e6; j++) {
        var c = ws[j].c, i;
        for (i = 0; i < 26 && c[i] <= pool[i]; i++);
        if (i < 26) continue;
        for (i = 0; i < 26; i++) pool[i] -= c[i];
        pick[order[k]] = ws[j]; dfs(k + 1);
        for (i = 0; i < 26; i++) pool[i] += c[i];
      }
    })(0);
    return out.map(function (ws) {
      return { L: ws.map(function (w) { return w.L; }).join(""), fit: true,
        text: ws.map(function (w, i) { return w.text + (parts[i].kind === "-" ? "-" : parts[i].kind ? " " : ""); }).join(""),
        score: ws.reduce(function (n, w) { return n + w.score; }, 0) };
    }).sort(function (a, b) { return a.score - b.score; });
  }
  function wheelSet() {
    var fixed = AW.slots.map(function (v) { return typeof v === "string" ? v : ""; });
    var cov = coveredTiles(), have = AW.tiles.filter(function (_, i) { return !cov[i]; }).map(function (t) { return t.ch; }).sort().join("");
    return { fixed: fixed, have: have, open: fixed.filter(function (v) { return !v; }).length, key: have + "|" + fixed.join(",") };
  }
  function solveAnagram() {
    var s = wheelSet();
    withWords($("solveBtn"), function (list) {
      var hits = entries(list, AW.word, s.fixed, function (L) {
        return L.split("").filter(function (_, i) { return !s.fixed[i]; }).sort().join("") === s.have;
      });
      var fit = hits.filter(function (h) { return h.fit; }), parts = partsOf(AW.word), box = $("finds");
      if (parts.length > 1) {
        var got = {};
        fit.forEach(function (h) { got[h.L] = 1; });
        fit = fit.concat(combos(list, s.fixed, counts(s.have + s.fixed.join("")), parts).filter(function (h) { return !got[h.L]; }));
      }
      var show = fit.length ? fit : hits;
      box.innerHTML = ""; box.hidden = false; AW.found = s.key;
      var note = !show.length ? "No words in the list use exactly these letters." :
        (fit.length ? "" : "None match the word lengths, but these use the same letters. ") + (show.length > 40 ? "Showing the first 40 of " + (show.length >= 2000 ? "2,000+" : show.length) + "." : "");
      if (note) { var p = document.createElement("p"); p.textContent = note; box.appendChild(p); }
      chipList(box, show, 40, function (h) { useFind(h.L); });
    });
  }
  // Put a found word into the boxes using the wheel's own tiles.
  function useFind(L) {
    var cov = coveredTiles(), free = AW.tiles.map(function (_, i) { return i; }).filter(function (i) { return !cov[i]; });
    AW.slots = AW.slots.map(function (v, i) {
      if (typeof v === "string") return v;
      for (var j = 0; j < free.length; j++) if (AW.tiles[free[j]].ch === L[i]) return free.splice(j, 1)[0];
      return -1;
    });
    AW.pick = AW.slots.indexOf(-1); wheelRender();
  }
  // Two taps, so the words never show by accident.
  $("solveBtn").addEventListener("click", function () {
    var b = this, s = wheelSet();
    if (s.have.length !== s.open) return toast(s.have.length < s.open ? "Put all " + s.open + " letters in the wheel first" : "The wheel has " + s.have.length + " letters for " + s.open + " empty boxes. Check it holds every letter already in the grid");
    clearTimeout(b.t);
    if (b.textContent === "Solve" && !P.qf) {  // Quickfire solves without asking
      b.textContent = "Show words?";
      b.t = setTimeout(function () { b.textContent = "Solve"; }, 3000);
      return;
    }
    b.textContent = "Solve"; solveAnagram();
  });
