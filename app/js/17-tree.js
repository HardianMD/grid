  // A parsing as a tree of rules: leaves are clue words, branches are wordplay operations with their indicators.
  // The format and this checker are the same as crossword-data's tools/tree.py, which documents every node; both run
  // the cases in tools/tree-cases.json (here from tools/check.js). Change the two together.
  //   leaves:   lit {w}  syn {w?, l, xr?}  abr {w?, l}            (w = [start, end) in the clue)
  //   branches: cat {of: []}  pick {of, at, hid?}  cut {of, at}  rev {of}  anag {of}  ins {out, in}  snd {of, l}  chg {of, l}  mov {of, l}  swp {of, l}  spn {of}
  //   each branch may carry ind: [span, ...]; a parsing is {t?, def: [span], kind?: dd|cd|&lit, pal?, ind?}
  var T_OPS = ["lit", "syn", "abr", "cat", "pick", "cut", "rev", "anag", "ins", "snd", "chg", "mov", "swp", "spn"];
  function tLetters(s) { return String(s || "").toUpperCase().replace(/[^A-Z]/g, ""); }
  function tText(clue, w) { return clue.slice(w[0], w[1]); }
  function tKids(n) { return n.op === "cat" ? n.of : n.op === "ins" ? [n.out, n.in] : n.of ? [n.of] : []; }
  // The first and last words swap their opening consonants: NOSY COOK to COSY NOOK.
  function tSpoon(ws) {
    if (ws.length < 2) return null;
    var on = function (w) { return w.match(/^(QU|[^AEIOUY]*)/)[1]; }, a = ws[0], b = ws[ws.length - 1], x = on(a), y = on(b);
    return [y + a.slice(x.length)].concat(ws.slice(1, -1), [x + b.slice(y.length)]).join("");
  }
  function tWords(n, clue) {
    if (n.op === "lit") return tText(clue, n.w).split(/\s+/).map(tLetters).filter(Boolean);
    if (n.op === "cat") return [].concat.apply([], n.of.map(function (k) { return tWords(k, clue) || [null]; }));
    var v = tMake(n, clue); return v ? [v] : null;
  }
  // Is b the letters of a with one letter, or one run of letters, moved elsewhere?
  function tMoved(a, b) {
    if (a.length !== b.length || a === b || a.split("").sort().join("") !== b.split("").sort().join("")) return false;
    for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) {
      var rest = a.slice(0, i) + a.slice(j);
      for (var p = 0; p <= rest.length; p++) if (rest.slice(0, p) + a.slice(i, j) + rest.slice(p) === b) return true;
    }
    return false;
  }
  // The letters a part gives in order, or null when they depend on the answer (an anagram, an unplaced container).
  function tMake(n, clue) {
    var op = n.op, c, o, i;
    if (op === "lit") return tLetters(tText(clue, n.w));
    if (op === "syn" || op === "abr" || op === "snd" || op === "chg") return tLetters(n.l);
    if (op === "cat") { var out = n.of.map(function (k) { return tMake(k, clue); }); return out.indexOf(null) >= 0 ? null : out.join(""); }
    if (op === "pick" || op === "cut") {
      c = tMake(n.of, clue);
      if (c == null || n.at.some(function (j) { return j >= c.length; })) return null;
      if (op === "pick") return n.at.map(function (j) { return c[j]; }).join("");
      return c.split("").filter(function (ch, j) { return n.at.indexOf(j) < 0; }).join("");
    }
    if (op === "rev") { c = tMake(n.of, clue); return c == null ? null : c.split("").reverse().join(""); }
    if (op === "mov") { c = tMake(n.of, clue); o = tLetters(n.l); return c != null && tMoved(c, o) ? o : null; }
    if (op === "swp") {  // exactly two letters trade places
      c = tMake(n.of, clue); o = tLetters(n.l);
      var d = c != null && c.length === o.length ? o.split("").map(function (x, j) { return x !== c[j] ? j : -1; }).filter(function (j) { return j >= 0; }) : [];
      return d.length === 2 && c[d[0]] === o[d[1]] && c[d[1]] === o[d[0]] ? o : null;
    }
    if (op === "spn") { var ws = tWords(n.of, clue); return ws && ws.indexOf(null) < 0 ? tSpoon(ws) : null; }
    if (op === "ins" && n.k != null) { o = tMake(n.out, clue); i = tMake(n.in, clue); return o == null || i == null ? null : o.slice(0, n.k) + i + o.slice(n.k); }
    return null;
  }
  // How many letters a part gives; every part's length is known without the answer.
  function tSize(n, clue) {
    var op = n.op;
    if (op === "cat") return n.of.reduce(function (s, k) { return s + tSize(k, clue); }, 0);
    if (op === "ins") return tSize(n.out, clue) + tSize(n.in, clue);
    if (op === "rev" || op === "anag") return tSize(n.of, clue);
    if (op === "pick") return n.at.length;
    if (op === "cut") return tSize(n.of, clue) - n.at.length;
    var v = tMake(n, clue); return v == null ? 0 : v.length;
  }
  // The coloured pieces: a charade's and a container's parts, through reversals of them; any other part is one piece.
  function tUnits(t) {
    var out = new Map();
    (function walk(n) {
      if (n.op === "cat" || n.op === "ins" || n.op === "rev" && (n.of.op === "cat" || n.of.op === "ins")) tKids(n).forEach(walk);
      else out.set(n, out.size);
    })(t);
    return out;
  }
  // Can this part give exactly these letters? The piece index of each letter, or null. A container tries each place
  // for its inner part and keeps the first that works (in k).
  function tFit(n, target, clue, us, u) {
    if (us.has(n)) u = us.get(n);
    var op = n.op, r, fill = function () { return target.split("").map(function () { return u; }); };
    if (op === "cat") {
      var out = [], at = 0;
      for (var j = 0; j < n.of.length; j++) {
        var L = tSize(n.of[j], clue); r = L ? tFit(n.of[j], target.substr(at, L), clue, us, u) : null;
        if (!r) return null;
        out = out.concat(r); at += L;
      }
      return at === target.length ? out : null;
    }
    if (op === "ins") {
      var Lo = tSize(n.out, clue), Li = tSize(n.in, clue), ks = n.k != null ? [n.k] : [];
      if (Lo + Li !== target.length || Lo < 2) return null;
      for (var k = 1; k < Lo; k++) ks.push(k);
      for (var q = 0; q < ks.length; q++) {
        var ro = tFit(n.out, target.slice(0, ks[q]) + target.slice(ks[q] + Li), clue, us, u), ri = ro && tFit(n.in, target.substr(ks[q], Li), clue, us, u);
        if (ro && ri) { n.k = ks[q]; return ro.slice(0, ks[q]).concat(ri, ro.slice(ks[q])); }
      }
      return null;
    }
    if (op === "rev") { r = tFit(n.of, target.split("").reverse().join(""), clue, us, u); return r ? r.reverse() : null; }
    if (op === "anag") {
      var f = tMake(n.of, clue), srt = function (s) { return s.split("").sort().join(""); };
      return f != null && target && srt(f) === srt(target) ? fill() : null;
    }
    var v = tMake(n, clue);
    return v && v === target ? fill() : null;
  }
  // Parts taken on the solver's word: sounds (unless the pronunciation dictionary bore them out, "heard": the
  // updater's sounds.py) and letter changes.
  function tTrusted(n) { return n.op === "snd" && !n.heard || n.op === "chg" || tKids(n).some(tTrusted); }
  // 2 = the tree gives the answer letter for letter; 1 = it does, leaning on a sound or change; 0 = it doesn't (or no tree).
  function tCheck(p, clue, answer) {
    var t = p && p.t;
    if (!t) return 0;
    return !tFit(t, tLetters(answer), clue, tUnits(t)) ? 0 : tTrusted(t) ? 1 : 2;
  }
  // Problems with a node's shape (none when it is well formed).
  function tValid(n) {
    var op = n && n.op, bad = [];
    if (T_OPS.indexOf(op) < 0) return ["unknown op " + op];
    if (op === "lit" && !n.w || /^(syn|abr|snd|chg|mov|swp)$/.test(op) && !n.l) bad.push(op + " without its letters");
    if (op === "cat" && !((n.of || []).length >= 2)) bad.push("cat with fewer than two parts");
    if ((op === "pick" || op === "cut") && !(n.at || []).length) bad.push(op + " without letters");
    if (op === "ins" && !(n.out && n.in)) bad.push("ins without both parts");
    if (!/^(lit|syn|abr|cat|ins)$/.test(op) && !n.of) bad.push(op + " without its part");
    if (!bad.length) tKids(n).forEach(function (k) { bad = bad.concat(tValid(k)); });
    return bad;
  }

  // ---------- from the old flat structure (a list of pieces placed in the answer), as tree.py's from_flat ----------
  // Where the words w sit in the clue: at offset c when given, else the first whole-word match, else anywhere.
  function tSpan(clue, w, c) {
    if (!w) return null;
    var low = clue.toLowerCase(), t = w.toLowerCase(), a = -1, L = /\p{L}/u;
    if (c != null && low.substr(c, t.length) === t) return [c, c + t.length];
    while ((a = low.indexOf(t, a + 1)) >= 0) {
      var b = a + t.length;
      if (!(a && L.test(low[a - 1])) && !(b < low.length && L.test(low[b]))) return [a, b];
    }
    a = low.indexOf(t);
    return a >= 0 ? [a, a + t.length] : null;
  }
  function tRange(a, b) { var out = []; for (var i = a; i < b; i++) out.push(i); return out; }
  // Which letters of the words (by index into their letters joined) give kept: first or last letters of each word,
  // the start or end, the two ends, the odd or even letters, the middle, a run inside, or the first that fit.
  function tPickAt(words, kept) {
    var full = words.join(""), n = full.length, k = kept.length, s = 0, starts = words.map(function (w) { var a = s; s += w.length; return a; });
    var m = Math.floor((n - k) / 2), odd = [], even = [];
    for (var i = 0; i < n; i++) (i % 2 ? even : odd).push(i);
    var tries = [starts, starts.map(function (a, j) { return a + words[j].length - 1; }), tRange(0, k), tRange(n - k, n), [0, n - 1], odd, even, tRange(m, m + k)];
    for (var q = 0; q < tries.length; q++) {
      var at = tries[q];
      if (at.length === k && at.every(function (j) { return j >= 0 && j < n; }) && at.map(function (j) { return full[j]; }).join("") === kept) return at;
    }
    i = full.indexOf(kept);
    if (i >= 0) return tRange(i, i + k);
    var got = [], j = 0;
    for (i = 0; i < n; i++) if (j < k && full[i] === kept[j]) { got.push(i); j++; }
    return j === k ? got : null;
  }
  // Which letters of full are dropped to leave kept: a run at the end, the start, or inside; else the first that fit.
  function tCutAt(full, kept) {
    var r = full.length - kept.length;
    if (r <= 0) return null;
    var tries = [kept.length, 0].concat(tRange(1, kept.length));
    for (var q = 0; q < tries.length; q++) { var i = tries[q]; if (full.slice(0, i) + full.slice(i + r) === kept) return tRange(i, i + r); }
    var keep = tPickAt([full], kept);
    return keep ? tRange(0, full.length).filter(function (j) { return keep.indexOf(j) < 0; }) : null;
  }
  // Letter indices of the characters a..b (inclusive) of w.
  function tLetterIndex(w, a, b) {
    var out = [], n = 0;
    for (var i = 0; i < w.length; i++) if (/\p{L}/u.test(w[i])) { if (a <= i && i <= b) out.push(n); n++; }
    return out;
  }
  function tWith(n, w) { if (w) n.w = w; return n; }
  // One old piece as a small tree. seg = the answer letters it lands on, in answer order.
  function tLeaf(q, clue, seg) {
    var o = q.o, l = tLetters(q.l), f = tLetters(q.f), w = tSpan(clue, q.w, q.c), wl = w ? tLetters(tText(clue, w)) : "";
    var ws = w ? tText(clue, w).split(/\s+/).map(tLetters).filter(Boolean) : [];
    var srt = function (s) { return s.split("").sort().join(""); };
    var src = function (full) { return w && wl === full ? { op: "lit", w: w } : tWith({ op: "syn", l: full }, w); };
    if (o === "lit") return w && wl === l ? { op: "lit", w: w } : src(l);
    if (o === "syn" || o === "abr") return tWith({ op: o, l: l }, w);
    if (/^(sel|ini|alt|hid)$/.test(o)) {
      var hid = o === "hid" ? { hid: 1 } : {};
      if (q.x && w) return Object.assign({ op: "pick", of: { op: "lit", w: w }, at: tLetterIndex(tText(clue, w), q.x[0], q.x[1]) }, hid);
      var fw = w && (!f || wl === f) ? ws : f ? [f] : ws;
      for (var back = 0; back < 2; back++) {
        var at = fw.length ? tPickAt(fw, back ? seg.split("").reverse().join("") : seg) : null;
        if (at && at.length) { var p = Object.assign({ op: "pick", of: src(fw.join("")), at: at }, hid); return back ? { op: "rev", of: p } : p; }
      }
      return src(l);
    }
    if (o === "del") {
      var full = f || wl, d = q.d && q.d.length ? q.d : tCutAt(full, l);
      return d && d.length ? { op: "cut", of: src(full), at: d } : src(l);
    }
    if (o === "anag") {
      if (q.x && w) return { op: "anag", of: { op: "pick", of: { op: "lit", w: w }, at: tLetterIndex(tText(clue, w), q.x[0], q.x[1]) } };
      return { op: "anag", of: w && srt(wl) === srt(seg) ? { op: "lit", w: w } : tWith({ op: "syn", l: l }, w) };
    }
    if (o === "rev") {
      var fwd = seg.split("").reverse().join(""), inner = !f ? src(fwd) : { op: "cut", of: src(f), at: tCutAt(f, fwd) || [] };
      if (!f && w && wl !== fwd) inner = { op: "syn", l: fwd, w: w };
      return { op: "rev", of: inner };
    }
    if (o === "snd") return { op: "snd", l: seg, of: tWith({ op: "syn", l: l }, w) };
    if (o === "chg") return { op: "chg", l: seg, of: src(f || l) };
    if (o === "spn") {
      var sw = String(q.f || "").split(/\s+/).map(tLetters).filter(Boolean);
      if (w && ws.join(" ") === sw.join(" ")) return { op: "spn", of: { op: "lit", w: w } };
      return { op: "spn", of: sw.length > 1 ? { op: "cat", of: sw.map(function (x) { return { op: "syn", l: x }; }) } : src(l) };
    }
    return src(l);
  }
  // The old structure {p: [{l, o, at, w, c?, x?, f?, d?}], ind, it?, rv?, def, defs, dev} as a parsing tree.
  function tFromFlat(s, clue, answer) {
    var ans = tLetters(answer), dev = s.dev || [], ps = s.p || [];
    var out = { def: (s.defs && s.defs.length ? s.defs : s.def ? [s.def] : []).map(function (d) { return tSpan(clue, d); }).filter(Boolean) };
    if (dev.indexOf("Double definition") >= 0 && !ps.length) out.kind = "dd";
    else if (dev.indexOf("Cryptic definition") >= 0 && !ps.length) out.kind = "cd";
    if (dev.indexOf("&lit") >= 0) out.kind = "&lit";
    if (dev.indexOf("Palindrome") >= 0) out.pal = true;
    if (ps.length) { var t = tBest(ps, s.rv || [], clue, ans); if (t) out.t = t; }
    // indicators: tied to the operation they most plainly signal (the solver's chosen kind, else the nearest)
    var kinds = s.it || [], inds = [];
    (s.ind || []).forEach(function (x, i) { var sp = tSpan(clue, x); if (sp) inds.push([sp, kinds[i] || "", i]); });
    var loose = tAttach(out.t, inds, clue);
    if (loose.length) out.ind = loose;
    tStrip(out.t);
    return out;
  }
  function tSeg(ans, q) { return q.at.map(function (a) { return ans.substr(a[0], a[1]); }).join(""); }
  // The first reading of the old pieces whose tree gives the answer: as placed (a backwards container mirrored, then
  // else their charade in clue order backwards,
  // else a container around its reversed outer part, else the charade forwards.
  function tBest(ps, rv, clue, ans) {
    var clueOrder = function (back) {
      var ks = ps.map(function (q) { var g = tSeg(ans, q); return tLeaf(q, clue, g === tLetters(q.l) ? g : tLetters(q.l)); });
      var t = ks.length === 1 ? ks[0] : { op: "cat", of: ks };
      return back ? { op: "rev", of: t } : t;
    };
    var tries = [function () { return tPlaced(ps, rv, clue, ans, true); }, function () { return clueOrder(true); },
      function () { return tPlaced(ps, rv, clue, ans, false); }, function () { return clueOrder(false); }], first = null;
    for (var i = 0; i < tries.length; i++) {
      var t;
      try { t = tries[i](); } catch (e) { continue; }
      first = first || t;
      if (t && tCheck({ t: t }, clue, ans)) return t;
    }
    return first;
  }
  // Old pieces, each placed in the answer by "at", as a tree. A container whose outer piece lands backwards in the
  // answer is a reversal of the whole container (mirror), or else a container around the reversed outer part.
  function tPlaced(ps, rv, clue, ans, mirror) {
    var end = function (q) { var z = q.at[q.at.length - 1]; return z[0] + z[1]; };
    var backwards = function (q) { var g = tSeg(ans, q), l = tLetters(q.l); return q.at.length === 2 && g !== l && g.split("").reverse().join("") === l && q.o !== "rev"; };
    for (var j = 0; j < ps.length; j++) {
      var q = ps[j];
      if (!(mirror && backwards(q))) continue;
      var lo = q.at[0][0], hi = q.at[1][0] + q.at[1][1];
      var inside = ps.filter(function (x) { return lo <= x.at[0][0] && end(x) <= hi; });
      var flip = function (x) {
        var at = x.at.map(function (a) { return [lo + hi - a[0] - a[1], a[1]]; }).sort(function (u, v) { return u[0] - v[0] || u[1] - v[1]; });
        return Object.assign({}, x, { at: at, o: x.o === "rev" ? "syn" : x.o });
      };
      var back = ans.slice(0, lo) + ans.slice(lo, hi).split("").reverse().join("") + ans.slice(hi);
      var node = { op: "rev", of: tPlaced(inside.map(flip), [], clue, back, true) };
      var rest = ps.filter(function (x) { return inside.indexOf(x) < 0; });
      return tPlaced(rest.concat([{ l: "", o: "_node", at: [[lo, hi - lo]], _node: node }]), rv, clue, ans, true);
    }
    var nodes = ps.map(function (q) {
      return q.o === "_node" ? q._node : backwards(q) ? { op: "rev", of: tLeaf(q, clue, tSeg(ans, q).split("").reverse().join("")) } : tLeaf(q, clue, tSeg(ans, q));
    });
    // pieces reversed together become one block: a reversal of their charade, in clue order
    var blocks = [], grouped = {};
    rv.forEach(function (g) {
      var mem = g.p.filter(function (i) { return i < ps.length; });
      if (!mem.length) return;
      var ks = mem.map(function (i) { return nodes[i].op === "rev" ? nodes[i].of : nodes[i]; });
      var node = { op: "rev", of: ks.length > 1 ? { op: "cat", of: ks } : ks[0], _ind: g.i };
      blocks.push([Math.min.apply(null, mem.map(function (i) { return ps[i].at[0][0]; })),
        Math.max.apply(null, [].concat.apply([], mem.map(function (i) { return ps[i].at.map(function (a) { return a[0] + a[1]; }); }))), node]);
      mem.forEach(function (i) { grouped[i] = 1; });
    });
    ps.forEach(function (q, i) { if (!grouped[i]) blocks.push([q.at[0][0], end(q), nodes[i], q.at]); });
    return tArrange(blocks.sort(function (u, v) { return u[0] - v[0]; }));
  }
  // Pieces in answer order as a tree: a piece placed in two parts holds the pieces between them (a container).
  function tArrange(blocks) {
    var seq = [], i = 0;
    while (i < blocks.length) {
      var b = blocks[i], at = b[3];
      if (at && at.length === 2) {
        var lo = at[0][0] + at[0][1], hi = at[1][0], inner = [], j = i + 1;
        while (j < blocks.length && blocks[j][0] >= lo && blocks[j][1] <= hi) inner.push(blocks[j++]);
        seq.push(inner.length ? { op: "ins", out: b[2], in: tArrange(inner), k: at[0][1] } : b[2]);
        i = j;
      } else { seq.push(b[2]); i++; }
    }
    seq = seq.filter(Boolean);
    return !seq.length ? null : seq.length === 1 ? seq[0] : { op: "cat", of: seq };
  }
  // Words that put one piece next to another ("A and B", "A on B", "A next to B"): a charade's indicator (as tree.py's JOINS).
  var T_JOINS = ["and", "on", "over", "next to", "with", "by", "beside", "besides", "after", "before", "following", "follows", "followed by", "alongside", "joining", "joins", "joined to", "meeting", "meets", "plus", "then", "upon", "above", "below", "under", "beneath", "on top of", "atop", "adding", "added to", "attached to", "against", "near", "behind", "in front of", "ahead of", "preceding", "precedes", "succeeded by", "to", "has", "having", "gets", "getting", "takes", "taking", "abutting", "touching", "adjoining", "by the side of", "close to"];
  var T_IND_KIND = { Charade: "cat", Reversal: "rev", Container: "ins", Anagram: "anag", Deletion: "cut", "Letter selection": "pick", Hidden: "pick", Homophone: "snd", Spoonerism: "spn", "Letter change": "chg", "Letter move": "mov", "Letter swap": "swp" };
  function tWalk(n) { return [n].concat.apply([n], tKids(n).map(tWalk)); }
  // The clue spans a node's words cover, child by child.
  function tReach(n) {
    return tKids(n).map(function (k) {
      var ws = tWalk(k).filter(function (x) { return x.w; }).map(function (x) { return x.w; });
      return ws.length ? [Math.min.apply(null, ws.map(function (w) { return w[0]; })), Math.max.apply(null, ws.map(function (w) { return w[1]; }))] : null;
    }).filter(Boolean);
  }
  // Gives each indicator ([span, kind, index]) to an operation: the kind the solver chose if any, then the nearest
  // operation still without one, of a kind the words are known to signal (INDS) when there is one. Returns the
  // indicators left over.
  function tAttach(t, inds, clue) {
    var ops = t ? tWalk(t) : [];
    ops.forEach(function (n) {
      if (!("_ind" in n)) return;
      var hit = inds.filter(function (x) { return x[2] === n._ind; })[0];
      if (hit) { n.ind = [hit[0]]; inds = inds.filter(function (x) { return x !== hit; }); }
    });
    var cand = ops.filter(function (n) { return /^(cat|rev|ins|anag|cut|pick|snd|spn|chg|mov|swp)$/.test(n.op) && !n.ind; }), pairs = [];
    inds.forEach(function (it) {
      var x = it[0], kind = it[1], k = indKey(clue.slice(x[0], x[1])), says = kind ? [] : (INDS[k] || []).concat(T_JOINS.indexOf(k) >= 0 ? ["cat"] : []);
      if (says.indexOf("pick") >= 0 || says.indexOf("cut") >= 0) says = says.concat(["pick", "cut"]);  // letters kept or dropped: the same words say either
      if (!cand.some(function (n) { return says.indexOf(n.op) >= 0; })) says = [];
      cand.forEach(function (n) {
        if (kind && T_IND_KIND[kind] !== n.op || says.length && says.indexOf(n.op) < 0) return;
        if (n.op === "cat" && !kind && says.indexOf("cat") < 0) return;  // only a join's own words join
        var rs = tReach(n);
        if (!rs.length || tWalk(n).some(function (y) { return y.w && y.w[0] < x[1] && x[0] < y.w[1]; })) return;
        var gap = Math.min.apply(null, rs.map(function (r) { return Math.max(r[0] - x[1], x[0] - r[1], 0); }));
        var size = Math.max.apply(null, rs.map(function (r) { return r[1]; })) - Math.min.apply(null, rs.map(function (r) { return r[0]; }));
        pairs.push([gap, size, x, n, says.length ? 0 : 1, kind]);
      });
    });
    var used = {}, taken = [];
    pairs.sort(function (u, v) { return u[4] - v[4] || u[0] - v[0] || u[1] - v[1]; }).forEach(function (p) {  // words known to signal the kind go first
      if (used[p[2]] || taken.indexOf(p[3]) >= 0) return;
      p[3].ind = [p[2]]; used[p[2]] = 1; taken.push(p[3]);
      if (p[5] === "Hidden") p[3].hid = 1;  // a hidden word's indicator: the letters picked are a hidden word
    });
    return inds.map(function (it) { return it[0]; }).filter(function (x) { return !used[x]; });
  }
  function tStrip(n) { if (n) { delete n._ind; tKids(n).forEach(tStrip); } }
