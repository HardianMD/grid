  var PUZZLES = [];  // filled from Firestore once signed in
  var $ = function (id) { return document.getElementById(id); };
  // A new element, with its class and text when given.
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls != null) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  $("setBtn2").innerHTML = $("setBtn").innerHTML;  // the Settings cog, drawn once in the page
  // Progress lives in browser storage and, once signed in with Google, in Firestore, so it survives the
  // browser clearing its storage and follows the user between devices.
  var MEM = {}, PEEK = {};
  var store = {
    get: function (k) {
      try { var v = localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch (e) {}
      return Object.prototype.hasOwnProperty.call(MEM, k) ? MEM[k] : null;
    },
    // For reading only (never changed in place): parsed again only when the stored text changes.
    peek: function (k) {
      var raw = null, c = PEEK[k];
      try { raw = localStorage.getItem(k); } catch (e) {}
      if (raw === null) return store.get(k);
      if (!c || c.raw !== raw) { try { c = PEEK[k] = { raw: raw, v: JSON.parse(raw) }; } catch (e) { return store.get(k); } }
      return c.v;
    },
    local: function (k, v) { MEM[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    set: function (k, v) { store.local(k, v); cloudPut(k, v); }
  };
  var CLOUD = null, cloudQ = {}, cloudT = null, KEEP = ["mode", "favs", "prefs", "notes"];  // KEEP: synced records besides puzzles
  function cloudId(k) {
    var m = /^crossword:(.+)$/.exec(k), id = m && m[1];
    return !id || id === "last" || id === "filter" ? null : KEEP.indexOf(id) >= 0 ? id : "p_" + id;
  }
  function cloudPut(k, v) {
    var id = cloudId(k); if (!id) return;
    cloudQ[id] = v;
    if (CLOUD && !cloudT) cloudT = setTimeout(cloudFlush, 3000);
  }
  function cloudFlush() {
    clearTimeout(cloudT); cloudT = null;
    if (!CLOUD) return;
    var q = cloudQ; cloudQ = {};
    Object.keys(q).forEach(function (id) {
      CLOUD.doc(id).set({ v: JSON.stringify(q[id]), at: (q[id] && q[id].at) || Date.now() }).then(syncOk, function (e) {
        if (!cloudQ[id]) cloudQ[id] = q[id];
        syncErr(e);
      });
    });
  }
  // Dates and times in British style, and text compared as localeCompare does; each formatter is made once, as
  // making one is slow.
  var DF = {}, cmp = new Intl.Collator().compare;
  function fmtDate(d, o) { var k = JSON.stringify(o); return isNaN(d) ? "Invalid Date" : (DF[k] = DF[k] || new Intl.DateTimeFormat("en-GB", o)).format(d); }
  // Sync status, shown in Settings.
  var FBUSER = null;
  function syncOk() {
    if (!FBUSER) return;
    $("syncTxt").textContent = "Synced " + fmtDate(new Date(), { hour: "2-digit", minute: "2-digit" });
  }
  function syncErr(e) {
    if (!FBUSER) return;
    var m = "Sync failed: " + ((e && (e.code || e.message)) || "error");
    $("syncTxt").textContent = m; toast(m);
  }
  // Listen to the Firestore collection's docs ({v: JSON, at}) and merge each change with this device by `at`, so
  // progress made on another device shows up here at once. Only records changed since the last sync (less a day,
  // for other devices' clocks) are read. Once the server has answered, this device's newer records are sent up.
  // Metadata changes are asked for so the server's answer arrives even when it matches the cache (nothing new).
  function cloudListen(col) {
    var since = (store.get("crossword:synced") || 0) - 864e5, first = true;
    (since > 0 ? col.where("at", ">", since) : col).onSnapshot({ includeMetadataChanges: true }, function (snap) {
      var cur = false, any = false;
      snap.docChanges().forEach(function (c) {
        if (c.type === "removed") return;
        var d = c.doc, x = d.data(), val;
        if (!x || typeof x.v !== "string") return;
        try { val = JSON.parse(x.v); } catch (e) { return; }
        var k = KEEP.indexOf(d.id) >= 0 ? "crossword:" + d.id : d.id.indexOf("p_") === 0 ? "crossword:" + d.id.slice(2) : null;
        if (!k || !val) return;
        var loc = store.get(k), la = (loc && loc.at) || 0, ra = val.at || x.at || 0;
        // Newer wins, except that a grid with letters beats an empty one and a finished grid beats both.
        var lr = loc && rank(loc), rr = rank(val);
        if (!loc || rr > lr || (rr === lr && ra > la)) {
          store.local(k, val); any = true; delete cloudQ[d.id];
          if (P && k === "crossword:" + P.id) cur = true;
        } else if (lr > rr || la > ra) cloudQ[d.id] = loc;
      });
      CLOUD = col;
      if (!snap.metadata.fromCache) {
        if (first) {
          var seen = {}; snap.docs.forEach(function (d) { seen[d.id] = 1; });
          PUZZLES.map(function (p) { return "p_" + p.id; }).concat(KEEP).forEach(function (id) {
            var k = "crossword:" + id.replace(/^p_/, "");
            if (!seen[id]) { var loc = store.get(k); if (loc && typeof loc === "object" && (loc.at || 0) > since) cloudQ[id] = loc; }
          });
          first = false;
        }
        store.local("crossword:synced", Date.now());
        syncOk();
      }
      if (Object.keys(cloudQ).length && !cloudT) cloudT = setTimeout(cloudFlush, 1500);
      if (cur) { load(P); size(); }  // also when the puzzle only sits behind the home list, so a later save keeps the synced letters
      if (any) applyPrefs();
      if (any && P) render();
      if (any && !$("home").hidden) showHome(true);
    }, syncErr);
  }
