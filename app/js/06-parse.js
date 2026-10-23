  // Hint underlines the definition; once hinted, the same button becomes Reveal.
  function lockedCell(k) { return !!SUB || (!HARD && !!ok[k]); }
  // A finished grid offers no more hints or reveals.
  function locked(w) { if (HARD || solved) return solved; return w.cells.every(function (rc) { return ok[rc[0] + "," + rc[1]]; }); }
  var askMode = "hint";
  $("hintBtn").addEventListener("click", function () {
    var w = curWord(), name = wordName(w), act = nextAction(w);
    askReset("Not yet");
    // The word finder is offered only once a hint for this clue has been accepted.
    $("findBtn").hidden = !(hinted[w.dir + w.num] >= 1) || act === "parse" || act === "add";
    if (act === "parse") {
      showParse(w);
    } else if (act === "add") {
      openEditor(w, true);
    } else if (act === "hint2") {
      askMode = "hint2";
      $("hintTitle").textContent = "Show a" + (hasDef(w) ? " second" : "") + " hint for " + name + "?";
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
      $("hintTitle").textContent = "Show a hint for " + name + "?";
      $("hintText").textContent = "The definition part of this clue will be underlined. Are you sure you want to see the hint?";
      $("hintYes").textContent = "Show hint";
    }
    // Settings can skip the question, except when it also offers Find words; Quickfire never asks.
    if (/^(hint|hint2|reveal)$/.test(act) && (P.qf || prefs().noAsk && $("findBtn").hidden)) $("hintYes").click();
    else $("hintAsk").hidden = false;
  });
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
  function parseFor(w) {
    var key = w.dir + w.num, mine = myParses[key], blog = PARSES && PARSES[w.dir] && PARSES[w.dir][w.num];
    var x = mine || blog || { type: "Not parsed", wordplay: "The blog has no parsing for this clue. Tap Edit to add your own." };
    return { mine: !!mine, blog: !!blog, type: ctype(x.type), wordplay: x.wordplay || "" };
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
    hinted[key] = had || 1; clueInto($("pvClue"), w, true); if (!had) delete hinted[key];
    $("pvAns").textContent = answerText(w);
    $("pvType").textContent = r.type;
    markup($("pvWp"), r.wordplay);
    $("hintText").hidden = true; $("parseView").hidden = false;
    var bl = r.blog && fromBlog(w);
    $("parseNote").textContent = r.mine ? editedBy() + (bl ? ", from the " + blogName() + " blog\u2019s parsing. " : ".") : bl ? "Parsing from the " + blogName() + " blog. " : "No parsing from the blog yet.";
    if (bl) {
      var a = document.createElement("a"); a.href = P.blog; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Read the post";
      $("parseNote").appendChild(a);
    }
    $("parseNote").hidden = false;
    $("parseForm").hidden = true;
    $("parseEdit").hidden = false; $("parseReset").hidden = !r.mine && !myDefs[key];
    $("hintNo").hidden = true;
    $("hintYes").textContent = "Done";
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
    buildTypeChips($("parseType").value); preview(); selState(); buildDefPick(w);
    $("hintText").textContent = withAnswer ? "The answer to this clue isn't known yet. If you have solved it, enter the answer and, if you like, how it works. It will be locked in green." : "";
    $("hintText").hidden = !withAnswer;
    $("parseView").hidden = true; $("parseNote").hidden = true; $("parseForm").hidden = false;
    $("parseEdit").hidden = true; $("parseReset").hidden = true;
    $("hintNo").hidden = false; $("hintNo").textContent = "Cancel";
    $("hintYes").textContent = "Save";
    $("hintAsk").hidden = false;
  }
  $("parseEdit").addEventListener("click", function () { openEditor(curWord(), false); });
  // Definition picker: the clue as tappable words; runs of chosen words become the definition(s).
  var DTOK = [];
  function buildDefPick(w) {
    var box = $("defPick"), body = w.clue.replace(/\s*\([\d,\-\s]+\)\s*$/, ""), re = /\S+/g, m;
    var spans = defSpans(w, defsFor(w));
    box.innerHTML = ""; DTOK = [];
    var pos = 0;
    while ((m = re.exec(body))) {
      if (m.index > pos) box.appendChild(document.createTextNode(body.slice(pos, m.index)));
      var t = document.createElement("span"), a = m.index, b = a + m[0].length;
      t.className = "tok"; t.textContent = m[0];
      if (spans.some(function (sp) { return a < sp[1] && b > sp[0]; })) t.classList.add("on");
      t.addEventListener("click", function () { this.classList.toggle("on"); });
      box.appendChild(t); DTOK.push({ el: t, a: a, b: b });
      pos = b;
    }
    DTOK.clue = w.clue; renderTok();
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
  $("defClear").addEventListener("click", function () { DTOK.forEach(function (x) { x.el.classList.remove("on"); }); defFresh = false; renderTok(); });
  $("defPick").addEventListener("click", function () { defFresh = false; setTimeout(renderTok, 0); });
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
    if (d.length) hinted[k] = Math.max(hinted[k] || 0, 1);
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
      if (ax || at) myParses[key] = { type: at || "Parsing", wordplay: ax };
      saveDefs(w);
      $("ansRow").hidden = true;
      flash(w); render(); save(); toast("Answer added");
      return showParse(w);
    }
    if (askMode === "edit") {
      var t = $("parseType").value.trim(), x = $("parseText").value.trim();
      if (x) myParses[w.dir + w.num] = { type: t || "Parsing", wordplay: x };
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
    hinted[w.dir + w.num] = askMode === "hint2" ? 2 : 1; HN++;
    render(); save();
  });
  // Word finder: words from the word list that fit the answer's length and the letters already in the grid.
  $("findBtn").addEventListener("click", function () {
    var w = curWord(), pat = w.cells.map(function (rc) { return fill[rc[0]][rc[1]] || ""; });
    var br = seps(w.breaks);
    var shown = pat.map(function (ch, i) { return (ch || "?") + (br[i] || ""); }).join("");
    withWords($("findBtn"), function (list) {
      var all = entries(list, w, pat), fit = all.filter(function (h) { return h.fit; }), hits = fit.length ? fit : all;
      $("findNote").textContent = shown + ": " + (!hits.length ? "no words in the list fit." :
        (fit.length ? "" : "none match the word lengths, but these fit the letters. ") +
        (hits.length > 60 ? "Showing 60 of " + hits.length + "; fill in more letters to narrow it down." : hits.length + (hits.length > 1 ? " words fit." : " word fits.")));
      $("findList").innerHTML = "";
      chipList($("findList"), hits, 60, function (h) {
        w.cells.forEach(function (rc, i) { put(rc[0], rc[1], h.L[i]); });
        $("hintAsk").hidden = true;
        render(); save();
      });
      $("findBox").hidden = false;
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
    if (!$("home").hidden || !$("sheet").hidden || !$("qfSheet").hidden || !$("hintAsk").hidden || !$("dictDlg").hidden || e.metaKey || e.ctrlKey || e.altKey) return;
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
    tapCell(+el.dataset.r, +el.dataset.c);
  });
  $("clues").addEventListener("click", function (e) {
    var el = e.target.closest(".clue"); if (el) { showList(false); gotoWord(+el.dataset.i); }
  });
  $("now").addEventListener("click", function () { tapCell(sel.r, sel.c); });
