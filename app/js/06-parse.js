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
    var key = w.dir + w.num, mine = myParses[key] && !myParses[key].off ? myParses[key] : null, blog = blogParse(w);
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
    var t = s && treeFor(w, s, w.cells.map(function (rc) { return solAt(rc[0], rc[1]) || fill[rc[0]][rc[1]] || ""; }).join(""));
    if (t) tMarkClue($("pvClue"), w, t);
    $("pvAns").textContent = answerText(w); $("pvAns").hidden = !!s;
    // a tree that gives the answer names the type from its operations; else the blog's or the solver's words
    $("pvType").textContent = t && t.t && tCheck(t, w.clue, w.cells.map(function (rc) { return solAt(rc[0], rc[1]) || ""; }).join("")) ? tTypes(t, w.clue) : r.type;
    // With a structure the marked clue and the tiles are the parsing; the written parsing shows only when there is
    // none, or when Blog parse is tapped (the blog's words, verbatim).
    markup($("pvWp"), s ? "" : r.wordplay);
    var bp = blogParse(w); $("pvBlog").hidden = !(s && bp && bp.wordplay); $("pvBlog").classList.remove("on");
    tShowBuild(t, w, $("pvBuild"));
    $("pvNote").textContent = r.mine && myParses[key].note || ""; $("pvNote").hidden = !$("pvNote").textContent;
    $("hintText").hidden = true; $("parseView").hidden = false;
    // The blog is linked from the finish bar; the note only says when the parsing is the solver's own or missing.
    $("parseNote").textContent = r.mine || r.blog ? "" : "No parsing from the blog yet.";
    $("parseNote").hidden = !!(P.ed || P.made) || !$("parseNote").textContent;  // a created puzzle's parsings are all the setter's
    $("parseForm").hidden = $("clueForm").hidden = $("clueParse").hidden = true;
    var rec = myParses[key], off = rec && rec.off;
    $("parseReset").textContent = off ? "Use mine" : "Use original";
    $("parseEdit").hidden = false; $("parseReset").hidden = P.ed || !(off || r.mine || myDefs[key]);
    $("hintNo").hidden = true;
    $("hintYes").textContent = "Done";
  }
  // A cryptic or double definition with no stored structure: the clue's type and definitions are enough.
  function defsOnly(w, type) {
    if (/cryptic definition/i.test(type)) return { v: 0, dev: ["Cryptic definition"] };
    if (/double definition/i.test(type) && defsFor(w).length > 1) return { v: 0, dev: ["Double definition"], defs: defsFor(w) };
  }
  // Editor for a parsing; with withAnswer it also asks for the answer to a clue nobody had solved.
  // One flow: tap the clue's words and say what they are (the definition, an indicator, or where the answer's letters
  // come from); the tiles build as you go and the clue type follows from the pieces. A note at the bottom is free
  // text, shown under the parsing. The written wordplay and the type are made from the pieces when saving.
  function openEditor(w, withAnswer) {
    var r = parseFor(w), mine = myParses[w.dir + w.num] || null, has = r.mine || r.blog;
    askMode = withAnswer ? "add" : "edit";
    $("hintTitle").textContent = (withAnswer ? "Add your answer for " : "") + wordName(w);
    $("ansRow").hidden = !withAnswer;
    if (withAnswer) $("ansInput").value = w.cells.map(function (rc) { return fill[rc[0]][rc[1]] || ""; }).join("");
    var p = has && r.s ? treeFor(w, Object.assign({}, r.s, { ty: r.type }), w.cells.map(function (rc) { return solAt(rc[0], rc[1]) || fill[rc[0]][rc[1]] || ""; }).join("")) : null;
    var defs = p && p.def && p.def.length ? p.def : defSpans(w, defsFor(w));
    buildDefPick(w, defs); bLoad(p, w);
    if (has && !p) ["&lit", "Palindrome"].forEach(function (k, i) { if (r.type.split(/,\s*/).indexOf(k) >= 0) PE.whole.push(["&lit", "pal"][i]); });
    // A parsing of the solver's own written as text, with no pieces, moves to the note so nothing is lost.
    var moved = !!(mine && !r.s && mine.wordplay && !mine.note);
    $("parseNotes").value = mine ? mine.note || (moved ? mine.wordplay : "") : "";
    PE.old = moved || !has || p ? "" : r.wordplay; PE.oldType = has ? r.type : "";
    bRender();
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
  // Can the piece give seg? Returns how ("" for as it stands, "rev", "anag"), or null.
  function bFits(p, seg, rev, anag) {
    if (p.k === "grp") return p.l === seg ? "" : null;  // pieces reversed together: their letters, backwards
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
        if (p.k === "hid" || p.k === "del" || p.k === "grp") return;
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
  var TYPES = ["Anagram", "Charade", "Container", "Reversal", "Hidden", "Deletion", "Letter selection", "Letter change", "Homophone", "Double definition", "Cryptic definition", "&lit", "Spoonerism", "Palindrome"];
  $("parseReset").addEventListener("click", function () {
    var w = curWord(), k = w.dir + w.num, rec = myParses[k];
    if (rec && rec.off) {
      if (rec.off.defs) myDefs[k] = rec.off.defs;
      delete rec.off; if (!rec.wordplay && !rec.type) delete myParses[k];
    } else {
      var aside = {}; if (myDefs[k]) aside.defs = myDefs[k];
      delete myDefs[k]; if (rec) rec.off = aside; else myParses[k] = { off: aside };
    }
    save(); render(); showParse(w);
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
      var arec = bRecord($("parseNotes").value.trim());
      if (arec) myParses[key] = arec;
      saveDefs(w);
      $("ansRow").hidden = true;
      flash(w); render(); save(); toast("Answer added");
      return showParse(w);
    }
    if (askMode === "edit") {
      var erec = bRecord($("parseNotes").value.trim());
      if (erec) myParses[w.dir + w.num] = erec;
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
