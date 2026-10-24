  function setMode(m, fromCloud) {
    m = RANK[m] === undefined ? "easy" : m;
    HARD = m === "hard" || m === "champ"; MED = m === "medium"; CHAMP = m === "champ"; MODE = m;
    if (!fromCloud) {
      var md = store.get("crossword:mode"), ser = md && md.s || {};
      if (P) ser[series(P)] = m;
      store.set("crossword:mode", { m: m, s: ser, at: Date.now() });
      // A solve is recorded at the most help it had; with no help used yet (no hints, checks or reveals), the
      // mode it is played in from here on is the one that counts.
      if (P && !solved && USED >= 0 && USED !== 3) {
        var noHelp = !REV && !Object.keys(hinted).length && !Object.keys(ok).length;
        USED = noHelp ? RANK[m] : Math.min(USED, RANK[m]);
      }
      if (P) save();
    }
    document.documentElement.dataset.mode = m;
    $("modeIco").textContent = m.charAt(0).toUpperCase();
    Array.prototype.forEach.call(document.querySelectorAll("#sheet .modesw button"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    });
    if (P && $("home").hidden) render();
  }
  function series(p) { return p.id.replace(/-\d+$/, ""); }
  function lastMode(p) {
    var pf = prefs(), md = store.get("crossword:mode") || {};
    return pf.start === "fixed" ? pf.mode || "easy" : md.s && md.s[series(p)] || md.m || "easy";
  }
  // Settings, synced as one record: name (shown on the solver's own parsings), start ("last" or "fixed") and mode.
  function prefs() { return store.peek("crossword:prefs") || {}; }
  function setPref(k, v) { var o = Object.assign({}, prefs()); o[k] = v; o.at = Date.now(); store.set("crossword:prefs", o); }
  function editedBy() { return "Edited by " + (prefs().name || "you"); }
  // Facts about a puzzle worked out once per copy of it (a new copy arrives when its answers or parsings change).
  var PC = new WeakMap();
  function pc(p) { var c = PC.get(p); if (!c) PC.set(p, c = {}); return c; }
  function solOf(p) { var c = pc(p); if (c.sol === undefined) try { c.sol = p.solution ? unscramble(p.solution, p.id) : ""; } catch (e) { c.sol = ""; } return c.sol; }
  function jsonOf(p, f) { var c = pc(p); if (!(f in c)) try { c[f] = JSON.parse(unscramble(p[f], p.id)); } catch (e) { c[f] = null; } return c[f]; }
  function linksFor(p) {
    if (Array.isArray(p.links)) return p.links;
    var c = pc(p); if (c.links) return c.links;
    var groups = {};
    [["a", "across"], ["d", "down"]].forEach(function (t) {
      Object.keys(p[t[1]] || {}).forEach(function (n) {
        var m = String(p[t[1]][n]).match(/^\s*See (\d+)\s*(Across|Down)?\s*(\([^)]*\))?\s*$/i);
        if (!m) return;
        var hd = m[2] ? m[2][0].toLowerCase() : (p[t[1]][m[1]] !== undefined ? t[0] : (t[0] === "a" ? "d" : "a"));
        (groups[hd + m[1]] = groups[hd + m[1]] || [hd + m[1]]).push(t[0] + n);
      });
    });
    return (c.links = Object.keys(groups).map(function (k) { return groups[k]; }));
  }
  function wordName(w) {
    if (P && P.qf) return QF.name;
    if (!w.parts) return w.num + (w.dir === "a" ? " Across" : " Down");
    var same = w.parts.every(function (x) { return x.dir === w.dir; });
    return same ? w.parts.map(function (x) { return x.num; }).join(", ") + (w.dir === "a" ? " Across" : " Down")
      : w.parts.map(function (x) { return x.num + (x.dir === "a" ? " Across" : " Down"); }).join(", ");
  }
  // A linked head clue ending "[...: 5,4]" takes the whole answer's enumeration, "(5,4)".
  function joinEnum(clue) { return clue.replace(/\s*\[[^\]]*?:\s*([\d,\-\s]+)\]\s*(\([\d,\-\s]+\))?\s*$/, " ($1)"); }
  function parseEnum(clue) {
    var m = clue.match(/\(([\d,\-\s]+)\)\s*$/);
    if (!m) return [];
    var out = [], pos = 0, parts = m[1].split(/([,\-])/);
    for (var i = 0; i < parts.length; i += 2) {
      pos += parseInt(parts[i], 10);
      if (parts[i + 1]) out.push({ after: pos - 1, kind: parts[i + 1] });
    }
    return out;
  }

  // A grid's slots in clue order ({dir, num, cells}), numbered as the papers do: a white square starting an across or
  // down run of two or more takes the next number.
  function slotsOf(g) {
    var R0 = g.length, C0 = g[0].length, out = [], n = 0;
    var open = function (r, c) { return r >= 0 && r < R0 && c >= 0 && c < C0 && g[r][c] !== "#"; };
    for (var r = 0; r < R0; r++) for (var c = 0; c < C0; c++) {
      if (!open(r, c)) continue;
      var sa = !open(r, c - 1) && open(r, c + 1), sd = !open(r - 1, c) && open(r + 1, c);
      if (sa || sd) n++;
      [["a", sa, 0, 1], ["d", sd, 1, 0]].forEach(function (t) {
        if (!t[1]) return;
        var s = { dir: t[0], num: n, cells: [] };
        for (var rr = r, cc = c; open(rr, cc); rr += t[2], cc += t[3]) s.cells.push([rr, cc]);
        out.push(s);
      });
    }
    return out;
  }

  function load(p) {
    P = p; R = p.grid.length; C = p.grid[0].length;
    cells = []; words = [];
    for (var r = 0; r < R; r++) {
      cells.push([]);
      for (var c = 0; c < C; c++) cells[r].push({ b: p.grid[r][c] === "#", num: 0, a: -1, d: -1 });
    }
    slotsOf(p.grid).forEach(function (w) {
      cells[w.cells[0][0]][w.cells[0][1]].num = w.num;
      w.cells.forEach(function (rc) { cells[rc[0]][rc[1]][w.dir] = words.length; });
      w.clue = (p[w.dir === "a" ? "across" : "down"] || {})[w.num] || "(clue missing)";
      words.push(w);
    });
    words.forEach(function (w) { w.cdir = w.cells.map(function () { return w.dir; }); w.ends = [w.cells.length - 1]; });
    // Linked clues ("See 1") are played as one answer: the tail slots join the head clue's word.
    var byKey = {}; words.forEach(function (w) { byKey[w.dir + w.num] = w; });
    SEES = [];
    linksFor(p).forEach(function (grp) {
      var ws = grp.map(function (k) { return byKey[k]; });
      if (ws.some(function (w) { return !w; })) return;
      var head = ws[0];
      head.parts = ws.map(function (w) { return { dir: w.dir, num: w.num }; });
      ws.slice(1).forEach(function (t) {
        head.cells = head.cells.concat(t.cells); head.cdir = head.cdir.concat(t.cdir);
        head.ends.push(head.cells.length - 1);
        words.splice(words.indexOf(t), 1);
        SEES.push({ dir: t.dir, num: t.num, head: head });
      });
      head.clue = joinEnum(head.clue);
    });
    words.forEach(function (w) { w.breaks = parseEnum(w.clue); });
    words.sort(function (x, y) { return x.dir === y.dir ? x.num - y.num : (x.dir === "a" ? -1 : 1); });
    words.forEach(function (w, i) { w.cells.forEach(function (rc, j) { cells[rc[0]][rc[1]][w.cdir[j]] = i; }); });

    $("app").classList.toggle("qf", !!p.qf); $("app").classList.toggle("ed", !!p.ed); $("app").classList.toggle("sq", !!(p.ed && ED.sq));
    var saved = p.qf ? {} : p.ed ? { fill: ED.d.f, sel: ED.d.sel, parses: edByNum(ED.d.p), defs: edByNum(ED.d.d) } : store.get("crossword:" + p.id) || {};
    if (!p.ed && blank(saved) && (saved.time || 0) < 5000) saved = {};  // an empty record (older versions saved one for untouched puzzles) is a fresh start
    fill = [];
    for (r = 0; r < R; r++) { fill.push([]); for (c = 0; c < C; c++) fill[r].push((saved.fill && saved.fill[r] && saved.fill[r][c] || " ").trim()); }
    sel = saved.sel && cells[saved.sel.r] && cells[saved.sel.r][saved.sel.c] && !cells[saved.sel.r][saved.sel.c].b
      ? saved.sel : null;
    SOL = decode(p); DEFS = jsonOf(p, "hints"); PARSES = jsonOf(p, "parses");
    hinted = {};
    // Hints per clue: 1 = definition underlined, 2 = definition and clue type, 4 = clue type only (see hintDef, hintType).
    if (Array.isArray(saved.hints)) saved.hints.forEach(function (k) { hinted[k] = 1; });
    else if (saved.hints) hinted = saved.hints;
    HN = helpOf(saved).hn;
    myParses = saved.parses || {};
    myDefs = saved.defs || {};
    // Clues with no known answer yet are listed in p.unsolved; answers the solver adds fill the gaps.
    UNSOLVED = {}; (p.unsolved || []).forEach(function (k) { UNSOLVED[k] = 1; });
    userAns = saved.answers || {}; userSol = {};
    words.forEach(function (w) {
      var a = userAns[w.dir + w.num]; if (!a) return;
      w.cells.forEach(function (rc, i) { userSol[rc[0] + "," + rc[1]] = a[i]; });
    });
    ok = {};
    (saved.ok || []).forEach(function (k) { ok[k] = 1; });
    if (!sel) { var w0 = words[0]; sel = { r: w0.cells[0][0], c: w0.cells[0][1], dir: w0.dir }; }
    if (!p.qf && !p.ed) store.set("crossword:last", p.id);
    elapsed = saved.time || 0; solved = !!saved.solved; since = null; SUB = saved.sub || null; EDITED = !!saved.ed;
    startClock();
    build();
    setMode(p.qf || p.ed ? "easy" : saved.mode || lastMode(p), true);
    USED = typeof saved.used === "number" ? saved.used : saved.fill ? -1 : 3;
    if (USED < 0 && solved) USED = RANK[MODE];  // older finished records: the mode it was played in
    REV = !!saved.rev; REVW = saved.revw || {};
    if (SUB && SUB.res !== "ok") { var was = SUB.res; grade(); if (SUB.res !== was) save(); }  // answers arrived or were corrected since
    render();
  }

  // Answers ship lightly scrambled so they are not readable in the page source.
  function unscramble(b64, key) {
    var raw = atob(b64), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    return new TextDecoder().decode(bytes);
  }
  // Clue text, with the definition underlined once its hint has been shown.
  // Definitions: the solver's own (saved per clue) win over the blog's.
  function defsFor(w) {
    var k = w.dir + w.num;
    if (myDefs[k]) return myDefs[k];
    var d = DEFS && DEFS[w.dir] && DEFS[w.dir][w.num];
    return d ? [d] : [];
  }
  function defSpans(w, defs) {
    var out = [];
    defs.forEach(function (d) {
      var from = 0, at;
      while ((at = w.clue.indexOf(d, from)) >= 0) {
        if (!out.some(function (x) { return at < x[1] && at + d.length > x[0]; })) { out.push([at, at + d.length]); break; }
        from = at + 1;
      }
    });
    return out.sort(function (a, b) { return a[0] - b[0]; });
  }
  // Settings can hide the hints of a finished puzzle (the parsing view still underlines its definition).
  function noHints() { return solved && !!prefs().hideHints; }
  function hintDef(k) { return !!(hinted[k] & 3); }
  function hintType(k) { return !!(hinted[k] & 6); }
  function hintAdd(k, type) { var d = hintDef(k) || !type, t = hintType(k) || type; hinted[k] = d && t ? 2 : d ? 1 : 4; }
  // The definition hint: the definition's words; the whole clue for a cryptic definition or &lit; for a double definition
  // with one definition known, the rest of the clue as the other.
  function hintSpans(w) {
    var t = parseFor(w).type, s = defSpans(w, defsFor(w)), end = w.clue.replace(/\s*\([\d,\-\s]+\)\s*$/, "").length;
    var trim = function (a, b) { var x = w.clue.slice(a, b); a += x.length - x.replace(/^[\s,;:.\u2013\u2014-]+/, "").length; b -= x.length - x.replace(/[\s,;:.?!\u2013\u2014-]+$/, "").length; return a < b ? [[a, b]] : []; };
    if (/&lit|\bCD\b|cryptic def/i.test(t)) return trim(0, end);
    if (/\bDD\b|double def/i.test(t) && s.length === 1) return s[0][0] > 0 ? trim(0, s[0][0]).concat(s) : s.concat(trim(s[0][1], end));
    return s;
  }
  function clueInto(el, w, noType) {
    el.textContent = "";
    if (!noType && noHints()) return el.appendChild(document.createTextNode(w.clue));
    if (!HARD && !noType && hintType(w.dir + w.num)) {
      var tg = mk("span", "ctype", parseFor(w).type);
      el.appendChild(tg);
    }
    // In Hard mode only the solver's own definitions are underlined.
    var k = w.dir + w.num, spans = (HARD && !noType) ? (myDefs[k] ? defSpans(w, myDefs[k]) : []) : hintDef(k) ? hintSpans(w) : [], pos = 0;
    spans.forEach(function (sp) {
      el.appendChild(document.createTextNode(w.clue.slice(pos, sp[0])));
      el.appendChild(mk("u", "def", w.clue.slice(sp[0], sp[1])));
      pos = sp[1];
    });
    el.appendChild(document.createTextNode(w.clue.slice(pos)));
  }
  function decode(p) {
    var flat = solOf(p), rows = [];
    if (!flat) return null;
    for (var r = 0; r < R; r++) rows.push(flat.substr(r * C, C));
    return rows;
  }

  // A puzzle with no letters in it that was never stored is not saved: an empty record dated now would look newer
  // than real progress synced from another device and replace it.
  function blank(v) {
    return !!(v && v.fill && !v.solved && v.fill.join("").trim() === "");
  }
  // The clock and the cursor alone don't date or upload the record: a device left open on a puzzle would otherwise
  // look newer than progress made since on another device and overwrite it.
  function save() {
    if (P.qf) return qfSave();
    if (P.ed) return edSave();
    var k = "crossword:" + P.id, old = store.peek(k);
    if (!old && !solved && !fill.some(function (row) { return row.some(function (x) { return x; }); })) return;
    var rec = {
      fill: fill.map(function (row) { return row.map(function (x) { return x || " "; }).join(""); }),
      ok: Object.keys(ok), time: now(), solved: solved, mode: MODE, used: USED, rev: REV, revw: REVW, hn: HN, ed: EDITED, hints: hinted || {}, parses: myParses, defs: myDefs, answers: userAns, sub: SUB,
      np: solved && !PARSES ? 1 : undefined, sel: sel  // finished before its parsings: the bell says when they arrive
    };
    var same = old && core(old) === core(rec);
    rec.at = same ? old.at : Date.now();
    (same ? store.local : store.set)(k, rec);
  }
  // Quickfire saves only parsing edits, into the clue's own puzzle record.
  function qfSave() {
    var k = "crossword:" + QF.c.p.id, old = store.get(k) || {}, rec = Object.assign({}, old);
    [["parses", myParses], ["defs", myDefs]].forEach(function (f) {
      var m = Object.assign({}, old[f[0]]);
      if (f[1].a1) m[QF.c.k] = f[1].a1; else delete m[QF.c.k];
      if (old[f[0]] || f[1].a1) rec[f[0]] = m;
    });
    if (core(rec) === core(old)) return;
    rec.at = Date.now(); store.set(k, rec);
    QF.c.mine = myParses.a1; QF.c.t = qfTypes(QF.c.mine || QF.c.blog);
  }
  function core(v) {
    var o = {}; Object.keys(v).forEach(function (k) { if (k !== "time" && k !== "sel" && k !== "at") o[k] = v[k]; });
    return JSON.stringify(o);
  }

  function metaText(p) {
    var d = p.date ? new Date(p.date + "T12:00:00") : null;
    return [p.setter, d && !isNaN(d) ? fmtDate(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : ""].filter(Boolean).join(" \u00b7 ");
  }
