  // The parse view, drawn from the parsing's tree (17-tree.js): the clue marked from its spans, the answer's tiles
  // coloured by the pieces the tree fits, and one line per piece saying what it is and where it sits.
  function treeFor(w, s, ans) {
    if (!s) return null;
    var p = s.tree ? JSON.parse(JSON.stringify(s.tree)) : tFromFlat(s, w.clue, ans);
    if (!p.kind && /cryptic definition/i.test(s.ty || "") && !p.t) p.kind = "cd";
    if (/&lit/i.test(s.ty || "")) p.kind = "&lit";
    if (/palindrome/i.test(s.ty || "")) p.pal = true;
    return p;
  }
  function tQuote(clue, w) { return "“" + tText(clue, w).replace(/[,;:.!?]+$/, "") + "”"; }
  // The clue character of each letter a part's words give, when the part is clue words as written (a word, or a run
  // of them); else null.
  function tLitChars(n, clue) {
    if (n.op === "lit") { var out = []; for (var c = n.w[0]; c < n.w[1]; c++) if (/[a-z]/i.test(clue[c])) out.push(c); return out; }
    if (n.op !== "cat") return null;
    var all = [];
    for (var i = 0; i < n.of.length; i++) { var k = tLitChars(n.of[i], clue); if (!k) return null; all = all.concat(k); }
    return all;
  }
  // How letters are picked from words: first or last letters, alternate letters, hidden, a start or an end.
  function tPickName(n, clue) {
    var ws = tWords(n.of, clue) || [], full = ws.join(""), at = n.at, s = 0, starts = ws.map(function (x) { var a = s; s += x.length; return a; });
    var same = function (b) { return b.length === at.length && b.every(function (j, i) { return j === at[i]; }); };
    var run = at.every(function (j, i) { return !i || j === at[i - 1] + 1; });
    if (ws.length > 1 && same(starts)) return "first letters of ";
    if (ws.length > 1 && same(starts.map(function (a, i) { return a + ws[i].length - 1; }))) return "last letters of ";
    if (at.length === 1 && at[0] === 0) return "first letter of ";
    if (at.length === 1 && at[0] === full.length - 1) return "last letter of ";
    if (at.length > 1 && at.every(function (j, i) { return !i || j === at[i - 1] + 2; }) && (at[0] < 2) && full.length - 1 - at[at.length - 1] < 2) return "alternate letters of ";
    if (run && at[0] === 0) return "start of ";
    if (run && at[at.length - 1] === full.length - 1) return "end of ";
    if (run && ws.length > 1) return "hidden in ";
    if (run && at.length === full.length - 2) return "middle of ";
    return "letters " + at.map(function (j) { return full[j]; }).join("") + " of ";
  }
  // A part as words: [text or {ind: text}], read out from the tree. top is the piece itself (its letters are on its chip).
  function tSay(n, clue) {
    var q = function (w) { return tQuote(clue, w); }, out = [], put = function () { out.push.apply(out, arguments); };
    var by = function () { (n.ind || []).forEach(function (w) { put(" (", { ind: tText(clue, w) }, ")"); }); };
    var noun = function (k) {
      if (k.op === "lit") return [q(k.w)];
      var chars = tLitChars(k, clue);
      if (chars) return [q([k.of[0].w[0], k.of[k.of.length - 1].w[1]])];
      var l = tMake(k, clue);
      if (l && k.w && (k.op === "syn" || k.op === "abr")) return [l + " (" + (k.op === "abr" ? "short for " : "") + q(k.w) + ")"];
      return l ? [l + " ("].concat(tSay(k, clue), [")"]) : tSay(k, clue);
    };
    switch (n.op) {
      case "lit": put(q(n.w) + " as written"); break;
      case "syn": put(n.w ? "synonym of " + q(n.w) : "synonym (the blog doesn’t say of which words)"); break;
      case "abr": put("abbreviation" + (n.w ? " of " + q(n.w) : "")); break;
      case "pick": put(tPickName(n, clue)); put.apply(null, noun(n.of)); by(); break;
      case "cut":
        var whole = tMake(n.of, clue) || "";
        put.apply(null, noun(n.of)); put(" less " + n.at.map(function (j) { return whole[j] || ""; }).join("")); by(); break;
      case "rev": put("reversal"); by(); put(" of "); put.apply(null, noun(n.of)); break;
      case "anag": put("anagram"); by(); put(" of "); put.apply(null, noun(n.of)); break;
      case "snd": put("homophone"); by(); put(": sounds like " + (n.of.l || tMake(n.of, clue) || "") + (n.of.w ? ", for " + q(n.of.w) : "")); break;
      case "chg": put("letter change"); by(); put(": " + (tMake(n.of, clue) || "") + " becomes " + n.l + (n.of.w ? ", from " + q(n.of.w) : "")); break;
      case "spn": put("spoonerism"); by(); put(" of "); put.apply(null, noun(n.of)); put(": swap their first sounds"); break;
      case "cat": n.of.forEach(function (k, i) { if (i) put(" + "); put.apply(null, noun(k)); }); break;
      case "ins": put.apply(null, noun(n.out)); put(" around"); by(); put(" "); put.apply(null, noun(n.in)); break;
    }
    return out;
  }
  function tPut(el, parts) { parts.forEach(function (x) { el.appendChild(typeof x === "string" ? document.createTextNode(x) : mk("i", "mind", x.ind)); }); }
  // The clue once, marked from the tree: the definition underlined, indicators in italics, each piece's words tinted
  // like its tiles (letters picked or kept from words tint those letters alone).
  function tMarkClue(el, w, p) {
    var clue = w.clue, n = clue.length, piece = [], ind = [], def = [], plain = [];
    if (p.kind === "cd") { el.textContent = ""; el.appendChild(mk("span", "mcd", clue)); return; }  // the whole clue is the definition
    var span = function (sp, arr, v) { for (var c = sp[0]; c < sp[1]; c++) if (arr[c] == null) arr[c] = v; };
    if (p.t) {
      var us = tUnits(p.t);
      us.forEach(function (u, unit) {
        var cls = "k" + u % 6 + (tTrusted(unit) ? " snd" : "");
        (function tint(k) {
          var chars = (k.op === "pick" || k.op === "cut") && tLitChars(k.of, clue);
          if (chars) {
            chars.forEach(function (c, j) { plain[c] = 1; if ((k.at.indexOf(j) >= 0) === (k.op === "pick") && piece[c] == null) piece[c] = cls; });
            return;
          }
          if (k.w) span(k.w, piece, cls);
          tKids(k).forEach(tint);
        })(unit);
      });
      (function inds(k) { (k.ind || []).forEach(function (sp) { span(sp, ind, "mind"); }); tKids(k).forEach(inds); })(p.t);
    }
    (p.ind || []).forEach(function (sp) { span(sp, ind, "mind"); });
    plain.forEach(function (v, c) { if (v && piece[c] == null) ind[c] = null; });
    var defs = p.def || [];
    if (!defs.length) defs = defsFor(w).map(function (d) { return tSpan(clue, d); }).filter(Boolean);
    defs.forEach(function (sp, i) { span(sp, def, "mdef" + (p.kind === "dd" && defs.length > 1 ? " d" + i % 2 : "")); });
    el.textContent = "";
    for (var a = 0; a < n;) {
      var key = [piece[a], ind[a], def[a]].join("|"), b = a + 1;
      while (b < n && [piece[b], ind[b], def[b]].join("|") === key) b++;
      var cls = [piece[a], ind[a], def[a]].filter(Boolean).join(" "), text = clue.slice(a, b);
      el.appendChild(cls ? mk(def[a] ? "u" : "span", cls, text) : document.createTextNode(text));
      a = b;
    }
    if (p.kind === "&lit") { var all = mk("span", "mcd"); while (el.firstChild) all.appendChild(el.firstChild); el.appendChild(all); }  // the whole clue is also the definition
  }
  // The answer's tiles coloured by piece, then a line per piece: its letters, what it is, and where it sits (around
  // the pieces inside it, or inside another); reversals of several pieces and the whole-clue kinds get a note.
  function tShowBuild(p, w, box) {
    var clue = w.clue, letters = w.cells.map(function (rc) { return solAt(rc[0], rc[1]) || fill[rc[0]][rc[1]] || " "; });
    var ans = letters.join("").replace(/[^A-Z]/gi, "");
    box.textContent = ""; box.hidden = !p;
    if (!p) return;
    var note = function (head, parts) { var e = mk("p", "dd"); e.appendChild(mk("b", null, head)); tPut(e, parts); box.appendChild(e); };
    if (p.t) {
      var us = tUnits(p.t), own = ans.length === letters.length ? tFit(p.t, ans.toUpperCase(), clue, us) : null, list = [];
      us.forEach(function (u, unit) { list[u] = unit; });
      var cls = function (u) { return "k" + u % 6 + (tTrusted(list[u]) ? " snd" : ""); };
      var tiles = mk("div", "tiles");
      letters.forEach(function (ch, k) { tiles.appendChild(mk("b", own ? cls(own[k]) : "", ch)); });
      // where each piece sits: the containers above it, and the letters of a part from the answer as placed
      var up = new Map();
      (function walk(n) { tKids(n).forEach(function (k) { up.set(k, n); walk(k); }); })(p.t);
      var under = function (n) { var out = []; (function g(k) { if (us.has(k)) out.push(us.get(k)); else tKids(k).forEach(g); })(n); return out; };
      var placed = function (n) {
        var u = under(n);
        if (own) return letters.filter(function (_, k) { return u.indexOf(own[k]) >= 0; }).join("");
        return tMake(n, clue) || "";
      };
      var ul = mk("ul");
      list.forEach(function (unit, u) {
        var li = mk("li");
        li.appendChild(mk("b", cls(u), placed(unit) || tMake(unit, clue) || "?"));
        li.appendChild(document.createTextNode(" "));
        var parts = tSay(unit, clue);
        for (var c = unit, a = up.get(c); a; c = a, a = up.get(a)) {
          if (a.op !== "ins") continue;
          var by = (a.ind || []).map(function (sp) { return { ind: tText(clue, sp) }; });
          if (c === a.out) parts = parts.concat([", around " + placed(a.in)], by.length ? [" ("].concat(by, [")"]) : []);
          else if (c === a.in) parts = parts.concat([", inside " + placed(a.out)], by.length ? [" ("].concat(by, [")"]) : []);
          break;
        }
        tPut(li, parts);
        ul.appendChild(li);
      });
      box.appendChild(tiles); box.appendChild(ul);
      (function groups(n) {
        if (n.op === "rev" && (n.of.op === "cat" || n.of.op === "ins")) {
          var by = (n.ind || []).map(function (sp) { return { ind: tText(clue, sp) }; });
          var kids = tKids(n.of).map(function (k) { return tMake(k, clue) || placed(k).split("").reverse().join(""); });
          note("Reversed together: ", [kids.join(n.of.op === "ins" ? " around " : " + ")].concat(by.length ? [", by "].concat(by) : [], [", read backwards."]));
        }
        tKids(n).forEach(groups);
      })(p.t);
    }
    var a = ans.length === letters.length ? ans.toUpperCase() : "the answer";
    if (p.kind === "dd" && p.def && p.def.length > 1) {
      var e = mk("p", "dd"); e.appendChild(mk("b", null, "Double definition: "));
      e.appendChild(mk("u", "mdef d0", tText(clue, p.def[0]))); e.appendChild(document.createTextNode(" and "));
      e.appendChild(mk("u", "mdef d1", tText(clue, p.def[1])));
      box.appendChild(e);
    }
    if (p.kind === "cd") note("Cryptic definition: ", ["the whole clue."]);
    if (p.kind === "&lit") note("&lit: ", ["the whole clue is the definition, and its words are also the wordplay."]);
    if (p.pal) note("Palindrome: ", [a === "the answer" ? "reads the same backwards." : a + " reads the same backwards."]);
  }
  // The clue's type, from the operations its tree uses.
  function tTypes(p, clue) {
    var has = {};
    (function walk(n) {
      var name = { ins: "Container", rev: "Reversal", anag: "Anagram", cut: "Deletion", snd: "Homophone", spn: "Spoonerism", chg: "Letter change" }[n.op];
      if (n.op === "pick") name = /^hidden/.test(tPickName(n, clue)) ? "Hidden" : "Letter selection";
      if (n.op === "cat") name = "Charade";
      if (name) has[name] = 1;
      tKids(n).forEach(walk);
    })(p.t || { op: "lit" });
    if (p.kind) has[{ dd: "Double definition", cd: "Cryptic definition", "&lit": "&lit" }[p.kind]] = 1;
    if (p.pal) has.Palindrome = 1;
    return ["Anagram", "Hidden", "Letter selection", "Deletion", "Container", "Reversal", "Homophone", "Spoonerism", "Letter change", "Charade",
      "Double definition", "Cryptic definition", "&lit", "Palindrome"].filter(function (x) { return has[x]; }).join(", ");
  }
