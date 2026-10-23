  function showSettings() {
    var bt = new Date(BUILT);
    $("appVer").textContent = isNaN(bt) ? "" : fmtDate(bt, { day: "numeric", month: "short", year: "numeric" }) + ", " + fmtDate(bt, { hour: "2-digit", minute: "2-digit" });
    var pf = prefs(), start = pf.start || "last", m = pf.mode || "easy";
    $("setName").value = pf.name || "";
    // Chips: the saved choice, else the first.
    Array.prototype.forEach.call(document.querySelectorAll("#setSheet .chips[data-p]"), function (box) {
      var p = box.dataset.p, v = pf[p] || box.firstElementChild && box.firstElementChild.dataset.v;
      Array.prototype.forEach.call(box.children, function (b) { b.classList.toggle("on", b.dataset.v === v); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("#setSheet .tog input[data-p]"), function (x) { x.checked = !!pf[x.dataset.p]; });
    $("setNWhen").hidden = !pf.listN;
    $("setModeRow").hidden = start !== "fixed"; $("setMode").dataset.mode = m;
    Array.prototype.forEach.call($("setMode").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === m)); });
    // The example is the top puzzle of the list, as it stands.
    var ex = $("homeList").querySelector(".hitem"); $("listPrev").innerHTML = ""; if (ex) $("listPrev").appendChild(ex.cloneNode(true));
    $("setSheet").hidden = false; keyNote();
  }
  $("title").addEventListener("click", function () { this.parentNode.classList.toggle("full"); size(); });
  $("setBtn").addEventListener("click", showSettings); $("setBtn2").addEventListener("click", showSettings);
  $("setName").addEventListener("change", function () { setPref("name", this.value.trim()); });
  $("setSheet").addEventListener("change", function (e) {
    if (e.target.dataset.p) { setPref(e.target.dataset.p, e.target.checked); applyPrefs(); if (e.target.dataset.p === "listN") showSettings(); } });
  $("setSheet").addEventListener("click", function (e) {
    var b = e.target.closest(".chips[data-p] .chip"); if (!b) return;
    var p = b.parentNode.dataset.p, v = b.dataset.v;
    // Fixing a mode starts from the last one chosen overall.
    if (v === "fixed" && !prefs().mode) setPref("mode", (store.get("crossword:mode") || {}).m || "easy");
    setPref(p, v);
    applyPrefs(); showSettings();
  });
  // The update key, kept in the owner's private Firestore record (never shown again once saved).
  function keyRef() { return DB.collection("users/" + FBUSER.uid + "/private").doc("github"); }
  function sure(b, ask) {
    if (b.classList.contains("sure")) return true;
    var was = b.textContent; b.classList.add("sure"); b.textContent = ask;
    setTimeout(function () { b.classList.remove("sure"); b.textContent = was; }, 3000);
    return false;
  }
  function keyNote() {
    if (!FBUSER) return;
    keyRef().get().then(function (d) { keyShow(d.exists && !!d.data().token); });
  }
  function keyShow(saved) { $("keyOk").hidden = !saved; $("keyIn").hidden = saved; $("keyUndo").hidden = true; }
  // Replace opens the box with Undo beside Save, which goes back to the saved key untouched.
  $("keyRep").addEventListener("click", function () { keyShow(false); $("keyUndo").hidden = false; $("setKey").focus(); });
  $("keyUndo").addEventListener("click", function () { $("setKey").value = ""; keyShow(true); });
  $("syncNow").addEventListener("click", function () { cloudFlush(); syncOk(); toast("Synced"); });
  $("keySave").addEventListener("click", function () {
    var k = $("setKey").value.trim();
    if (!k || !FBUSER) return toast("Paste the key first");
    keyRef().set({ token: k }).then(function () { $("setKey").value = ""; toast("Update key saved"); keyNote(); }, function (e) { toast("Couldn\u2019t save the key: " + ((e && e.code) || "error")); });
  });
  // Clue size and font, the timer and the home list follow Settings.
  var FONTS = { arial: "Arial, Helvetica, sans-serif", times: "\"Times New Roman\", Times, serif", georgia: "Georgia, serif" }, SIZES = { l: 1.15, xl: 1.3 },
    TINTS = { green: "#d6eedb", amber: "#f8e6c4", pink: "#f6d9e4", grey: "#e6eaee", none: "transparent" };
  function applyPrefs() {
    var pf = prefs(), st = document.documentElement.style;
    st.setProperty("--cz", SIZES[pf.size] || 1); st.setProperty("--f-clue", FONTS[pf.font] || "var(--f-ui)");
    st.setProperty("--hz", SIZES[pf.listSize] || 1); document.documentElement.classList.toggle("bigl", !!SIZES[pf.listSize]);
    st.setProperty("--nowbg", TINTS[pf.tint] || "var(--word)");
    document.documentElement.classList.toggle("notimer", !!pf.noTimer);
    document.documentElement.classList.toggle("notint", pf.tint === "none");
    document.documentElement.classList.toggle("nohints", !!pf.hideHints);
    if (P && $("home").hidden) { render(); size(); }  // Settings opened from a puzzle
    if (BOOTED && !$("home").hidden) showHome(true);
  }
  $("setMode").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { setPref("mode", b.dataset.mode); showSettings(); } });
  $("setDone").addEventListener("click", function () { $("setSheet").hidden = true; });
  $("setSheet").addEventListener("click", function (e) { if (e.target === this) this.hidden = true; });
  // Stats from the puzzle records: totals, then by paper and type, then by the mode each finish was recorded at.
  // Times count clean solves (not DNFs); hints and reveals are per finished puzzle. A submitted grid not yet graded
  // is checked against any answers that have arrived since, and counts as a solve while none are known.
  var SOPEN = {};  // crossword cards open in Stats: 1 the latest solves, 2 all of them
