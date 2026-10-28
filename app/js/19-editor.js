  // The parse editor, on the parsing's tree (17-tree.js). The clue's words are tappable (DTOK); in Letters mode any
  // letters toggle one by one. Words or letters become pieces (leaves); pieces are selected and wrapped in an
  // operation (a charade, container, reversal, anagram, cut, ...), and an operation takes the words that indicate it.
  // One indicator covers everything inside its operation, and the same words can indicate more than one. The tray
  // shows the pieces as a tree; the parsing is checked live by working out its letters.
  var DTOK = [], PE = { w: null, sel: null, lmode: false, lset: [], parts: [], pick: [], ask: null, target: null, ind: [], whole: [], old: "", oldType: "" };
  var WROLES = [["Definition", "def"], ["Indicator", "ind"], ["As written", "lit"], ["Synonym…", "syn"], ["Abbreviation…", "abr"]];
  var LROLES = [["Picked letters", "pick"], ["Letters cut out", "cut"]];
  var WRAP1 = [["Reversal", "rev"], ["Anagram", "anag"], ["Drop letters…", "cut"], ["Pick letters…", "pick"], ["Sounds like…", "snd"], ["Letter change…", "chg"], ["Spoonerism", "spn"]];
  var WRAPN = [["Charade", "cat"], ["Container…", "ins"], ["Reversal", "rev"], ["Anagram", "anag"]];
  var WHOLE = [["Double definition", "dd"], ["Cryptic definition", "cd"], ["&lit", "&lit"], ["Palindrome", "pal"]];
  var OPNAME = { lit: "As written", syn: "Synonym", abr: "Abbreviation", cat: "Charade", ins: "Container", rev: "Reversal", anag: "Anagram", cut: "Letters dropped",
    pick: "Letters picked", snd: "Sounds like", chg: "Letter change", spn: "Spoonerism" };
  WROLES.forEach(function (r) { $("bRoles").appendChild(mk("button", "chip" + (r[1] === "def" ? " def" : ""), r[0])).dataset.r = r[1]; });
  LROLES.forEach(function (r) { $("bLRoles").appendChild(mk("button", "chip", r[0])).dataset.r = r[1]; });
  WHOLE.forEach(function (r) { $("bWhole").appendChild(mk("button", "chip", r[0])).dataset.k = r[1]; });

  function bLetters(s) { return String(s || "").toUpperCase().replace(/[^A-Z]/g, ""); }
  function bText(a, b) { return DTOK.clue.slice(DTOK[a].a, DTOK[b].b).replace(/[,;:.!?–—-]+$/, ""); }
  // The clue span of tokens a..b, less trailing punctuation.
  function bSpan(a, b) { return [DTOK[a].a, DTOK[a].a + bText(a, b).length]; }
  // The answer as far as it is known: the solution, else the squares filled (or typed in Your answer).
  function bAnswer() {
    var w = PE.w; if (!w) return "";
    var typed = !$("ansRow").hidden && bLetters($("ansInput").value);
    var a = typed || w.cells.map(function (rc) { return solAt(rc[0], rc[1]) || fill[rc[0]][rc[1]] || "?"; }).join("");
    return a.length === w.cells.length && a.indexOf("?") < 0 ? a : "";
  }
  function buildDefPick(w, defs) {
    var box = $("defPick"), body = w.clue.replace(/\s*\([\d,\-\s]+\)\s*$/, ""), re = /\S+/g, m;
    box.innerHTML = ""; DTOK = [];
    var pos = 0;
    while ((m = re.exec(body))) {
      if (m.index > pos) box.appendChild(document.createTextNode(body.slice(pos, m.index)));
      var t = mk("span", "tok"), a = m.index, b = a + m[0].length, chars = [];
      m[0].split("").forEach(function (ch, k) {
        var c = t.appendChild(mk("span", "ch", ch)); c.dataset.c = a + k; chars.push(c);
        c.addEventListener("click", function (e) { if (PE.lmode) { e.stopPropagation(); lTap(+this.dataset.c); } });
      });
      defs.forEach(function (sp, n) { if (a < sp[1] && b > sp[0]) { t.classList.add("on"); t.dataset.d = n; } });
      t.dataset.i = DTOK.length; t.addEventListener("click", function () { if (!PE.lmode) bTap(+this.dataset.i); });
      box.appendChild(t); DTOK.push({ el: t, a: a, b: b, chars: chars });
      pos = b;
    }
    DTOK.clue = w.clue;
  }
  function bTap(i) {
    var s = PE.sel;
    PE.sel = !s || s[0] !== s[1] ? [i, i] : s[0] === i ? null : [Math.min(s[0], i), Math.max(s[0], i)];
    PE.ask = null; bRender();
  }
  // Letters toggle one at a time: any letters, next to each other or not, in one word or several.
  function lTap(c) {
    if (!/[a-z]/i.test(DTOK.clue[c])) return;
    var i = PE.lset.indexOf(c);
    if (i >= 0) PE.lset.splice(i, 1); else PE.lset.push(c);
    PE.lset.sort(function (x, y) { return x - y; }); PE.sel = null; PE.ask = null; bRender();
  }
  $("bLetters").addEventListener("click", function () {
    PE.lmode = !PE.lmode; this.setAttribute("aria-pressed", String(PE.lmode));
    PE.sel = null; PE.lset = []; PE.ask = null; bRender();
  });
  // Where a part's words start in the clue, for clue order.
  function bAt(n) { var a = 1e6; (function g(k) { if (k.w) a = Math.min(a, k.w[0]); tKids(k).forEach(g); })(n); return a; }
  // A new piece; letters picked or cut are an operation already, so the next indicator tapped is theirs.
  function bAdd(n) {
    PE.parts.push(n); var op = n.op === "pick" || n.op === "cut";
    if (op) bClaim(n);
    PE.pick = op ? [PE.parts.length - 1] : []; PE.target = op ? n : null; PE.sel = null; PE.lset = []; PE.ask = null; bRender();
  }
  // The words' role: the definition, an indicator, or a piece.
  function bRole(r, letters) {
    var s = PE.sel; if (!s) return;
    var w = bSpan(s[0], s[1]), text = bText(s[0], s[1]);
    if (r === "def") { defOn(s[0], s[1]); PE.sel = null; return bRender(); }
    // an indicator: say what it signals; it goes on the step just made if that is its kind, else waits for the
    // next step of its kind (tap the pieces, then that step)
    if (r === "ind") { PE.ask = { ind: w }; return bRender(); }
    if (r === "lit") return bAdd({ op: "lit", w: w });
    if (letters == null) {
      PE.ask = { r: r };
      $("bLet").value = r === "abr" ? (abbrOf(text).filter(function (x) { return bAnswer().indexOf(x) >= 0; })[0] || abbrOf(text)[0] || "") : "";
      $("bLet").placeholder = r === "abr" ? "Letters it is short for, e.g. S" : "Letters it stands for, e.g. AB";
      bRender(); try { $("bLet").focus(); } catch (e) {}
      return;
    }
    var l = bLetters(letters);
    if (!l) return toast("No letters given");
    bAdd({ op: r, w: w, l: l });
  }
  $("bRoles").addEventListener("click", function (e) { var b = e.target.closest(".chip"); if (b && !b.disabled) bRole(b.dataset.r); });
  // Letters tapped: picked as they stand, or cut out of the words around them.
  $("bLRoles").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"), cs = PE.lset; if (!b || !cs.length) return;
    var t0 = DTOK.filter(function (x) { return x.a <= cs[0] && cs[0] < x.b; })[0], t1 = DTOK.filter(function (x) { return x.a <= cs[cs.length - 1] && cs[cs.length - 1] < x.b; })[0];
    var w = [t0.a, t1.b], lit = { op: "lit", w: w }, chars = tLitChars(lit, DTOK.clue), at = cs.map(function (c) { return chars.indexOf(c); });
    while (!/[a-z]/i.test(DTOK.clue[w[1] - 1])) w[1]--;  // trailing punctuation
    if (b.dataset.r === "cut" && at.length >= chars.length) return toast("That cuts every letter");
    bAdd({ op: b.dataset.r, of: lit, at: at });
  });
  // Selected parts wrapped in an operation. Several parts are put in the order whose letters sit in the answer
  // (backwards for a reversal), else in clue order.
  function bOrder(ns, back) {
    var ans = bAnswer(), byClue = ns.slice().sort(function (x, y) { return bAt(x) - bAt(y); });
    if (!ans || ns.length > 6) return byClue;
    var best = null;
    (function perm(done, left) {
      if (best) return;
      if (!left.length) {
        var l = tMake({ op: "cat", of: done }, DTOK.clue);
        if (l && ans.indexOf(back ? l.split("").reverse().join("") : l) >= 0) best = done;
        return;
      }
      left.forEach(function (n, i) { perm(done.concat([n]), left.slice(0, i).concat(left.slice(i + 1))); });
    })([], byClue);
    return best || byClue;
  }
  // An indicator tapped first waits, with its kind, for the next step of that kind.
  function bClaim(n) {
    var i = PE.ind.map(function (x) { return x.op; }).indexOf(n.op);
    if (i >= 0) { (n.ind = n.ind || []).push(PE.ind[i].w); PE.ind.splice(i, 1); }
  }
  var IND_KINDS = [["Container", "ins"], ["Anagram", "anag"], ["Reversal", "rev"], ["Letters picked", "pick"], ["Hidden word", "pick"], ["Letters dropped", "cut"], ["Sounds like", "snd"],
    ["Spoonerism", "spn"], ["Letter change", "chg"]];
  function bIndKind(op, name) {
    var w = PE.ask.ind, to = PE.target || PE.pick.length === 1 && PE.parts[PE.pick[0]];
    if (to && to.op === op) (to.ind = to.ind || []).push(w);
    else { PE.ind.push({ w: w, op: op, name: name }); PE.pick = []; PE.target = null; }  // now its pieces are tapped
    PE.ask = null; PE.sel = null; bRender();
  }
  // A container of the selected parts with part i outside.
  function bIns(ns, i) {
    var rest = ns.filter(function (x, j) { return j !== i; });
    return { op: "ins", out: ns[i], in: rest.length === 1 ? rest[0] : { op: "cat", of: bOrder(rest, false) } };
  }
  // Which of the selected parts can go outside and give a run of the answer's letters.
  function bInsFits(ns) {
    var ans = bAnswer(), clue = DTOK.clue;
    return ns.map(function (x, i) {
      var t = JSON.parse(JSON.stringify(bIns(ns, i))), L = tSize(t, clue);
      for (var a = 0; ans && a + L <= ans.length; a++) if (tFit(t, ans.substr(a, L), clue, new Map())) return true;
      return false;
    });
  }
  function bWrap(op, extra) {
    var ns = PE.pick.map(function (i) { return PE.parts[i]; }), one = ns.length === 1 ? ns[0] : null, n;
    if (!ns.length) return;
    if (op === "ins" && extra == null && ns.length > 1) {  // when only one way round gives the answer's letters, take it
      var fits = bInsFits(ns);
      if (fits.filter(Boolean).length === 1) extra = fits.indexOf(true);
    }
    if ((op === "cut" || op === "pick" || op === "snd" || op === "chg") && extra == null || op === "ins" && extra == null && ns.length > 1) {
      PE.ask = { op: op, drop: [] };
      if (op === "snd" || op === "chg") { $("bLet").value = ""; $("bLet").placeholder = op === "snd" ? "Letters as they sound in the answer, e.g. BRAKE" : "Letters it becomes, e.g. FEAST"; }
      bRender(); if (op === "snd" || op === "chg") try { $("bLet").focus(); } catch (e) {}
      return;
    }
    if (op === "cat") n = { op: "cat", of: bOrder(ns, false) };
    else if (op === "ins") n = bIns(ns, extra);
    else if (op === "rev") n = { op: "rev", of: one || { op: "cat", of: bOrder(ns, true) } };
    else if (op === "anag") n = { op: "anag", of: one || { op: "cat", of: ns.slice().sort(function (x, y) { return bAt(x) - bAt(y); }) } };
    else if (op === "cut" || op === "pick") n = { op: op, of: one, at: extra };
    else if (op === "snd" || op === "chg") n = { op: op, of: one, l: bLetters(extra) };
    else if (op === "spn") n = { op: "spn", of: one };
    bClaim(n);
    PE.parts = PE.parts.filter(function (x) { return ns.indexOf(x) < 0; });
    PE.parts.push(n); PE.pick = [PE.parts.length - 1]; PE.target = n; PE.ask = null; PE.sel = null; PE.lset = [];
    bRender();
  }
  $("bWrap").addEventListener("click", function (e) { var b = e.target.closest(".chip"); if (b) bWrap(b.dataset.op); });
  $("bAdd").addEventListener("click", bAsked);
  $("bLet").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); bAsked(); } });
  function bAsked() {
    var a = PE.ask; if (!a) return;
    if (a.r) return bRole(a.r, $("bLet").value);
    if (a.op === "snd" || a.op === "chg") { if (!bLetters($("bLet").value)) return toast("No letters given"); return bWrap(a.op, $("bLet").value); }
  }
  // The ask row's buttons: a letter to drop or keep, which part goes outside, apply.
  $("bAskBox").addEventListener("click", function (e) {
    var a = PE.ask, b = e.target.closest("button"); if (!a || !b) return;
    if (b.dataset.j != null) { var j = +b.dataset.j, i = a.drop.indexOf(j); if (i >= 0) a.drop.splice(i, 1); else a.drop.push(j); return bRender(); }
    if (b.dataset.out != null) return bWrap("ins", +b.dataset.out);
    if (b.dataset.kind) return bIndKind(b.dataset.kind, b.textContent);
    if (b.dataset.go != null) {
      var whole = tMake(PE.parts[PE.pick[0]], DTOK.clue) || "";
      if (!a.drop.length) return toast("Tap the letters first");
      if (a.op === "cut" && a.drop.length >= whole.length) return toast("That drops every letter");
      return bWrap(a.op, a.drop.slice().sort(function (x, y) { return x - y; }));
    }
  });
  // The tray: a part selects or deselects; × takes an operation apart into its parts, or a piece away.
  $("bOut").addEventListener("click", function (e) {
    var x = e.target.closest("[data-x]"), p = e.target.closest("[data-pt]");
    if (x) {
      var i = +x.dataset.x, n = PE.parts[i];
      PE.parts.splice(i, 1);
      // an operation comes apart into its parts; a piece (letters picked or cut from words included) just goes
      if (!/^(lit|syn|abr)$/.test(n.op) && !((n.op === "pick" || n.op === "cut") && n.of.op === "lit")) {
        var flat = function (k) { return k.op === "cat" ? k.of : [k]; };
        PE.parts = PE.parts.concat(n.op === "cat" ? n.of : n.op === "ins" ? [n.out].concat(flat(n.in)) : n.op === "rev" || n.op === "anag" ? flat(n.of) : [n.of]);
      }
      PE.pick = []; PE.target = null; PE.ask = null;
      return bRender();
    }
    var dd = e.target.closest("[data-di]");
    if (dd) { PE.ind.splice(+dd.dataset.di, 1); return bRender(); }
    var dr = e.target.closest("[data-dr]");
    if (dr) { var r = defRuns()[+dr.dataset.dr]; if (r) DTOK.slice(r[0], r[1] + 1).forEach(function (k) { k.el.classList.remove("on"); delete k.el.dataset.d; }); return bRender(); }
    if (p) {
      var k = +p.dataset.pt, at = PE.pick.indexOf(k);
      if (at >= 0) PE.pick.splice(at, 1); else PE.pick.push(k);
      PE.target = null; PE.ask = null; PE.sel = null; PE.lset = [];
      return bRender();
    }
  });
  $("bWhole").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    var k = b.dataset.k, i = PE.whole.indexOf(k);
    if (i >= 0) PE.whole.splice(i, 1); else PE.whole.push(k);
    if ((k === "cd" || k === "&lit") && i < 0) DTOK.forEach(function (x) { x.el.classList.add("on"); x.el.dataset.d = 0; });  // the whole clue is the definition
    if (k === "cd" && i >= 0) DTOK.forEach(function (x) { x.el.classList.remove("on"); delete x.el.dataset.d; });
    PE.sel = null; PE.lset = []; PE.ask = null; bRender();
  });
  $("defClear").addEventListener("click", function () {
    DTOK.forEach(function (x) { x.el.classList.remove("on"); delete x.el.dataset.d; });
    PE.parts = []; PE.pick = []; PE.ind = []; PE.whole = []; PE.target = null; PE.sel = null; PE.lset = []; PE.ask = null; bRender();
  });
  // The definition's runs of words, as token ranges [first, last]. Each word carries the number of its definition
  // (data-d), so the two definitions of a double definition can sit side by side ("One is present, nervous").
  function defRuns() {
    var out = [], run = null, d = null;
    DTOK.forEach(function (t, i) {
      var on = t.el.classList.contains("on");
      if (on && run && t.el.dataset.d === d) run[1] = i;
      else { if (run) out.push(run); run = on ? [i, i] : null; d = t.el.dataset.d; }
    });
    if (run) out.push(run);
    return out;
  }
  // Words tapped as the definition join a definition beside them, unless a double definition is wanted and one
  // definition is already there: then they are the second.
  function defOn(a, b) {
    var runs = defRuns(), ids = DTOK.filter(function (t) { return t.el.classList.contains("on"); }).map(function (t) { return +t.el.dataset.d; });
    var d = String(ids.length ? Math.max.apply(null, ids) + 1 : 0);
    if (!(PE.whole.indexOf("dd") >= 0 && runs.length === 1)) {
      var near = runs.filter(function (r) { return r[1] >= a - 1 && r[0] <= b + 1; })[0];
      if (near) d = DTOK[near[0]].el.dataset.d;
    }
    DTOK.slice(a, b + 1).forEach(function (x) { x.el.classList.add("on"); x.el.dataset.d = d; });
  }
  function pickedDefs() { return defRuns().map(function (r) { return bText(r[0], r[1]); }).filter(Boolean); }
  function saveDefs(w) {
    var d = pickedDefs(), k = w.dir + w.num, blog = DEFS && DEFS[w.dir] && DEFS[w.dir][w.num];
    if (d.length === 1 && d[0] === blog) delete myDefs[k];
    else if (d.length || blog) myDefs[k] = d;
    if (d.length) hintAdd(k, false);
  }
  // The parsing the editor holds: one part is the tree; several are read as a charade (in the order that fits the
  // answer, else clue order) until they are joined.
  function bParse() {
    var ps = PE.parts, p = { def: PE.whole.indexOf("cd") >= 0 ? [] : defRuns().map(function (r) { return bSpan(r[0], r[1]); }) };
    if (ps.length === 1) p.t = ps[0];
    else if (ps.length > 1) p.t = { op: "cat", of: bOrder(ps, false) };
    var kind = ["dd", "cd", "&lit"].filter(function (k) { return PE.whole.indexOf(k) >= 0; })[0];
    if (kind) p.kind = kind;
    if (PE.whole.indexOf("pal") >= 0) p.pal = true;
    if (PE.ind.length) p.ind = PE.ind.map(function (x) { return x.w; });
    return p;
  }
  // A part as a line of the tray, and its parts below it.
  function bLine(n, depth, us, ul, got) {
    var li = mk("li", "pt" + (depth ? " sub" : "")), l = tMake(n, DTOK.clue) || got(n);
    li.style.paddingLeft = depth * 14 + "px";
    var u = us.has(n) ? us.get(n) : null;
    li.appendChild(mk("b", u != null ? tKind(n) : "op", l || "?"));
    var t = " " + OPNAME[n.op] + (n.w && /^(lit|syn|abr)$/.test(n.op) ? " “" + tText(DTOK.clue, n.w) + "”" : "");
    li.appendChild(document.createTextNode(t));
    (n.ind || []).forEach(function (sp) { li.appendChild(document.createTextNode(" ")); li.appendChild(mk("i", "mind", tText(DTOK.clue, sp))); });
    ul.appendChild(li);
    if (!/^(lit|syn|abr)$/.test(n.op) && !(n.op === "pick" || n.op === "cut") || (n.op === "pick" || n.op === "cut") && n.of.op !== "lit") tKids(n).forEach(function (k) { bLine(k, depth + 1, us, ul, got); });
    return li;
  }
  function bRender() {
    var sel = PE.sel, ask = PE.ask, ls = PE.lset, clue = DTOK.clue, p = bParse();
    $("defPick").classList.toggle("letters", PE.lmode);
    var runs = defRuns(), m = tMarks(p, clue);
    DTOK.forEach(function (x, i) {
      x.el.classList.toggle("sel", !!sel && i >= sel[0] && i <= sel[1]);
      x.el.classList.toggle("d1", runs.length > 1 && runs.slice(1).some(function (r) { return i >= r[0] && i <= r[1]; }));
      var marked = false;
      x.chars.forEach(function (ch) {
        var k = +ch.dataset.c;
        var sep = m.piece[k] && m.piece[k - 1] === m.piece[k] && m.unit[k - 1] !== m.unit[k];
        ch.className = "ch" + (ls.indexOf(k) >= 0 ? " sel" : "") + (m.piece[k] ? " " + m.piece[k].split(" ")[0] : "") + (sep ? " sep" : "");
        if (m.ind[k]) marked = true;
      });
      x.el.classList.toggle("ind", marked);
    });
    var picked = PE.pick.map(function (i) { return PE.parts[i]; });
    $("bBar").hidden = !sel && !ls.length && !picked.length;
    $("bRoles").hidden = !!ask || !sel; $("bLRoles").hidden = !!ask || !ls.length || !!sel;
    var wrap = $("bWrap"); wrap.textContent = ""; wrap.hidden = !!ask || !!sel || !!ls.length || !picked.length;
    (picked.length === 1 ? WRAP1 : WRAPN).forEach(function (r) {
      var b = wrap.appendChild(mk("button", "chip" + (PE.ind.some(function (x) { return x.op === r[1]; }) ? " sugg" : ""), r[0])); b.type = "button"; b.dataset.op = r[1];
      if ((r[1] === "cut" || r[1] === "pick") && !tMake(picked[0] || {}, clue)) b.disabled = true;
    });
    // the ask: letters to type, letters to tap, or which part goes outside
    var box = $("bAskBox"); box.textContent = ""; box.hidden = !ask || !!(ask.r || ask.op === "snd" || ask.op === "chg");
    $("bAsk").hidden = !ask || !(ask.r || ask.op === "snd" || ask.op === "chg");
    if (ask && (ask.op === "cut" || ask.op === "pick")) {
      (tMake(picked[0], clue) || "").split("").forEach(function (ch, j) {
        var on = ask.drop.indexOf(j) >= 0, b = box.appendChild(mk("button", "chip mini cut" + (on ? " on" + (ask.op === "pick" ? " keep" : "") : ""), ch));
        b.type = "button"; b.dataset.j = j; b.setAttribute("aria-pressed", String(on));
      });
      box.appendChild(mk("button", "btn mini", ask.op === "cut" ? "Drop" : "Pick")).dataset.go = 1;
    }
    if (ask && ask.ind) {
      var says = INDS[indKey(tText(clue, ask.ind))] || [];
      IND_KINDS.slice().sort(function (x, y) { var i = says.indexOf(x[1]), j = says.indexOf(y[1]); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); }).forEach(function (k) {
        var b = box.appendChild(mk("button", "chip" + (says.indexOf(k[1]) >= 0 ? " sugg" : ""), k[0])); b.type = "button"; b.dataset.kind = k[1];
      });
    }
    if (ask && ask.op === "ins") {  // each part by its letters, else by its words ("Anagram of “rude”"); those that fit marked
      var fits = bInsFits(picked);
      picked.forEach(function (n, i) {
        var ws = tWalk(n).filter(function (x) { return x.w; }).map(function (x) { return tText(clue, x.w); }).join(" ");
        var b = box.appendChild(mk("button", "chip" + (fits[i] ? " sugg" : ""), tMake(n, clue) || OPNAME[n.op] + (ws ? " of “" + ws + "”" : "")));
        b.type = "button"; b.dataset.out = i;
      });
    }
    var q = sel ? "“" + bText(sel[0], sel[1]) + "”" : "";
    var waiting = PE.ind.filter(function (x) { return x.op; })[0];
    $("bHint").textContent = ask && ask.ind ? "“" + tText(clue, ask.ind) + "” indicates:" : ask && ask.r ? "Type the letters, then Add." : ask && ask.op === "ins" ? "Which goes outside?" : ask && ask.op === "cut" ? "Tap the letters to drop: any of them." : ask && ask.op === "pick" ? "Tap the letters to keep: any of them."
      : ask ? "Type the letters, then Add." : sel ? q + (indSays(bText(sel[0], sel[1])) ? " usually indicates " + indSays(bText(sel[0], sel[1])) + ". It is:" : " is:") : ls.length ? "Letters " + ls.map(function (c) { return clue[c].toUpperCase(); }).join("") + ": tap more, or say what they are." : waiting && !picked.length ? (/^(pick|cut)$/.test(waiting.op) ? "Now tap Letters and the letters “" + tText(clue, waiting.w) + "” " + (waiting.op === "pick" ? "keeps" : "drops") + ", or tap the piece they come from."
        : "Now tap the pieces “" + tText(clue, waiting.w) + "” works on, then " + (waiting.name || IND_KINDS.filter(function (k) { return k[1] === waiting.op; })[0][0]) + ".")
      : PE.target && !/^(cat)$/.test(PE.target.op) ? "Tap the words that indicate it, then Indicator. Or put it together further:" : picked.length ? (picked.length === 1 ? "One part selected. " : picked.length + " parts selected. ") + "Put together as:"
      : PE.target ? "Tap the words that indicate it, then Indicator. Or carry on." : PE.lmode ? "Tap any letters, one at a time." : "Tap a word, or two for a run. Tap pieces below to put them together.";
    Array.prototype.forEach.call($("bWhole").children, function (b) { b.classList.toggle("on", PE.whole.indexOf(b.dataset.k) >= 0); });
    // the tray, then the live check
    var out = $("bOut"); out.textContent = "";
    var any = PE.parts.length || PE.ind.length || runs.length || PE.whole.length;
    out.hidden = !any;
    if (!any) return;
    var us = p.t ? tUnits(p.t) : new Map(), ans0 = bAnswer(), own = p.t && ans0 ? tFit(p.t, ans0, clue, us) : null;
    // a part's letters as they land in the answer (an anagram's, a container's), when the parsing fits
    var got = function (n) {
      if (!own) return "";
      var u = []; (function g(k) { if (us.has(k)) u.push(us.get(k)); else tKids(k).forEach(g); })(n);
      return ans0.split("").filter(function (_, i) { return u.indexOf(own[i]) >= 0; }).join("");
    };
    if (PE.parts.length) {
      out.appendChild(mk("p", "lbl", "Pieces · tap to select"));
      PE.parts.forEach(function (n, i) {
        var ul = out.appendChild(mk("ul", "tray" + (PE.pick.indexOf(i) >= 0 ? " on" : "")));
        ul.dataset.pt = i;
        var top = bLine(n, 0, us, ul, got);
        var x = top.appendChild(mk("button", "x", "×")); x.type = "button"; x.dataset.x = i;
        x.setAttribute("aria-label", /^(lit|syn|abr)$/.test(n.op) ? "Remove this piece" : "Take this apart");
      });
    }
    var more = mk("ul", "bx");
    PE.ind.forEach(function (x, i) {
      var k = x.name || (IND_KINDS.filter(function (y) { return y[1] === x.op; })[0] || [])[0];
      var li = more.appendChild(mk("li", null, k ? k + " indicator, waiting for its pieces: " : "Indicator, not yet on a step: "));
      li.appendChild(mk("i", "mind", tText(clue, x.w))); li.appendChild(mk("button", "x", "×")).dataset.di = i;
    });
    runs.forEach(function (r, i) { var li = more.appendChild(mk("li", null, "Definition: " + bText(r[0], r[1]) + " ")); li.appendChild(mk("button", "x", "×")).dataset.dr = i; });
    if (more.children.length) out.appendChild(more);
    var view = out.appendChild(mk("div", "pbuild"));
    tShowBuild(p, PE.w, view);
    var ul2 = view.querySelector("ul"); if (ul2) ul2.remove();  // the tray already says what each piece is
    var ans = bAnswer(), v = ans ? tCheck(p, clue, ans) : 0;
    out.appendChild(mk("div", "chk" + (v ? " agree" : ""), p.kind === "dd" || p.kind === "cd" ? "Not checked: definitions can’t be letter-checked, so this rests on your word."
      : !p.t ? "Not checked: no pieces yet." : !ans ? "Not checked: the answer isn’t known yet."
      : v === 2 ? (PE.parts.length > 1 ? "Checked: as a charade, the pieces give the answer." : "Checked: the parsing gives the answer letter for letter.")
      : v === 1 ? "Checked, taking the sound or the letter change on trust." : PE.parts.length > 1 ? "Not joined yet: select pieces and put them together." : "Not checked: these letters don’t make the answer yet."));
  }
  // A parsing written out in the blogs' notation: CAPITALS for letters, (glosses), X< reversed, (X)* anagrams,
  // OU(IN)T containers, CHOIC(e) cuts, _indicators_.
  function tNotation(p, clue) {
    var ind = function (n) { return (n.ind || []).map(function (sp) { return " _" + tText(clue, sp) + "_"; }).join(""); };
    var say = function (n) {
      var l = tMake(n, clue), g = n.w ? " (" + tText(clue, n.w) + ")" : "";
      switch (n.op) {
        case "lit": return tLetters(tText(clue, n.w));
        case "syn": case "abr": return n.l + g;
        case "pick": return (l || "") + " (" + tPickName(n, clue).trim() + " " + (tLitChars(n.of, clue) ? tText(clue, [bAt(n.of), (function e(k) { return k.w ? k.w[1] : e(tKids(k)[tKids(k).length - 1]); })(n.of)]) : say(n.of)) + ")" + ind(n);
        case "cut": var f = tMake(n.of, clue) || ""; return f.split("").map(function (ch, j) { return n.at.indexOf(j) >= 0 ? "(" + ch.toLowerCase() + ")" : ch; }).join("").replace(/\)\(/g, "") + (n.of.w ? " (" + tText(clue, n.of.w) + ")" : "") + ind(n);
        case "rev": return (n.of.op === "cat" || n.of.op === "ins" ? "(" + say(n.of) + ")" : say(n.of)) + "<" + ind(n);
        case "anag": return "(" + say(n.of) + ")*" + ind(n);
        case "cat": return n.of.map(say).join(" + ");
        case "ins":
          var o = tMake(n.out, clue);
          return (o && n.k != null ? o.slice(0, n.k) + "(" + say(n.in) + ")" + o.slice(n.k) : say(n.in) + " in " + say(n.out)) + ind(n);
        case "snd": return n.l + " (sounds like " + say(n.of) + ")" + ind(n);
        case "chg": return say(n.of) + " > " + n.l + ind(n);
        case "spn": return "spoonerism of " + say(n.of) + ind(n);
      }
      return "";
    };
    var parts = [];
    if (p.kind === "dd" || p.kind === "cd") parts.push(p.kind);
    if (p.t) parts.push(say(p.t));
    if (p.kind === "&lit") parts.push("&lit");
    return parts.join(" ");
  }
  // A saved parsing into the editor: its tree as one part (take it apart with ×), its definitions and kinds.
  function bLoad(p, w) {
    PE = { w: w, sel: null, lmode: false, lset: [], parts: [], pick: [], ask: null, target: null, ind: [], whole: [], old: "", oldType: "" };
    $("bLetters").setAttribute("aria-pressed", "false");
    if (!p) return;
    if (p.t) PE.parts = [JSON.parse(JSON.stringify(p.t))];
    PE.ind = (p.ind || []).map(function (w) { return { w: w, op: null }; });
    if (p.kind) PE.whole.push(p.kind);
    if (p.pal) PE.whole.push("pal");
  }
  // The editor's parsing as the solver's record: the tree (s.tree), its type and its notation.
  function bRecord(note) {
    var p = bParse(), clue = DTOK.clue, has = p.t || p.kind || p.pal;
    var type = has ? tTypes(p, clue) : "";
    var x = { type: type || "Parsing", wordplay: tNotation(p, clue) || PE.old };
    if (has) x.s = { tree: JSON.parse(JSON.stringify(p)) };
    if (note) x.note = note;
    return x.wordplay || note || type && type !== PE.oldType ? x : null;
  }
