  // Hint offers the definition (underlined) and the clue type, each counted as a hint; once both are shown it becomes Reveal.
  function lockedCell(k) { return !!SUB || (!HARD && !!ok[k]); }
  // A finished grid offers no more hints or reveals.
  function locked(w) { if (HARD || solved) return solved; return w.cells.every(function (rc) { return ok[rc[0] + "," + rc[1]]; }); }
  var askMode = "hint";
  $("hintBtn").addEventListener("click", function () {
    var w = curWord(), act = nextAction(w), h = hintsLeft(w);
    if (act !== "hint") return ask(act);
    $("hintDef").hidden = !h.def; $("hintType").hidden = !h.type;
    pop("hintPop", $("hintPop").hidden);
  });
  $("hintDef").addEventListener("click", function () { ask("hint"); });
  $("hintType").addEventListener("click", function () { ask("hint2"); });
  function ask(act) {
    var w = curWord(), name = wordName(w);
    askReset("Not yet");
    if (act === "parse") {
      showParse(w);
    } else if (act === "add") {
      openEditor(w, true);
    } else if (act === "hint2") {
      askMode = "hint2";
      $("hintTitle").textContent = "Show the clue type for " + name + "?";
      $("hintText").textContent = "The type of clue, such as anagram or charade, will be shown. Are you sure you want to see it?";
      $("hintYes").textContent = "Show clue type";
    } else if (act === "reveal") {
      askMode = "reveal";
      $("hintTitle").textContent = "Reveal " + name + "?";
      $("hintText").textContent = "The answer will be filled in and locked. Are you sure you want to reveal it?" +
        (fromBlog(w) ? " Its parsing comes from the " + blogName() + " blog." : "");
      $("hintYes").textContent = "Reveal answer";
    } else {
      askMode = "hint";
      $("hintTitle").textContent = "Show the definition for " + name + "?";
      $("hintText").textContent = "The definition part of this clue will be underlined. Are you sure you want to see it?";
      $("hintYes").textContent = "Show definition";
    }
    // Settings can skip the question; Quickfire never asks.
    if (/^(hint|hint2|reveal)$/.test(act) && (P.qf || prefs().noAsk)) $("hintYes").click();
    else $("hintAsk").hidden = false;
  }
  // Parsing view: the blog's by default; the solver can correct it and the correction is kept for this puzzle.
  // Clues whose definition and parsing came from the puzzle's blog (p.blog_keys: head-clue keys).
  function fromBlog(w) {
    return !!P.blog && (P.blog_keys || []).indexOf(w.dir + w.num) >= 0;
  }
  function blogName() {
    return P.blog_name || "the blog";
  }
  // Older names for the editor's clue types.
  function ctype(t) {
    return String(t || "").replace(/\b(initial|first|final|last|alternate) letters\b/ig, "Letter selection").replace(/\bhidden reversal\b/ig, "Hidden, Reversal")
      .replace(/\bhidden word\b/ig, "Hidden").replace(/\bsubtraction\b/ig, "Deletion").replace(/\b(letter swap|letter move|substitution)\b/ig, "Letter change");
  }
  function blogParse(w) { return PARSES && PARSES[w.dir] && PARSES[w.dir][w.num]; }
  function parseFor(w) {
    var key = w.dir + w.num, mine = myParses[key], blog = blogParse(w);
    var x = mine || blog || { type: "Not parsed", wordplay: P.ed || P.made ? "Tap Edit to add one." : "The blog has no parsing for this clue. Tap Edit to add your own." };
    // The structure: our own checked parsing where the data has one (x.ours), else the one read from the blog's or
    // the solver's words.
    return { mine: !!mine, blog: !!blog, type: ctype(x.type), wordplay: x.wordplay || "", s: (x.ours && x.ours.s) || x.s || mine && readWp(w, mine) };
  }
  // A structure for an edit saved before the Build step, read from its wordplay as the updater reads a blog's:
  // CAPITAL pieces (lower-case letters are the ones dropped), (WORDS)* anagrams, glosses in brackets or quotes,
  // _indicators_; then fitted into the answer by bFit. Kept per text, as it can be slow.
  var WPREAD = {};
  function readWp(w, x) {
    var ans = w.cells.map(function (rc) { return solAt(rc[0], rc[1]) || fill[rc[0]][rc[1]] || "?"; }).join("");
    var wp = String(x.wordplay || ""), key = ans + "|" + wp;
    if (!wp || ans.indexOf("?") >= 0) return null;
    if (key in WPREAD) return WPREAD[key];
    var low = w.clue.toLowerCase(), inClue = function (t) {
      t = String(t || "").replace(/^[\s'"\u2018\u201c]+|[\s'"\u2019\u201d?!.,;:]+$/g, "");
      if (t.length < 2) return null;
      var m = new RegExp("(^|[^a-z])(" + t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![a-z])").exec(low);  // whole words
      return m ? w.clue.substr(m.index + m[1].length, t.length) : null;
    };
    // a gloss the clue doesn't have whole: the part it quotes, or its longest run of words at either end
    var loose = function (g) {
      var t = inClue(g); if (t || !g) return t;
      var q = g.match(/['"\u2018\u201c]([^'"\u2019\u201d]+)['"\u2019\u201d]/); if (q && inClue(q[1])) return inClue(q[1]);
      var wd = g.trim().split(/\s+/);
      for (var n = wd.length - 1; n > 0; n--) { t = inClue(wd.slice(0, n).join(" ")) || inClue(wd.slice(-n).join(" ")); if (t) return t; }
      return null;
    };
    var ps = [], used = {}, re = /\(([A-Z][A-Z ]+)\)\*|((?:[A-Z]+|\([a-z]+\)|[a-z]*\[[a-z]+\])+)(?:\s*[(\u2018\u201c'"]([^)\u2019\u201d'"]+)[)\u2019\u201d'"])?/g, m;
    while ((m = re.exec(wp)) && ps.length < 12) {
      var l, f, k = "syn", g = m[3];
      if (m[1]) { f = bLetters(m[1]); l = f; k = "anag"; }
      else {
        if (!/[A-Z]/.test(m[2])) continue;
        l = m[2].replace(/[^A-Z]/g, ""); f = bLetters(m[2].replace(/[\[\]()]/g, ""));
        if (f === l && wp.charAt(m.index + m[0].length) === "*") k = "anag";
      }
      if (/[a-z]/.test(wp.charAt(m.index + m[0].length)) && !g || /[A-Za-z]/.test(wp.charAt(m.index - 1))) continue;  // a word in the prose
      if (!l || l === ans || /^[AI]$/.test(l) && !g) continue;
      var p = { k: k, l: l, f: f, w: (k === "anag" ? inClue(m[1]) : null) || loose(g) || (k === "syn" ? inClue(l) : null) };
      if (p.w && k === "syn" && bLetters(p.w) === l) p.k = "lit";
      ps.push(p);
    }
    // a clue word quoted on its own ("plus 'is'") is a candidate piece as written; it counts only if it fits the answer
    var quoted = /[\u2018\u201c'"]([a-z]+)[\u2019\u201d'"]/g, qm;
    while ((qm = quoted.exec(wp))) {
      var c = inClue(qm[1]), l2 = bLetters(qm[1]);
      if (c && l2.length >= 2 && !ps.some(function (p) { return p.l === l2 || p.w === c; })) ps.push({ k: "lit", l: l2, f: l2, w: c });
    }
    var s = null;
    if (ps.length) {
      var rev = /<|revers|back|\bup\b|returned/i.test(wp), fit = bFit(ans, ps, rev, /\*|anagram/i.test(wp));
      if (fit.got >= Math.max(2, ans.length / 2)) {
        s = { v: fit.got === ans.length ? 2 : 1, dev: [], p: fit.plan.slice().sort(function (a, b) { return a.at[0][0] - b.at[0][0]; }).map(function (x) {
          var q = ps[x.k], out = { l: q.l, o: x.op === "rev" || x.op === "anag" ? x.op : q.f !== q.l ? "del" : q.k, at: x.at };
          if (q.w) { out.w = q.w; used[q.w.toLowerCase()] = 1; }
          if (out.o === "del") out.f = q.f;
          return out;
        }) };
      }
    }
    var ind = [];
    (wp.match(/_[^_]+_/g) || []).forEach(function (t) { var c = inClue(t.slice(1, -1)); if (c && !used[c.toLowerCase()] && defsFor(w).indexOf(c) < 0) ind.push(c); });
    if (s && ind.length) s.ind = ind;
    return WPREAD[key] = s;
  }
  // Blog-style markup: _indicator_ in italics, ~letters~ struck through.
  function markup(el, text) {
    el.textContent = "";
    text.split(/(_[^_]+_|~[^~]+~)/).forEach(function (part) {
      if (!part) return;
      var m = part.length > 2 && (part[0] === "_" || part[0] === "~") && part[part.length - 1] === part[0];
      if (m) { var n = document.createElement(part[0] === "_" ? "i" : "s"); n.textContent = part.slice(1, -1); el.appendChild(n); }
      else el.appendChild(document.createTextNode(part));
    });
  }
  // Dictionary pop-up for the current answer, looked up in free dictionaries.
  var dictSeq = 0;
  function openDict(w) {
    var word = answerText(w), seq = ++dictSeq, box = $("dictBody");
    $("dictWord").textContent = word;
    box.innerHTML = "<p>Looking this word up…</p>";
    $("dictNote").textContent = "";
    $("dictExt").href = "https://chambers.co.uk/search/?query=" + encodeURIComponent(word.toLowerCase()) + "&title=21st";
    $("dictDlg").hidden = false;
    lookup(word, true).then(function (r) {
      if (seq !== dictSeq) return;
      if (!r) { box.innerHTML = "<p>No dictionary has this word. Tap Chambers to look it up.</p>"; return; }
      box.innerHTML = "";
      r.senses.forEach(function (x) {
        var p = mk("p");
        if (x.pos) p.appendChild(mk("b", null, x.pos));
        p.appendChild(document.createTextNode(x.def)); box.appendChild(p);
      });
      $("dictNote").textContent = "Definitions from " + r.name + ".";
    });
  }
  // Free dictionaries in turn (Free Dictionary API, Wiktionary, Datamuse); null if none has the word.
  // Words are looked up as soon as they are filled (render), two at a time; a tapped word jumps the queue. Entries
  // found are kept in this browser (not synced), so reviewing a puzzle later needs no lookups. A word no dictionary
  // had (or a failed request) is tried again only when tapped, so background lookups never repeat.
  var DICTQ = {}, DICTNO = {}, dictJobs = [], dictBusy = 0;
  function lookup(word, now) {
    var lw = word.toLowerCase(), kept = null;
    if (!now && DICTNO[lw]) return;
    if (!DICTQ[lw]) {
      try { kept = JSON.parse(localStorage.getItem("xwdict:" + lw)); } catch (e) {}
      DICTQ[lw] = kept ? Promise.resolve(kept) : new Promise(function (ok) { dictJobs.push({ lw: lw, ok: ok }); });
    }
    for (var i = 0; now && i < dictJobs.length; i++) if (dictJobs[i].lw === lw) { dictRun(dictJobs.splice(i, 1)[0]); break; }
    while (dictBusy < 2 && dictJobs.length) dictRun(dictJobs.shift());
    return DICTQ[lw];
  }
  function dictRun(job) {
    var i = 0;
    dictBusy++;
    (function next() {
      if (i >= DICTS.length) return done(null);
      var d = DICTS[i++];
      getJSON(d.url(job.lw)).then(function (data) {
        var senses = d.read(data, job.lw).filter(function (x) { return x.def; }).slice(0, 5);
        if (!senses.length) throw 0;
        done({ name: d.name, senses: senses });
      }).catch(next);
    })();
    function done(r) {
      if (r) { delete DICTNO[job.lw]; try { localStorage.setItem("xwdict:" + job.lw, JSON.stringify(r)); } catch (e) {} }
      else { DICTNO[job.lw] = 1; delete DICTQ[job.lw]; }
      dictBusy--; job.ok(r);
      while (dictBusy < 2 && dictJobs.length) dictRun(dictJobs.shift());
    }
  }
  function getJSON(url) {
    var ctl = new AbortController();
    setTimeout(function () { ctl.abort(); }, 6000);
    return fetch(url, { signal: ctl.signal }).then(function (r) { if (!r.ok) throw 0; return r.json(); });
  }
  function plainText(h) { var d = new DOMParser().parseFromString(h || "", "text/html"); return (d.body.textContent || "").trim(); }  // inert parse: dictionary HTML never runs
  var POSNAME = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", u: "" };
  var DICTS = [
    { name: "Wiktionary via the Free Dictionary API", url: function (w) { return "https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w); },
      read: function (data) { var out = []; (data || []).forEach(function (e) { (e.meanings || []).forEach(function (m) { (m.definitions || []).slice(0, 2).forEach(function (d) { out.push({ pos: m.partOfSpeech, def: d.definition }); }); }); }); return out; } },
    { name: "Wiktionary", url: function (w) { return "https://en.wiktionary.org/api/rest_v1/page/definition/" + encodeURIComponent(w.replace(/ /g, "_")); },
      read: function (data) { var out = []; ((data && data.en) || []).forEach(function (m) { (m.definitions || []).slice(0, 2).forEach(function (d) { out.push({ pos: (m.partOfSpeech || "").toLowerCase(), def: plainText(d.definition) }); }); }); return out; } },
    { name: "Datamuse (WordNet)", url: function (w) { return "https://api.datamuse.com/words?sp=" + encodeURIComponent(w) + "&md=d&max=1"; },
      read: function (data, w) { var e = (data || [])[0]; if (!e || e.word.toLowerCase() !== w) return [];
        return (e.defs || []).map(function (x) { var t = x.split("\t"); return { pos: POSNAME[t[0]] != null ? POSNAME[t[0]] : t[0], def: t[1] || "" }; }); } }
  ];
  $("dictBtn").addEventListener("click", function () { var w = curWord(); if (w && filled(w)) openDict(w); else if (P.qf) toast("Fill the squares to search"); });
  $("dictClose").addEventListener("click", function () { $("dictDlg").hidden = true; });
  $("dictDlg").addEventListener("click", function (e) { if (e.target === $("dictDlg")) $("dictDlg").hidden = true; });
  // What follows each square of an answer: " " between words, "-" at a hyphen.
  function seps(breaks) { var br = {}; breaks.forEach(function (b) { br[b.after] = b.kind === "-" ? "-" : " "; }); return br; }
  function answerText(w) {
    var br = seps(w.breaks), out = "";
    w.cells.forEach(function (rc, i) { out += fill[rc[0]][rc[1]] + (br[i] || ""); });
    return out;
  }
  function showParse(w) {
    var r = parseFor(w), key = w.dir + w.num, had = hinted[key];
    askMode = "parse";
    $("hintTitle").textContent = wordName(w);
    hinted[key] = 1; clueInto($("pvClue"), w, true); if (had) hinted[key] = had; else delete hinted[key];
    var s = r.s || defsOnly(w, r.type) || (/&lit|palindrome/i.test(r.type) ? { v: 0, dev: [] } : null);
    if (s) s = Object.assign({}, s, { ty: r.type });
    if (s) markClue($("pvClue"), w, s);
    $("pvAns").textContent = answerText(w); $("pvAns").hidden = !!s;
    $("pvType").textContent = r.type;
    // With a structure the marked clue and the tiles are the parsing; the written parsing shows only when there is
    // none, or when Blog parse is tapped (the blog's words, verbatim).
    markup($("pvWp"), s ? "" : r.wordplay);
    var bp = blogParse(w); $("pvBlog").hidden = !(s && bp && bp.wordplay); $("pvBlog").classList.remove("on");
    showBuild(s, w, null, r.mine);
    $("hintText").hidden = true; $("parseView").hidden = false;
    // The blog is linked from the finish bar; the note only says when the parsing is the solver's own or missing.
    $("parseNote").textContent = r.mine || r.blog ? "" : "No parsing from the blog yet.";
    $("parseNote").hidden = !!(P.ed || P.made) || !$("parseNote").textContent;  // a created puzzle's parsings are all the setter's
    $("parseForm").hidden = $("clueForm").hidden = $("clueParse").hidden = true;
    $("parseEdit").hidden = false; $("parseReset").hidden = P.ed || !r.mine && !myDefs[key];
    $("hintNo").hidden = true;
    $("hintYes").textContent = "Done";
  }
  // A cryptic or double definition with no stored structure: the clue's type and definitions are enough.
  function defsOnly(w, type) {
    if (/cryptic definition/i.test(type)) return { v: 0, dev: ["Cryptic definition"] };
    if (/double definition/i.test(type) && defsFor(w).length > 1) return { v: 0, dev: ["Double definition"], defs: defsFor(w) };
  }
  function cryptic(s) { return (s.dev || []).indexOf("Cryptic definition") >= 0 && !(s.p || []).length; }
  // A spoonerism: the first and last words swap their opening consonants (NOSY COOK -> COSY NOOK), as letters.
  function spoon(t) {
    var ws = String(t || "").toUpperCase().split(/\s+/).filter(Boolean), on = /^(QU|[^AEIOUY]*)/;
    if (ws.length < 2) return "";
    var a = ws[0], b = ws[ws.length - 1], x = a.match(on)[0], y = b.match(on)[0];
    ws[0] = y + a.slice(x.length); ws[ws.length - 1] = x + b.slice(y.length);
    return ws.join("");
  }
  function isType(s, t) { return (s.dev || []).concat(String(s.ty || "").split(/,\s*/)).indexOf(t) >= 0; }
  // What a piece does, in clue-type terms: "charade for “street”", "anagram of “climate sun”".
  function howOf(q, s) {
    var w = q.w ? "\u201c" + q.w + "\u201d" : "", of = w && " of " + w, ps = s.p || [];
    var inside = ps.some(function (x) { return x !== q && x.at.length > 1 && x.at[0][0] + x.at[0][1] <= q.at[0][0] && q.at[0][0] < x.at[1][0]; });
    var plain = q.at.length > 1 ? "container" : inside ? "inserted" : ps.length > 1 ? "charade" : "synonym";
    if (q.o === "syn" && !w) return plain + " (the blog doesn\u2019t say from which words)";
    return { syn: plain + (w && " for " + w), lit: w ? w + " as written" : "as written", sel: "letter selection" + (w && " from " + w),
      del: "deletion: " + (q.f || "") + " cut short" + (w && ", for " + w), anag: "anagram" + of, rev: "reversal" + of, hid: "hidden" + (w && " in " + w),
      ini: "first letters" + of, alt: "alternate letters" + of, snd: "homophone" + of + ": sounds like " + q.l,
      chg: "letter change: " + (q.f || "") + " becomes " + q.l + (w && ", from " + w), spn: "spoonerism" + of + ": swap the first sounds of " + (q.f || "") }[q.o] || "";
  }
  // The clue once, marked up from the structure: the definition underlined, indicators in italics, and each piece's
  // words tinted like its tiles.
  // Which characters of a clue phrase give the letters taken from it: first, last, middle or alternate letters of
  // its words, a run hidden across them, a word with letters cut, or failing those the first way the letters fit.
  function takenMask(phrase, taken) {
    var ch = phrase.split(""), idx = [], up = "";
    ch.forEach(function (c, i) { if (/[a-z]/i.test(c)) { idx.push(i); up += c.toUpperCase(); } });
    var words = [], cur = null;
    ch.forEach(function (c, i) { if (/[a-z]/i.test(c)) { if (!cur) { cur = []; words.push(cur); } cur.push(i); } else cur = null; });
    var mark = function (list) { var m = []; list.forEach(function (i) { m[i] = 1; }); return m; };
    var tries = [
      function () { return words.map(function (w) { return w[0]; }); },
      function () { return words.map(function (w) { return w[w.length - 1]; }); },
      function () { return idx.filter(function (_, k) { return k % 2 === 0; }); },
      function () { return idx.filter(function (_, k) { return k % 2 === 1; }); },
      function () { return [].concat.apply([], words.map(function (w) { return w.slice((w.length - 1) >> 1, (w.length + 2) >> 1); })); }
    ];
    for (var t = 0; t < tries.length; t++) { var list = tries[t], got = list().map(function (i) { return ch[i].toUpperCase(); }).join(""); if (got === taken) return mark(list()); }
    var run = up.indexOf(taken);  // hidden, or a word's start or end
    if (run >= 0) return mark(idx.slice(run, run + taken.length));
    for (var cut = 1; cut < up.length; cut++) for (var at = 0; at + cut <= up.length; at++)  // one stretch cut out
      if (up.slice(0, at) + up.slice(at + cut) === taken) return mark(idx.slice(0, at).concat(idx.slice(at + cut)));
    var out = [], k = 0;  // the letters in order, wherever they first fit
    for (var i = 0; i < up.length && k < taken.length; i++) if (up[i] === taken[k]) { out.push(idx[i]); k++; }
    return k === taken.length ? mark(out) : null;
  }
  function markClue(el, w, s) {
    var clue = w.clue, low = clue.toLowerCase(), n = clue.length;
    if (cryptic(s)) { el.textContent = ""; el.appendChild(mk("span", "mcd", clue)); return; }  // the whole clue is the definition
    // Marks can sit inside one another ("ending in Chicago" indicates, "Chicago" is a piece's source), so each
    // character carries all of its marks and the clue is emitted in runs of equal marks.
    var piece = [], ind = [], def = [], plain = [];
    var put = function (t, arr, v) { var at = t ? low.indexOf(t.toLowerCase()) : -1; if (at < 0) return; for (var c = at; c < at + t.length; c++) if (arr[c] == null) arr[c] = v; };
    (s.p || []).forEach(function (q, i) {
      var cls = "k" + i % 6 + (q.o === "snd" ? " snd" : ""), at = q.w ? low.indexOf(q.w.toLowerCase()) : -1;
      if (at < 0) return;
      // Letters taken from the clue's words (selections, hiddens, deletions) tint those letters alone; the rest of
      // the word stays plain, outside any indicator.
      var mask = /^(sel|ini|alt|hid|del)$/.test(q.o) && takenMask(q.w, q.l);
      for (var c = at; c < at + q.w.length; c++) {
        if (mask) { plain[c] = 1; if (mask[c - at] && piece[c] == null) piece[c] = cls; }
        else if (piece[c] == null) piece[c] = cls;
      }
    });
    (s.ind || []).forEach(function (t) { put(t, ind, "mind"); });
    plain.forEach(function (v, c) { if (v) ind[c] = null; });
    if (s.defs && s.defs.length > 1) s.defs.forEach(function (t, i) { put(t, def, "mdef d" + i % 2); });
    else defsFor(w).concat(s.def ? [s.def] : []).forEach(function (t) { put(t, def, "mdef"); });
    el.textContent = "";
    for (var a = 0; a < n;) {
      var key = [piece[a], ind[a], def[a]].join("|"), b = a + 1;
      while (b < n && [piece[b], ind[b], def[b]].join("|") === key) b++;
      var cls = [piece[a], ind[a], def[a]].filter(Boolean).join(" "), text = clue.slice(a, b);
      el.appendChild(cls ? mk(def[a] ? "u" : "span", cls, text) : document.createTextNode(text));
      a = b;
    }
    if (isType(s, "&lit")) { var all = mk("span", "mcd"); while (el.firstChild) all.appendChild(el.firstChild); el.appendChild(all); }  // the whole clue is also the definition
  }
  function showBuild(s, w, box, mine) {
    var verdict = !!box;  // the editor shows the check's verdict; the view shows the pieces alone
    box = box || $("pvBuild");
    var ps = (s && s.p) || [], letters = w.cells.map(function (rc) { return solAt(rc[0], rc[1]) || fill[rc[0]][rc[1]] || "\u00a0"; });
    box.textContent = ""; box.hidden = !s;
    if (!s) return;
    if (ps.length) {
      var tiles = mk("div", "tiles"), own = letters.map(function () { return -1; });
      ps.forEach(function (q, i) { q.at.forEach(function (a) { for (var k = a[0]; k < a[0] + a[1]; k++) own[k] = i; }); });
      letters.forEach(function (ch, k) { tiles.appendChild(mk("b", own[k] >= 0 ? "k" + own[k] % 6 + (ps[own[k]].o === "snd" ? " snd" : "") : "", ch)); });
      var ul = mk("ul");
      ps.forEach(function (q, i) {
        var li = mk("li");
        li.appendChild(mk("b", "k" + i % 6 + (q.o === "snd" ? " snd" : ""), q.o === "snd" ? q.at.map(function (a) { return letters.slice(a[0], a[0] + a[1]).join(""); }).join("") : q.l));
        li.appendChild(document.createTextNode(" " + howOf(q, s)));
        ul.appendChild(li);
      });
      box.appendChild(tiles); box.appendChild(ul);
    }
    var ans = w.cells.map(function (rc) { return solAt(rc[0], rc[1]) || fill[rc[0]][rc[1]] || ""; }).join("");
    ans = ans.length === w.cells.length ? ans : "the answer";
    var dd = !ps.length && s.defs && s.defs.length > 1, cd = cryptic(s), who = mine ? "your" : "the blog\u2019s";
    if (dd) {
      var p = mk("p", "dd"); p.appendChild(mk("b", null, "Double definition: "));
      p.appendChild(mk("u", "mdef d0", s.defs[0])); p.appendChild(document.createTextNode(" and "));
      p.appendChild(mk("u", "mdef d1", s.defs[1])); p.appendChild(document.createTextNode(" each mean " + ans + " on their own; the clue just puts the two side by side."));
      box.appendChild(p);
    }
    if (cd) {
      var c = mk("p", "dd"); c.appendChild(mk("b", null, "Cryptic definition: "));
      c.appendChild(document.createTextNode("the whole clue is one playful hint at " + ans + ". Read straight it seems to mean one thing; read sideways it defines the answer. There is no wordplay to split out."));
      box.appendChild(c);
    }
    var note = function (head, text) { var n = mk("p", "dd"); n.appendChild(mk("b", null, head)); n.appendChild(document.createTextNode(text)); box.appendChild(n); };
    if (isType(s, "&lit")) note("&lit: ", "the whole clue is the definition of " + ans + ", and the same words also give the wordplay above.");
    if (isType(s, "Palindrome")) note("Palindrome: ", ans + " reads the same backwards" + (ans === "the answer" ? "." : ": " + ans.split("").reverse().join("") + "."));
    var sound = ps.some(function (q) { return q.o === "snd" || q.o === "spn"; });
    if (verdict) box.appendChild(mk("div", "chk", [dd || cd ? "Not checked: definitions can\u2019t be letter-checked, so this rests on " + who + " word."
      : sound ? "Sounds like: the sound can\u2019t be letter-checked, so it rests on " + who + " word."
      : mine ? "Not checked: no pieces make letters of the answer yet." : "Not checked: this rests on the blog\u2019s word.",
      "Partly checked: some letters come from the pieces.", "Checked: the pieces make the answer."][s.v]));
  }
  // Editor for a parsing; with withAnswer it also asks for the answer to a clue nobody had solved.
  function openEditor(w, withAnswer) {
    var r = parseFor(w), has = r.mine || r.blog;
    askMode = withAnswer ? "add" : "edit";
    $("hintTitle").textContent = (withAnswer ? "Add your answer for " : "") + wordName(w);
    $("ansRow").hidden = !withAnswer;
    if (withAnswer) $("ansInput").value = w.cells.map(function (rc) { return fill[rc[0]][rc[1]] || ""; }).join("");
    $("parseType").value = has ? r.type : ""; $("parseText").value = has ? r.wordplay : "";
    UNDO = []; $("undoBtn").hidden = true; defFresh = true;
    unsel(); $("parseText").hidden = true; $("wpTok").hidden = false; $("typeBtn").classList.remove("on"); $("typeBtn").textContent = "Type";
    buildTypeChips($("parseType").value); preview(); selState(); buildDefPick(w); bLoad(has && r.s, w);
    $("hintText").textContent = withAnswer ? "The answer to this clue isn't known yet. If you have solved it, enter the answer and, if you like, how it works. It will be locked in green." : "";
    $("hintText").hidden = !withAnswer;
    $("parseView").hidden = $("parseNote").hidden = $("clueForm").hidden = $("clueParse").hidden = true; $("parseForm").hidden = false;
    $("parseEdit").hidden = true; $("parseReset").hidden = true; $("pvBlog").hidden = true;
    $("hintNo").hidden = false; $("hintNo").textContent = "Cancel";
    $("hintYes").textContent = "Save";
    $("hintAsk").hidden = false;
  }
  // A puzzle's note (a rule or its theme), from the i button.
  $("infoBtn").addEventListener("click", function () { confirmAsk("info", P.title, P.note, "Close"); $("hintNo").hidden = true; });
  $("parseEdit").addEventListener("click", function () { openEditor(curWord(), false); });
  $("pvBlog").addEventListener("click", function () {
    var on = this.classList.toggle("on"), bp = blogParse(curWord());
    markup($("pvWp"), on && bp ? bp.wordplay : "");
  });
  // Build: the clue as tappable words (DTOK). Tap one, then another, to select a run, then say what it does: the
  // definition (its words "on"), an indicator (and what it signals), or a piece of the answer. Pieces made from the
  // clue's own letters get them at once; "stands for", "shortened" and "sounds like" ask for letters. bFit fits the
  // pieces into the answer as the updater's parse check does (any order, reversed or scrambled where an indicator says
  // so, one piece around others), and the result is saved as the parsing's structure (s), as the blog's parsings carry.
  var DTOK = [], BLD = { sel: null, ps: [], ind: [], ask: null, gen: "", w: null };
  var ROLES = [["Definition", "def"], ["As written", "lit"], ["Stands for\u2026", "syn"], ["First letters", "ini"], ["Last letters", "end"],
    ["Middle", "mid"], ["Alternate letters", "alt"], ["Shortened\u2026", "del"], ["Anagram fodder", "anag"], ["Hidden in", "hid"], ["Sounds like\u2026", "snd"],
    ["Letter changed\u2026", "chg"], ["Spoonerism of\u2026", "spn"]];
  var SIGNALS = [["anagram", "Anagram"], ["reversal", "Reversal"], ["container", "Container"], ["deletion", "Deletion"], ["selection", "Letter selection"],
    ["hidden", "Hidden"], ["sound", "Homophone"], ["link", ""]];
  var ASK = { syn: "Letters it stands for, e.g. AB", del: "The whole word before it is cut, e.g. PARTY", snd: "Letters as they sound in the answer",
    chg: "The word, then what it becomes, e.g. BEAST>FEAST", spn: "The two words before the swap, e.g. NOSY COOK" };
  ROLES.forEach(function (r) { $("bRoles").appendChild(mk("button", "chip" + (r[1] === "def" ? " def" : ""), r[0])).dataset.r = r[1]; });
  SIGNALS.forEach(function (r) { $("bSigs").appendChild(mk("button", "chip", r[0])).dataset.t = r[1]; });
  function buildDefPick(w) {
    var box = $("defPick"), body = w.clue.replace(/\s*\([\d,\-\s]+\)\s*$/, ""), re = /\S+/g, m;
    var spans = defSpans(w, defsFor(w));
    box.innerHTML = ""; DTOK = [];
    var pos = 0;
    while ((m = re.exec(body))) {
      if (m.index > pos) box.appendChild(document.createTextNode(body.slice(pos, m.index)));
      var t = mk("span", "tok", m[0]), a = m.index, b = a + m[0].length;
      if (spans.some(function (sp) { return a < sp[1] && b > sp[0]; })) t.classList.add("on");
      t.dataset.i = DTOK.length; t.addEventListener("click", function () { bTap(+this.dataset.i); });
      box.appendChild(t); DTOK.push({ el: t, a: a, b: b });
      pos = b;
    }
    DTOK.clue = w.clue; renderTok();
  }
  function bText(a, b) { return DTOK.clue.slice(DTOK[a].a, DTOK[b].b).replace(/[,;:.!?\u2013\u2014-]+$/, ""); }
  function bLetters(s) { return String(s || "").toUpperCase().replace(/[^A-Z]/g, ""); }
  function bWords(a, b) { return bText(a, b).split(/\s+/).map(bLetters).filter(Boolean); }
  function bTap(i) {
    var s = BLD.sel;
    BLD.sel = !s || s[0] !== s[1] ? [i, i] : s[0] === i ? null : [Math.min(s[0], i), Math.max(s[0], i)];
    BLD.ask = null; bRender();
  }
  // The answer as far as it is known: the solution, else the squares filled (or typed in Your answer).
  function bAnswer() {
    var w = BLD.w; if (!w) return "";
    var typed = !$("ansRow").hidden && bLetters($("ansInput").value);
    var a = typed || w.cells.map(function (rc) { return solAt(rc[0], rc[1]) || fill[rc[0]][rc[1]] || "?"; }).join("");
    return a.length === w.cells.length && a.indexOf("?") < 0 ? a : "";
  }
  function bRole(r, letters) {
    var s = BLD.sel; if (!s) return;
    if (r === "def") DTOK.slice(s[0], s[1] + 1).forEach(function (x) { x.el.classList.add("on"); });
    else if (ASK[r] && letters == null) { BLD.ask = r; $("bLet").value = ""; $("bLet").placeholder = ASK[r]; bRender(); try { $("bLet").focus(); } catch (e) {} return; }
    else {
      var ws = bWords(s[0], s[1]), ans = bAnswer(), p = { a: s[0], b: s[1], k: r };
      p.l = { lit: ws.join(""), ini: ws.map(function (x) { return x[0]; }).join(""), end: ws.map(function (x) { return x.slice(-1); }).join(""),
        mid: ws.map(function (x) { return x.slice((x.length - 1) >> 1, (x.length + 2) >> 1); }).join(""), anag: ws.join(""), hid: ws.join("") }[r];
      if (r === "alt") { var j = ws.join(""), odd = j.replace(/(.)./g, "$1"), even = j.replace(/.(.)?/g, "$1"); p.l = ans && ans.indexOf(even) >= 0 && ans.indexOf(odd) < 0 ? even : odd; }
      if (r === "syn" || r === "snd") p.l = bLetters(letters);
      if (r === "del") p.f = bLetters(letters);
      if (r === "chg") { var two = String(letters).split(/[>\u2192]|\s+to\s+/i); p.f = bLetters(two[0]); p.l = bLetters(two[1]); if (!p.l) return toast("Write it as BEAST>FEAST"); }
      if (r === "spn") { p.f = String(letters).toUpperCase().replace(/[^A-Z ]/g, "").trim(); p.l = spoon(p.f); if (!p.l) return toast("Give two words, e.g. NOSY COOK"); }
      if (!p.l && !p.f) return toast("No letters given");
      BLD.ps.push(p);
    }
    BLD.sel = null; BLD.ask = null; defFresh = false; bChanged();
  }
  $("bRoles").addEventListener("click", function (e) { var b = e.target.closest(".chip"); if (b && !b.disabled) bRole(b.dataset.r); });
  $("bAdd").addEventListener("click", function () { bRole(BLD.ask, $("bLet").value); });
  $("bLet").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); bRole(BLD.ask, this.value); } });
  $("bSigs").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"), s = BLD.sel; if (!b || b.disabled || !s) return;
    BLD.ind.push({ a: s[0], b: s[1], t: b.dataset.t }); BLD.sel = null; bChanged();
  });
  $("bOut").addEventListener("click", function (e) {
    var x = e.target.closest("[data-del]"); if (!x) return;
    var d = x.dataset.del.split(":"); BLD[d[0]].splice(+d[1], 1); bChanged();
  });
  // Can the piece give seg? Returns how ("" for as it stands, "rev", "anag"), or null.
  function bFits(p, seg, rev, anag) {
    var srt = function (s) { return s.split("").sort().join(""); }, back = seg.split("").reverse().join("");
    if (p.k === "hid") return p.l.indexOf(seg) > 0 || p.l.indexOf(seg) === 0 && seg.length < p.l.length ? "" : rev && p.l.indexOf(back) >= 0 ? "rev" : null;
    if (p.k === "del") {
      for (var i = 0; i < seg.length + 1; i++) if (p.f.slice(0, i) === seg.slice(0, i) && p.f.slice(p.f.length - seg.length + i) === seg.slice(i) && p.f.length > seg.length) return "";
      return null;
    }
    if (p.l === seg) return "";
    if (rev && p.l === back) return "rev";
    return (p.k === "anag" || anag && seg.length > 2) && srt(p.l) === srt(seg) ? "anag" : null;
  }
  function bFit(ans, ps, rev, anag) {
    var memo = {};
    function best(i, end, used) {
      var key = i + "," + end + "," + used; if (memo[key]) return memo[key];
      var top = { got: -1, n: 0, plan: [] };
      if (i === end) return memo[key] = { got: 0, n: 0, plan: [] };
      function keep(r) { if (r.got > top.got || r.got === top.got && r.n > top.n) top = r; }
      ps.forEach(function (p, k) {
        if (used >> k & 1) return;
        var lens = p.k === "hid" || p.k === "del" ? [] : [p.l.length];
        if (!lens.length) for (var L = 1; L <= end - i && L <= (p.f || p.l).length; L++) lens.push(L);
        lens.forEach(function (L) {
          if (i + L > end) return;
          var op = bFits(p, ans.slice(i, i + L), rev, anag);
          if (op == null) return;
          var r = best(i + L, end, used | 1 << k);
          if (r.got >= 0) keep({ got: r.got + L, n: r.n + 1, plan: [{ k: k, op: op, at: [[i, L]] }].concat(r.plan) });
        });
        // around others: the piece's first part here, the rest after an inner stretch
        if (p.k === "hid" || p.k === "del") return;
        var L = p.l.length;
        for (var s = 1; s < L; s++) for (var j = i + s + 1; j + L - s <= end; j++) {
          var op = bFits(p, ans.slice(i, i + s) + ans.slice(j, j + L - s), rev, anag);
          if (op == null) continue;
          var inner = best(i + s, j, used | 1 << k);
          if (inner.got !== j - i - s) continue;
          var mask = used | 1 << k; inner.plan.forEach(function (x) { mask |= 1 << x.k; });
          var after = best(j + L - s, end, mask);
          if (after.got >= 0) keep({ got: inner.got + after.got + L, n: inner.n + after.n + 1, plan: [{ k: k, op: op || "ins", at: [[i, s], [j, L - s]] }].concat(inner.plan, after.plan) });
        }
      });
      if (top.got < end - i) { var r = best(i + 1, end, used); if (r.got > top.got) top = r; }  // or leave a letter unexplained
      return memo[key] = top;
    }
    return best(0, ans.length, 0);
  }
  // The structure, clue types and wordplay text the pieces make.
  function bStructure() {
    var ans = bAnswer(), sig = BLD.ind.map(function (x) { return x.t; }), dev = [];
    var rev = sig.indexOf("Reversal") >= 0 || BLD.ps.some(function (p) { return p.rev; }), anag = sig.indexOf("Anagram") >= 0;
    var fit = ans && BLD.ps.length ? bFit(ans, BLD.ps, rev, anag) : { got: 0, plan: [] };
    var p = fit.plan.slice().sort(function (x, y) { return x.at[0][0] - y.at[0][0]; }).map(function (x) {
      var q = BLD.ps[x.k], l = x.at.map(function (a) { return ans.substr(a[0], a[1]); }).join(""), o = { end: "sel", mid: "sel" }[q.k] || q.k;
      if (x.op === "rev") { o = q.k === "hid" ? "hid" : "rev"; dev.push("Reversal"); }
      if (x.op === "anag") o = "anag";
      if (x.at.length > 1) dev.push("Container");
      dev.push({ anag: "Anagram", hid: "Hidden", del: "Deletion", sel: "Letter selection", ini: "Letter selection", alt: "Letter selection", snd: "Homophone",
        chg: "Letter change", spn: "Spoonerism" }[o]);
      var out = { l: o === "rev" ? q.l : l, o: o, at: x.at };
      if (q.a != null) out.w = bText(q.a, q.b);
      if (q.f) out.f = q.f;
      return out;
    });
    if (p.length > 1 && !(p.length === 2 && fit.plan.some(function (x) { return x.at.length > 1; }))) dev.push("Charade");
    sig.forEach(function (t) { dev.push(t); });
    var order = TYPES.slice(); dev = order.filter(function (t) { return dev.indexOf(t) >= 0; });
    var defs = pickedDefs(), plain = function (t) { return t.replace(/\s*\([\d,\-\s']+\)\s*$/, "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
    if (!p.length && defs.length > 1) dev = ["Double definition"];
    if (!p.length && defs.length === 1 && plain(defs[0]) === plain(DTOK.clue)) dev = ["Cryptic definition"];  // the whole clue
    var s = { v: !p.length ? 0 : fit.got === ans.length ? 2 : 1, dev: dev, p: p };
    if (defs.length) s.def = defs[0];
    if (defs.length > 1 && !p.length) s.defs = defs;
    if (BLD.ind.length) s.ind = BLD.ind.map(function (x) { return bText(x.a, x.b); });
    if (!p.length) delete s.p;
    return s;
  }
  // The pieces in the notation the blogs use: AB (sailor) + (las)T, (CLIMATE SUN)*, then the indicators in _italics_.
  function bNotation(s) {
    var txt = (s.p || []).map(function (q) {
      var w = q.w || "", g = w ? " (" + w + ")" : "";
      if (q.o === "anag") return "(" + w.toUpperCase() + ")*";
      if (q.o === "lit") return q.l;
      if (q.o === "hid") return "hidden in " + w;
      if (q.o === "del") return q.l + " (" + (w ? w + ", " : "") + q.f.toLowerCase() + " cut short)";
      if (q.o === "rev") return "(" + q.l + ")<" + g;
      if (q.o === "chg") return q.f + ">" + q.l + g;
      if (q.o === "spn") return "spoonerism of " + q.f + g;
      if (/^(sel|ini|alt)$/.test(q.o)) return q.l + " (" + (q.o === "ini" ? "first letters of " : q.o === "alt" ? "alternate letters of " : "from ") + w + ")";
      return q.l + g + (q.at.length > 1 ? " around" : "");
    }).join(" + ").replace(/ around \+/g, " around");
    return [txt].concat((s.ind || []).map(function (t) { return "_" + t + "_"; })).join(" ").trim();
  }
  function bChanged() {
    var s = bStructure(), ta = $("parseText"), gen = bNotation(s);
    var keep = ["&lit", "Palindrome", "Cryptic definition"].filter(function (t) { return $("parseType").value.split(/,\s*/).indexOf(t) >= 0 && s.dev.indexOf(t) < 0; });
    if (s.dev.length) buildTypeChips(s.dev.concat(keep).join(", "));
    if (gen && (!ta.value.trim() || ta.value === BLD.gen)) { keepUndo(ta.value); ta.value = gen; preview(); }
    BLD.gen = gen; bRender(s);
  }
  function bRender(s) {
    s = s || bStructure();
    var sel = BLD.sel;
    DTOK.forEach(function (x, i) {
      x.el.classList.toggle("sel", !!sel && i >= sel[0] && i <= sel[1]);
      x.el.classList.toggle("ind", BLD.ind.some(function (d) { return i >= d.a && i <= d.b; }));
      for (var c = 0; c < 6; c++) x.el.classList.remove("k" + c);
      (s.p || []).forEach(function (q, n) { var r = q.w && BLD.ps.filter(function (p) { return p.a != null && bText(p.a, p.b) === q.w; })[0]; if (r && i >= r.a && i <= r.b) x.el.classList.add("k" + n % 6); });
    });
    Array.prototype.forEach.call($("bRoles").children, function (b) { b.disabled = !sel; });
    Array.prototype.forEach.call($("bSigs").children, function (b) { b.disabled = !sel; });
    $("bAsk").hidden = !BLD.ask;
    $("bHint").textContent = BLD.ask ? "Type the letters, then Add." : sel ? "\u201c" + bText(sel[0], sel[1]) + "\u201d is:" : "Tap a word, then another to select a run.";
    var box = $("bOut"); box.textContent = "";
    if (!BLD.ps.length && !BLD.ind.length) return;
    showBuild(s, BLD.w, box, true);
    var ul = mk("ul", "bx");
    BLD.ps.forEach(function (p, i) { var li = mk("li", null, (p.l || p.f) + (p.a != null ? " \u2190 " + bText(p.a, p.b) : "") + " "); li.appendChild(mk("button", "x", "\u00d7")).dataset.del = "ps:" + i; ul.appendChild(li); });
    BLD.ind.forEach(function (d, i) { var li = mk("li", null, "Indicator: " + bText(d.a, d.b) + (d.t ? " (" + d.t.toLowerCase() + ")" : "") + " "); li.appendChild(mk("button", "x", "\u00d7")).dataset.del = "ind:" + i; ul.appendChild(li); });
    box.appendChild(ul);
  }
  function withS(x) { if (BLD.ps.length || BLD.ind.length) x.s = bStructure(); return x; }
  // A saved structure back into pieces on the clue's words.
  function bLoad(s, w) {
    BLD = { sel: null, ps: [], ind: [], ask: null, gen: "", w: w };
    var find = function (t) {
      var low = (t || "").toLowerCase(); if (!low) return null;
      for (var a = 0; a < DTOK.length; a++) for (var b = a; b < DTOK.length; b++) if (bText(a, b).toLowerCase() === low) return [a, b];
      return null;
    };
    ((s && s.p) || []).forEach(function (q) {
      var r = find(q.w), k = { sel: "syn", rev: "syn", ins: "syn" }[q.o] || q.o, p = { a: r ? r[0] : null, b: r ? r[1] : null, k: r || !/^(lit|ini|alt|anag|hid)$/.test(k) ? k : "syn", l: q.l };
      if (q.o === "rev") p.rev = true;
      if (q.o === "del") { p.f = q.f || q.l; if (!q.f) p.k = "syn"; }
      if (q.o === "chg" || q.o === "spn") p.f = q.f;
      BLD.ps.push(p);
    });
    ((s && s.ind) || []).forEach(function (t) { var r = find(t); if (r) BLD.ind.push({ a: r[0], b: r[1], t: "" }); });
    BLD.gen = $("parseText").value;
    bRender();
  }
  // "Definition" in the mark-up bar: underline the selected words in the clue, replacing the blog's choice.
  var defFresh = true;
  function markDef(t) {
    var q = t.replace(/[_~()*<]/g, "").trim().toLowerCase(), clue = (DTOK.clue || "").toLowerCase();
    var at = q ? clue.indexOf(q) : -1;
    if (at < 0) return toast("Those words aren\u2019t in the clue");
    if (defFresh) { DTOK.forEach(function (x) { x.el.classList.remove("on"); }); defFresh = false; }
    DTOK.forEach(function (x) { if (x.a < at + q.length && x.b > at) x.el.classList.add("on"); });
    unsel(); renderTok(); selState();
    var dp = $("defPick"); dp.classList.remove("flash"); void dp.offsetWidth; dp.classList.add("flash");
    toast("Definition set \u2013 tap Save to keep it");
  }
  $("defClear").addEventListener("click", function () {
    DTOK.forEach(function (x) { x.el.classList.remove("on"); }); defFresh = false;
    BLD.ps = []; BLD.ind = []; BLD.sel = null; BLD.ask = null; renderTok(); bRender();
  });
  $("wpClear").addEventListener("click", function () {
    var ta = $("parseText"); if (!ta.value) return;
    keepUndo(ta.value);
    ta.value = ""; unsel(); preview(); selState();
  });
  function pickedDefs() {
    var out = [], run = null;
    DTOK.forEach(function (t, i) {
      if (t.el.classList.contains("on")) { if (run) run.b = t.b; else run = { a: t.a, b: t.b }; }
      else if (run) { out.push(run); run = null; }
    });
    if (run) out.push(run);
    return out.map(function (r) {
      return DTOK.clue.slice(r.a, r.b).replace(/[,;:.\u2013\u2014-]+$/, "");
    }).filter(Boolean);
  }
  function saveDefs(w) {
    var d = pickedDefs(), k = w.dir + w.num, blog = DEFS && DEFS[w.dir] && DEFS[w.dir][w.num];
    if (d.length === 1 && d[0] === blog) delete myDefs[k];
    else if (d.length || blog) myDefs[k] = d;
    if (d.length) hintAdd(k, false);
  }
  // Editor helpers: clue types as toggles, and a mark-up bar that acts on the selected text.
  var TYPES = ["Anagram", "Charade", "Container", "Reversal", "Hidden", "Deletion", "Letter selection", "Letter change", "Homophone", "Double definition", "Cryptic definition", "&lit", "Spoonerism", "Palindrome"];
  function buildTypeChips(current) {
    var have = current.split(/\s*(?:,|\+)\s*/).filter(Boolean), box = $("typeChips");
    box.innerHTML = "";
    var list = TYPES.slice();
    have.forEach(function (h) { if (!list.some(function (t) { return t.toLowerCase() === h.toLowerCase(); })) list.push(h); });
    list.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = t;
      if (have.some(function (h) { return h.toLowerCase() === t.toLowerCase(); })) b.classList.add("on");
      box.appendChild(b);
    });
    syncType();
  }
  function syncType() {
    $("parseType").value = Array.prototype.filter.call($("typeChips").children, function (b) { return b.classList.contains("on"); })
      .map(function (b) { return b.textContent; }).join(", ");
  }
  $("typeChips").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    b.classList.toggle("on"); syncType();
  });
  var MARKS = [
    ["Indicator", function (t) { return "_" + t + "_"; }],
    ["Anagram fodder", function (t) { return "(" + t.toUpperCase() + ")*"; }],
    ["Reversed", function (t) { return "(" + t.toUpperCase() + ")<"; }],
    ["Goes inside", function (t) { return "(" + t + ")"; }],
    ["Removed", function (t) { return "~" + t + "~"; }],
    ["Answer letters", function (t) { return t.toUpperCase(); }],
    ["Not in answer", function (t) { return t.toLowerCase(); }],
    ["Clear marks", function (t) { return t.replace(/^\((.*)\)[*<]?$/, "$1").replace(/[_~]/g, ""); }],
    ["Definition", null],
    ["Delete", function () { return ""; }]
  ];
  MARKS.forEach(function (m, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip" + (m[0] === "Delete" ? " del" : m[0] === "Definition" ? " def" : ""); b.textContent = m[0]; b.dataset.i = i;
    $("markChips").appendChild(b);
  });
  var lastSel = [0, 0];
  function unsel() { lastSel = [0, 0]; TOK.anchor = -1; }
  function selState() {
    var ta = $("parseText"), has = document.activeElement === ta && ta.selectionEnd > ta.selectionStart;
    if (has) lastSel = [ta.selectionStart, ta.selectionEnd];
    var live = lastSel[1] > lastSel[0];
    $("selBar").classList.toggle("live", live);
    $("selHint").textContent = live ? "Mark \u201c" + ta.value.slice(lastSel[0], lastSel[1]) + "\u201d as:" : ta.hidden ? (TOK.letters ? "Tap a letter, then tap another to select a run, then pick what they do." : "Tap a word, then tap another to select a run, then pick what they do.") : "Select text below, then pick what it does.";
    $("selClear").hidden = !live || !ta.hidden;
    Array.prototype.forEach.call($("markChips").children, function (b) { b.disabled = !live; });
  }
  function preview() { markup($("parsePrev"), $("parseText").value || " "); renderTok(); }
  // Tap-to-select view of the wordplay, so marking up never needs the iOS keyboard.
  var TOK = { letters: false, anchor: -1, items: [] };
  function renderTok() {
    var box = $("wpTok"), text = $("parseText").value, re = TOK.letters ? /\S/g : /\S+/g, m, pos = 0;
    box.innerHTML = ""; box.classList.toggle("letters", TOK.letters); TOK.items = [];
    // Underline the wordplay words that are the chosen definition, so "Definition" shows here too.
    var low = text.toLowerCase(), dr = [];
    pickedDefs().forEach(function (d) {
      d = d.toLowerCase(); if (!d) return;
      for (var at = low.indexOf(d); at >= 0; at = low.indexOf(d, at + 1)) dr.push([at, at + d.length]);
    });
    if (!text.trim()) { box.innerHTML = '<span class="empty">Tap \u201cFrom clue\u201d or \u201cType\u201d to add wordplay.</span>'; return; }
    while ((m = re.exec(text))) {
      var gap = text.slice(pos, m.index);
      if (gap) gap.split("\n").forEach(function (g, i) { if (i) box.appendChild(document.createElement("br")); if (g) box.appendChild(document.createTextNode(g)); });
      var t = document.createElement("span"), a = m.index, b = a + m[0].length, idx = TOK.items.length;
      t.className = "tok"; t.textContent = m[0];
      if (lastSel[1] > lastSel[0] && a >= lastSel[0] && b <= lastSel[1]) t.classList.add("sel");
      if (dr.some(function (r) { return a < r[1] && b > r[0]; })) t.classList.add("isdef");
      t.dataset.i = idx; t.addEventListener("click", function () { tapTok(+this.dataset.i); });
      box.appendChild(t); TOK.items.push({ a: a, b: b });
      pos = b;
    }
  }
  function tapTok(i) {
    var it = TOK.items[i], has = lastSel[1] > lastSel[0];
    if (!has || TOK.anchor < 0) { TOK.anchor = i; lastSel = [it.a, it.b]; }
    else if (i === TOK.anchor && lastSel[0] === it.a && lastSel[1] === it.b) { TOK.anchor = -1; lastSel = [0, 0]; }
    else { var x = TOK.items[TOK.anchor], lo = Math.min(x.a, it.a), hi = Math.max(x.b, it.b); lastSel = [lo, hi]; }
    renderTok(); selState();
  }
  function typing(on) {
    var ta = $("parseText");
    ta.hidden = !on; $("wpTok").hidden = on; $("typeBtn").classList.toggle("on", on); $("typeBtn").textContent = on ? "Done" : "Type";
    unsel();
    if (on) { try { ta.focus(); } catch (e) {} } else { ta.blur(); preview(); }
    selState();
  }
  $("typeBtn").addEventListener("click", function () { typing($("parseText").hidden); });
  $("lettersBtn").addEventListener("click", function () {
    TOK.letters = !TOK.letters; this.setAttribute("aria-pressed", String(TOK.letters));
    unsel(); renderTok(); selState();
  });
  var UNDO = [];
  function keepUndo(v) { UNDO.push(v); $("undoBtn").hidden = false; }
  $("undoBtn").addEventListener("click", function () {
    if (!UNDO.length) return;
    $("parseText").value = UNDO.pop(); this.hidden = !UNDO.length;
    unsel(); preview(); selState();
  });
  $("selClear").addEventListener("click", function () { unsel(); renderTok(); selState(); });
  // Keep the textarea's selection when a chip is pressed.
  $("markChips").addEventListener("pointerdown", function (e) { if (e.target.closest(".chip")) e.preventDefault(); });
  $("markChips").addEventListener("mousedown", function (e) { if (e.target.closest(".chip")) e.preventDefault(); });
  $("markChips").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b || b.disabled) return;
    var ta = $("parseText"), a = lastSel[0], z = lastSel[1];
    if (z <= a) return;
    if (!MARKS[+b.dataset.i][1]) return markDef(ta.value.slice(a, z));
    var out = MARKS[+b.dataset.i][1](ta.value.slice(a, z));
    keepUndo(ta.value);
    ta.value = ta.value.slice(0, a) + out + ta.value.slice(z);
    if (!out) { var before = ta.value.slice(0, a).replace(/[ \t]+$/, ""), after = ta.value.slice(a).replace(/^[ \t]+/, ""); ta.value = before + (before && after && !/\n$/.test(before) && !/^[\n,.;:)]/.test(after) ? " " : "") + after; a = before.length; }
    if (ta.hidden) { unsel(); }
    else { lastSel = [a, a + out.length]; try { ta.focus(); ta.setSelectionRange(a, a + out.length); } catch (err) {} }
    preview(); selState();
  });
  ["select", "keyup", "mouseup", "touchend", "input", "focus"].forEach(function (ev) {
    $("parseText").addEventListener(ev, function () { if (ev === "input") { lastSel = [0, 0]; preview(); } setTimeout(selState, 0); });
  });
  document.addEventListener("selectionchange", function () { if (document.activeElement === $("parseText")) selState(); });
  $("useClue").addEventListener("click", function () {
    var w = curWord(), ta = $("parseText");
    var text = w.clue.replace(/\s*\([\d,\-\s]+\)\s*$/, "").toLowerCase();
    keepUndo(ta.value);
    ta.value = ta.value.trim() ? ta.value.trim() + "\n" + text : text;
    unsel(); preview(); selState(); if (!ta.hidden) ta.focus();
  });
  $("parseInfo").addEventListener("click", function () {
    var open = $("parseHelp").hidden;
    $("parseHelp").hidden = !open;
    $("parseInfo").setAttribute("aria-expanded", open ? "true" : "false");
  });
  $("parseReset").addEventListener("click", function () {
    var w = curWord();
    delete myParses[w.dir + w.num]; delete myDefs[w.dir + w.num]; save(); render(); showParse(w);
  });
  $("hintNo").addEventListener("click", function () {
    if (askMode === "edit") return showParse(curWord());
    $("ansRow").hidden = true;
    $("hintAsk").hidden = true;
  });
  $("hintAsk").addEventListener("click", function (e) { if (e.target === $("hintAsk") && askMode !== "edit" && askMode !== "add") $("hintAsk").hidden = true; });
  $("hintYes").addEventListener("click", function () {
    var w = curWord();
    if (askMode === "find" || askMode === "info") { $("hintAsk").hidden = true; return; }
    if (askMode === "clue") return edClueSave(w);
    if (askMode === "clear") {
      $("hintAsk").hidden = true;
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) fill[r][c] = "";
      ok = {};  // the time, recorded mode, hints and reveals stay: clearing never makes a fresh attempt
      save(); render(); return toast("Grid cleared");
    }
    if (askMode === "entry") { $("hintAsk").hidden = true; return entryShare(); }
    if (askMode === "email") { $("hintAsk").hidden = true; location.href = ENTRY.mail; return; }
    if (askMode === "submit") { $("hintAsk").hidden = true; return submit(); }
    if (askMode === "unsubmit") { $("hintAsk").hidden = true; SUB = null; solved = false; EDITED = true; startClock(); save(); render(); return; }
    if (askMode === "add") {
      var key = w.dir + w.num, letters = $("ansInput").value.toUpperCase().replace(/[^A-Z]/g, "");
      if (letters.length !== w.cells.length) return toast("The answer needs " + w.cells.length + " letters");
      var clash = w.cells.some(function (rc, i) { var a = solAt(rc[0], rc[1]); return (a && a !== letters[i]) || (ok[rc[0] + "," + rc[1]] && fill[rc[0]][rc[1]] !== letters[i]); });
      if (clash) return toast("That doesn't fit the letters already checked");
      userAns[key] = letters;
      w.cells.forEach(function (rc, i) { userSol[rc[0] + "," + rc[1]] = letters[i]; fill[rc[0]][rc[1]] = letters[i]; ok[rc[0] + "," + rc[1]] = 1; });
      var at = $("parseType").value.trim(), ax = $("parseText").value.trim();
      if (ax || at) myParses[key] = withS({ type: at || "Parsing", wordplay: ax });
      saveDefs(w);
      $("ansRow").hidden = true;
      flash(w); render(); save(); toast("Answer added");
      return showParse(w);
    }
    if (askMode === "edit") {
      var t = $("parseType").value.trim(), x = $("parseText").value.trim();
      if (x || P.ed && t) myParses[w.dir + w.num] = withS({ type: t || "Parsing", wordplay: x });
      saveDefs(w); save(); render(); toast("Parsing saved");
      return showParse(w);
    }
    $("hintAsk").hidden = true;
    if (askMode === "parse") return;
    if (askMode === "reveal") {
      var nw = [];
      w.cells.forEach(function (rc, i) {
        if (!ok[rc[0] + "," + rc[1]]) nw.push(i);
        fill[rc[0]][rc[1]] = solAt(rc[0], rc[1]); ok[rc[0] + "," + rc[1]] = 1;
      });
      REV = true; REVW[w.dir + w.num] = nw.length === w.cells.length ? 1 : nw;
      flash(w);
      render(); save();
      return;
    }
    hintAdd(w.dir + w.num, askMode === "hint2"); HN++;
    render(); save();
  });
  // Word finder (its own button, in every mode): entries in the word list that fit the answer's length and the letters
  // already in the grid. For an answer of several words, phrases of the right word lengths come first, then the single
  // words that fit each part, to fill one part at a time.
  $("findBtn").addEventListener("click", function () {
    var w = curWord(), pat = w.cells.map(function (rc) { return fill[rc[0]][rc[1]] || ""; });
    var br = seps(w.breaks), parts = partsOf(w);
    var shown = pat.map(function (ch, i) { return (ch || "?") + (br[i] || ""); }).join("");
    withWords($("findBtn"), [pat.length].concat(parts.map(function (p) { return p.len; })), function (W) {
      var all = entries(W(pat.length), w, pat), fit = all.filter(function (h) { return h.fit; }), box = $("findList");
      var each = parts.length > 1 ? parts.map(function (pt) { return partWords(W(pt.len), pat, pt); }) : [];
      var multi = fit.length && each.length || each.some(function (l) { return l.length; });
      var hits = multi || fit.length ? fit : all, n = hits.length;
      askMode = "find"; askReset("");
      $("hintTitle").textContent = "Find words for " + wordName(w);
      $("hintText").hidden = $("hintNo").hidden = true; $("hintYes").textContent = "Done";
      var fills = function (at, L) { L.split("").forEach(function (ch, i) { var rc = w.cells[at + i]; put(rc[0], rc[1], ch); }); $("hintAsk").hidden = true; render(); save(); };
      box.innerHTML = "";
      if (multi) {
        $("findNote").textContent = shown + ": " + (n ? "phrases that fit, then words for each part." : "words that fit each part.");
        if (n) { box.appendChild(mk("span", "lbl", "Phrases")); chipList(box, hits, 12, function (h) { fills(0, h.L); }); }
        parts.forEach(function (pt, i) {
          box.appendChild(mk("span", "lbl", "Word " + (i + 1) + " (" + pt.len + ")" + (each[i].length ? "" : ": none in the list fit")));
          chipList(box, each[i], 30, function (h) { fills(pt.at, h.L); });
        });
      } else {
        $("findNote").textContent = shown + ": " + (!n ? "no words in the list fit." :
          (fit.length ? "" : "none match the word lengths, but these fit the letters. ") +
          (n > 60 ? "Showing 60 of " + n + "; fill in more letters to narrow it down." : n + (n > 1 ? " words fit." : " word fits.")));
        chipList(box, hits, 60, function (h) { fills(0, h.L); });
      }
      $("findBox").hidden = false; $("hintAsk").hidden = false;
    });
  });
  $("wheelClose").addEventListener("click", wheelClose);
  $("shuffleBtn").addEventListener("click", function () { layoutTiles(true); });
  $("slotsClear").addEventListener("click", function () { AW.slots = AW.slots.map(function (v) { return typeof v === "string" ? v : -1; }); AW.pick = AW.slots.indexOf(-1); wheelRender(); });
  $("slots").addEventListener("click", function (e) {
    var d = e.target.closest(".slot"); if (!d) return;
    var i = +d.dataset.i;
    if (AW.pick === i && AW.slots[i] !== -1) AW.slots[i] = -1;
    AW.pick = i; wheelRender();
  });
  $("toGrid").addEventListener("click", function () {
    var w = AW.word;
    w.cells.forEach(function (rc, i) { var v = AW.slots[i]; if (typeof v === "number" && v >= 0) put(rc[0], rc[1], AW.tiles[v].ch); });
    wheelClose();
    sel = { r: w.cells[0][0], c: w.cells[0][1], dir: w.dir };
    render(); save();
  });

  $("kb").addEventListener("pointerdown", function (e) {
    var b = e.target.closest(".key"); if (!b) return;
    e.preventDefault();
    var k = b.dataset.k;
    if (AW.open) { if (k !== "↕") wheelKey(k); return; }
    if (k === "⌫") del();
    else if (k === "↕") tapCell(sel.r, sel.c);
    else typeLetter(k);
  });

  document.addEventListener("keydown", function (e) {
    // Typing in a box (Settings' Name, say) is never a move in the grid behind it.
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
    if (!$("home").hidden || !$("sheet").hidden || !$("setSheet").hidden || !$("edSheet").hidden || !$("gridSheet").hidden || !$("qfSheet").hidden || !$("hintAsk").hidden || !$("dictDlg").hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (AW.open) {
      if (k === "Escape") wheelClose();
      else if (/^[a-zA-Z]$/.test(k)) wheelKey(k.toUpperCase());
      else if (k === "Backspace") wheelKey("⌫");
      else return;
      return e.preventDefault();
    }
    if (/^[a-zA-Z]$/.test(k)) { typeLetter(k.toUpperCase()); }
    else if (k === "Backspace" || k === "Delete") del();
    else if (k === "ArrowLeft") move(0, -1);
    else if (k === "ArrowRight") move(0, 1);
    else if (k === "ArrowUp") move(-1, 0);
    else if (k === "ArrowDown") move(1, 0);
    else if (k === "Enter" && P.qf) $("qfSolve").click();
    else if (k === "Tab" || k === "Enter") nextWord(e.shiftKey ? -1 : 1);
    else if (k === " ") tapCell(sel.r, sel.c);
    else return;
    e.preventDefault();
  });

  $("grid").addEventListener("click", function (e) {
    var el = e.target.closest(".c"); if (!el) return;
    if (P.ed && ED.sq) return edToggle(+el.dataset.r, +el.dataset.c);
    tapCell(+el.dataset.r, +el.dataset.c);
  });
  $("clues").addEventListener("click", function (e) {
    var el = e.target.closest(".clue"); if (el) { showList(false); gotoWord(+el.dataset.i); }
  });
  $("now").addEventListener("click", function () { if (P.ed) edClue(curWord()); else tapCell(sel.r, sel.c); });
