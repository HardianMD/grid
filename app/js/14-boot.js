  function boot() {
    var lastId = store.get("crossword:last");
    var start = PUZZLES.filter(function (p) { return p.id === lastId; })[0] || PUZZLES[PUZZLES.length - 1];
    return full(start).then(function (p) { load(p); applyPrefs(); showHome(); });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
  fbInit();
