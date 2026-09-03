/* Shared scaffolding for the mini-games (Builder, Whack-a-Char, Bingo…).
   They all live on one screen — a header with the home button, a title and
   the coin pill — and draw themselves into #mini-stage. Mini keeps track of
   which game is running so leaving the screen can stop its timers. */
window.Mini = (function () {
  const el = {
    title: document.getElementById('mini-title'),
    coins: document.getElementById('mini-coins'),
    stage: document.getElementById('mini-stage')
  };
  let current = null;      // the running game module ({ stop })
  let timers = [];         // timeouts owned by the running game

  function open(mod, title) {
    stop();
    Sfx.resume();
    Game.stop();
    current = mod;
    el.title.textContent = title;
    el.stage.innerHTML = '';
    el.stage.className = 'mini-stage';
    renderCoins();
    showScreen('mini');
    return el.stage;
  }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    if (current && typeof current.stop === 'function') { try { current.stop(); } catch (e) {} }
    current = null;
    Sfx.stopSpeak();
  }

  // a timeout that dies with the game
  function later(fn, ms) {
    const t = setTimeout(() => { timers = timers.filter(x => x !== t); fn(); }, ms);
    timers.push(t);
    return t;
  }

  function renderCoins() { el.coins.textContent = Store.getCoins(); }

  // hand the round to the shared results screen
  function finish(opts) {
    stop();
    Results.show(opts);
  }

  function h(tag, cls, html) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  // n random items, no repeats
  function sample(arr, n) { return Store.shuffle(arr.slice()).slice(0, n); }

  // a small progress pill "3 / 8" and a big "Next" button, shared look
  function progress(i, n) { return '<div class="mini-progress">' + i + ' / ' + n + '</div>'; }

  return { open, stop, later, finish, h, sample, progress, renderCoins, stage: () => el.stage };
})();
