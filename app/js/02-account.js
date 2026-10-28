  function rank(v) { return v.solved ? 2 : blank(v) ? 0 : 1; }
  // Favourite clues, newest first: [{p: puzzle id, k: clue key, at}], synced as one record.
  function favs() { return (store.peek("crossword:favs") || {}).list || []; }
  function isFav(list, pid, k) { return list.some(function (f) { return f.p === pid && f.k === k; }); }
  $("favBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    var w = curWord(), k = w.dir + w.num, list = favs().filter(function (f) { return f.p !== P.id || f.k !== k; });
    if (list.length === favs().length) list.unshift({ p: P.id, k: k, at: Date.now() });
    store.set("crossword:favs", { list: list, at: Date.now() });
    render();
  });
  // Google sign-in; progress syncs to Firestore users/<uid>/state/<id>.
  var FIREBASE = /*FIREBASE_CONFIG*/{apiKey:"AIzaSyD99dXGScwcwSgOzSks-ARSFvBMwhHWt9g",authDomain:"crossword-d83c8.firebaseapp.com",projectId:"crossword-d83c8",storageBucket:"crossword-d83c8.firebasestorage.app",messagingSenderId:"371185083441",appId:"1:371185083441:web:1c6f143c851ebd2bb16110"}, FBV = "10.12.2";
  // The three SDK files download together and run in order (async = false).
  function fbScript(name) {
    return new Promise(function (ok, bad) {
      var s = document.createElement("script"); s.src = "https://www.gstatic.com/firebasejs/" + FBV + "/" + name + "-compat.js";
      s.async = false; s.onload = ok; s.onerror = bad; document.head.appendChild(s);
    });
  }
  // Sign-in is required: the puzzles and the update status are in Firestore, readable only by the owner's Google
  // account. Firestore keeps every puzzle on the device (no size limit, so none is dropped), so the app opens
  // offline once it has loaded, and each opening reads only the puzzles uploaded since the newest one kept (`u`).
  var DB = null, BOOTED = false, STATUS = {}, WAITING = null, PZ = {}, REFUSED = false;
  function gate(msg, btn, act) {
    $("gate").hidden = !msg; $("gateTxt").textContent = msg || "";
    $("gateBtn").hidden = !btn; $("gateBtn").textContent = btn || ""; $("gateBtn").dataset.act = act || "";
  }
  function fbInit() {
    Promise.all(["firebase-app", "firebase-auth", "firebase-firestore"].map(fbScript)).then(function () {
      firebase.initializeApp(FIREBASE);
      DB = firebase.firestore();
      DB.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });
      DB.enablePersistence({ synchronizeTabs: true }).catch(function () {});
      var auth = firebase.auth(), unsub = [];
      $("gateBtn").addEventListener("click", function () {
        var act = this.dataset.act;
        if (act === "out") auth.signOut();
        else if (act === "update") runUpdate();
        else auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) { toast("Sign-in didn’t work: " + (e && e.code || "error")); });
      });
      // Sign out and Remove (the update key) ask for a second tap, shown in red.
      $("syncBtn").addEventListener("click", function () { if (sure(this, "Tap to sign out")) { cloudFlush(); auth.signOut(); } });
      $("updBtn").addEventListener("click", runUpdate);
      auth.onAuthStateChanged(function (u) {
        unsub.forEach(function (f) { f(); }); unsub = [];
        CLOUD = null; FBUSER = u || null;
        if (!u) {
          if (BOOTED) { location.reload(); return; }  // signed out: nothing of the puzzles stays on screen
          gate(REFUSED ? "That Google account can’t open these puzzles, so it was signed out." : "Sign in to open your puzzles.", "Sign in with Google", "in");
          return;
        }
        $("syncTxt").textContent = "Syncing…";
        if (!BOOTED) gate("Loading puzzles…");
        // Each puzzle's head (meta/h_<id>: the puzzle without its clues and notes) is all the lists and Stats read;
        // the whole puzzle is read when it is opened (full).
        var col = DB.collection("meta"), add = function (snap) {
          var top = "";
          snap.forEach(function (d) { var x = d.data(); if (x.u > top) top = x.u; try { var h = JSON.parse(x.j); h.u = x.u; PZ[h.id] = h; } catch (e) {} });
          return top;
        };
        // Progress records first (finished ones are kept only in Firestore's offline copy: shed), from the server when
        // this device has no copy.
        MADECOL = DB.collection("users/" + u.uid + "/made"); unsub.push(MADECOL.onSnapshot(gotMade, function () {}));
        var st = DB.collection("users/" + u.uid + "/state"), mine = st.get({ source: "cache" })
          .then(function (s) { return s.size ? s : st.get(); }, function () { return st.get(); }).then(cloudMemo, function () {});
        Promise.all([col.where("u", ">", "").get({ source: "cache" }).then(add, function () { return ""; }), mine]).then(function (r) {
          var top = r[0];
          if (FBUSER !== u) return;
          unsub.push(col.where("u", ">", top).onSnapshot(function (snap) {
            add(snap);
            gotPuzzles(Object.keys(PZ).map(function (k) { return PZ[k]; }), snap.metadata.fromCache, u);
          }, denied));
        });
        unsub.push(DB.collection("meta").doc("status").onSnapshot(function (d) { STATUS = d.data() || {}; showStatus(); }, function () {}));
      });
    }).catch(function () { gate("Couldn’t reach the sign-in service. Check your connection and reload."); });
  }
  // Only the owner's account can read the puzzles (Firestore rules), so any other account is signed straight back out,
  // and nothing about it is shown.
  function denied(e) {
    if (e && e.code === "permission-denied") { REFUSED = true; firebase.auth().signOut(); return; }
    var m = "Couldn’t load the puzzles: " + ((e && (e.code || e.message)) || "error");
    if (BOOTED) toast(m); else gate(m, "Sign out", "out");
  }
  function gotPuzzles(list, fromCache, u) {
    if (!list.length) {
      if (!BOOTED && !fromCache) gate("No puzzles yet.", "Check for new puzzles", "update");
      return;
    }
    SHARED = list; mergeMade();
    checkSubs();
    if (!BOOTED) {
      BOOTED = true;
      boot().then(function () { gate(null); cloudListen(DB.collection("users/" + u.uid + "/state")); },
        function () { gate("Couldn\u2019t load the puzzles. Check your connection and reload."); });
    } else if (!$("home").hidden) showHome(true);
    else if (P && solved && PZ[P.id] && PZ[P.id].u !== P.u) full(PZ[P.id]).then(function (p) { if (P && P.id === p.id) { load(p); size(); } });  // a finished grid on screen picks up parsings as they arrive
  }
  // A whole puzzle, for its head h: from this device's copy when it is as new as the head, else from the server.
  var FULL = {};
  function full(h) {
    var f = FULL[h.id], ref = DB.collection("puzzles").doc(h.id);
    if (h.made || f && f.u === h.u) return Promise.resolve(h.made ? h : f);  // a created puzzle is whole already
    var got = function (d) { var x = d.exists && d.data(); if (!x || x.u < h.u) throw new Error("not here"); var p = JSON.parse(x.j); p.u = x.u; return FULL[h.id] = p; };
    return ref.get({ source: "cache" }).then(got).catch(function () { return ref.get().then(got); });
  }
  // The update status: problems the last run met, and whether a run is going (the refresh button spins meanwhile).
  function showStatus() {
    var box = $("problems"), list = STATUS.problems || [];
    box.innerHTML = ""; box.hidden = !list.length;
    if (list.length) {
      box.appendChild(mk("b", null, "⚠ The last check hit " + (list.length > 1 ? list.length + " problems" : "a problem")));
      list.forEach(function (x) {
        box.appendChild(mk("div", null, x.text + " (since " + new Date(x.since).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" }) + ")"));
      });
    }
    // Done once the run started for this tap has finished (seen running, or a newer last run, in case this
    // device's clock is off or the start was missed).
    if (WAITING && STATUS.running) WAITING.seen = true;
    if (WAITING && !STATUS.running && (WAITING.seen || (STATUS.last_run && STATUS.last_run > WAITING.at))) { WAITING = null; toast("Puzzles are up to date"); }
    if (WAITING && Date.now() - WAITING.t > 15 * 60000) WAITING = null;
    var running = STATUS.running && Date.now() - Date.parse(STATUS.at || 0) < 15 * 60000;
    $("updBtn").classList.toggle("busy", !!(running || WAITING));
  }
  // "Check for new puzzles": asks GitHub to run the update now, with a key the owner pastes once (kept in their
  // own Firestore record). The new puzzles then arrive through the listener above.
  function runUpdate() {
    if (!FBUSER) return;
    if (WAITING) { toast("Refresh already syncing\u2026"); return; }
    WAITING = { at: new Date().toISOString().slice(0, 19), t: Date.now() }; showStatus();  // at once, so a second tap can't start another run
    var ref = keyRef();
    ref.get().then(function (d) {
      var key = d.exists && d.data().token;
      if (key) return dispatch(key, ref);
      key = (prompt("Paste your GitHub update key (it starts github_pat_). It’s saved to your account, so this is a one-off.") || "").trim();
      if (key) return ref.set({ token: key }).then(function () { return dispatch(key, ref); });
      WAITING = null; showStatus();
    }).catch(function (e) { WAITING = null; showStatus(); toast("Couldn’t start the check: " + ((e && (e.code || e.message)) || "error")); });
  }
  function dispatch(key, ref) {
    var repo = STATUS.repo || "HardianMD/crossword-data";
    return fetch("https://api.github.com/repos/" + repo + "/actions/workflows/update.yml/dispatches", {
      method: "POST", body: JSON.stringify({ ref: "main" }),
      headers: { Authorization: "Bearer " + key, Accept: "application/vnd.github+json" }
    }).then(function (r) {
      if (r.status === 204) { toast("Refreshing data…"); return; }
      WAITING = null; showStatus();
      if (r.status === 401 || r.status === 403 || r.status === 404) {
        ref.delete();
        toast("GitHub didn’t accept the key (" + r.status + "). Tap again to paste a new one.");
      } else toast("GitHub answered " + r.status + ". Try again later.");
    }, function () { WAITING = null; showStatus(); toast("Couldn’t reach GitHub. Try again later."); });
  }

  var myDefs = {}, HARD = false, MED = false, CHAMP = false, SUB = null, MODE = "easy", USED = 0, REV = false, REVW = {}, HN = 0, BLANKS = 0, EDITED = false, SEES = [], P, R, C, cells, words, fill, sel, cellEls, SOL, ok, DEFS, hinted, PARSES, myParses, UNSOLVED, userAns, userSol;
  var elapsed = 0, since = null, solved = false, LG = null, SNAP = null, HEAT = false;

  // Linked groups: p.links ([["a1","a6"], ...], head first), else inferred from "See N" clues.
  // Easy (default): hints, reveals and green-locked answers; Check removes only the wrong letters.
  // Medium: like Easy, but Check never says which letters are right: a wrong word is cleared whole, except green squares.
  // Hard: no hints, reveals or green; Check clears a wrong word whole, keeping only letters of words already checked right.
  // Competition: like Hard with no Check or hints. In both, a full grid finishes only when submitted (SUB), which locks and grades it;
  // in Easy and Medium too while the answers aren't out.
  // A reveal makes a DNF except in Easy (by the mode recorded in USED).
  // The mode belongs to each puzzle (chosen in its menu); the last choice for its series (the id less its number)
  // is the default for puzzles not yet started, unless Settings fixes one mode for every new puzzle (prefs.start).
  // Older records hold only m, the last choice overall.
  // USED is the mode in force when the first letter went in (3: none yet), lowered by any easier mode switched to
  // before the end, so a solve is recorded at the most help it had. Competition ranks 4, as 3 already means none yet.
  var RANK = { easy: 0, medium: 1, hard: 2, champ: 4 }, MODES = ["easy", "medium", "hard", null, "champ"];
  // A mode's name on screen (Competition is stored as "champ").
  function modeName(m) { return m === "champ" ? "Competition" : m.charAt(0).toUpperCase() + m.slice(1); }
