/* Prize Machine: coins earned in quizzes crack open surprise eggs full of
   stickers. Collected stickers fill the sticker book; tap one to make it your
   quiz buddy (it cheers you on during games). Per-player, stored via Store. */
window.Prizes = (function () {
  const EGG_COST = 10;
  const DUP_REFUND = 5;

  // r: 1 common · 2 rare · 3 super rare
  const CATALOG = [
    /* ----- common ----- */
    { e: '🐶', n: 'Puppy', r: 1 },
    { e: '🐱', n: 'Kitten', r: 1 },
    { e: '🐰', n: 'Bunny', r: 1 },
    { e: '🐹', n: 'Hamster', r: 1 },
    { e: '🐸', n: 'Frog', r: 1 },
    { e: '🐢', n: 'Turtle', r: 1 },
    { e: '🐝', n: 'Busy Bee', r: 1 },
    { e: '🦋', n: 'Butterfly', r: 1 },
    { e: '🐞', n: 'Ladybug', r: 1 },
    { e: '🐠', n: 'Rainbow Fish', r: 1 },
    { e: '🦆', n: 'Ducky', r: 1 },
    { e: '🐷', n: 'Piggy', r: 1 },
    { e: '🐮', n: 'Moo Cow', r: 1 },
    { e: '🐵', n: 'Cheeky Monkey', r: 1 },
    { e: '🍎', n: 'Shiny Apple', r: 1 },
    { e: '🍪', n: 'Cookie', r: 1 },
    { e: '🧁', n: 'Cupcake', r: 1 },
    { e: '🍩', n: 'Donut', r: 1 },
    { e: '⚽', n: 'Soccer Ball', r: 1 },
    { e: '🏀', n: 'Basketball', r: 1 },
    { e: '🚗', n: 'Race Car', r: 1 },
    { e: '🚂', n: 'Choo-Choo Train', r: 1 },
    { e: '⛵', n: 'Sailboat', r: 1 },
    { e: '🎈', n: 'Balloon', r: 1 },
    /* ----- rare ----- */
    { e: '🦊', n: 'Clever Fox', r: 2 },
    { e: '🐼', n: 'Panda', r: 2 },
    { e: '🐨', n: 'Koala', r: 2 },
    { e: '🦁', n: 'Lion King', r: 2 },
    { e: '🐙', n: 'Octopus', r: 2 },
    { e: '🦉', n: 'Wise Owl', r: 2 },
    { e: '🐧', n: 'Penguin', r: 2 },
    { e: '🦖', n: 'T-Rex', r: 2 },
    { e: '🦕', n: 'Long-Neck Dino', r: 2 },
    { e: '🚀', n: 'Rocket Ship', r: 2 },
    { e: '🛸', n: 'Flying Saucer', r: 2 },
    { e: '🌈', n: 'Rainbow', r: 2 },
    /* ----- super rare ----- */
    { e: '🦄', n: 'Unicorn', r: 3 },
    { e: '🐉', n: 'Dragon', r: 3 },
    { e: '🧜‍♀️', n: 'Mermaid', r: 3 },
    { e: '🧚', n: 'Fairy', r: 3 },
    { e: '🤖', n: 'Super Robot', r: 3 },
    { e: '👑', n: 'Golden Crown', r: 3 },
    { e: '💎', n: 'Diamond', r: 3 },
    { e: '🏆', n: 'Gold Trophy', r: 3 }
  ];
  const WEIGHT = { 1: 6, 2: 3, 3: 2 };   // generous odds — it's for a 6-year-old
  const RARITY = { 1: '⭐ Common', 2: '⭐⭐ Rare', 3: '⭐⭐⭐ Super Rare' };

  let opening = false;
  let resetTimer = null;

  const el = {
    coins: document.getElementById('prize-coins'),
    egg: document.getElementById('egg-btn'),
    name: document.getElementById('egg-name'),
    rarity: document.getElementById('egg-rarity'),
    hint: document.getElementById('egg-hint'),
    count: document.getElementById('sticker-count'),
    grid: document.getElementById('sticker-grid')
  };

  function pick() {
    let total = 0;
    CATALOG.forEach(s => { total += WEIGHT[s.r]; });
    let roll = Math.random() * total;
    for (const s of CATALOG) {
      roll -= WEIGHT[s.r];
      if (roll < 0) return s;
    }
    return CATALOG[0];
  }

  function renderCoins() { el.coins.textContent = Store.getCoins(); }

  function renderHint() {
    el.hint.textContent = Store.getCoins() >= EGG_COST
      ? 'Tap the egg to crack it open!'
      : 'You need 💰' + EGG_COST + ' — play a quiz to earn more coins!';
  }

  function renderGrid() {
    const owned = Store.getStickers();
    const buddy = Store.getBuddy();
    el.count.textContent = Object.keys(owned).length + ' / ' + CATALOG.length;
    el.grid.innerHTML = '';
    CATALOG.forEach(s => {
      const have = owned[s.e] || 0;
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'sticker' + (have ? ' owned' : ' locked')
        + (s.r === 2 ? ' rare' : s.r === 3 ? ' epic' : '')
        + (have && buddy === s.e ? ' buddy' : '');
      d.textContent = have ? s.e : '❓';
      d.title = have ? s.n : '???';
      if (have > 1) {
        const c = document.createElement('span');
        c.className = 'st-count'; c.textContent = 'x' + have;
        d.appendChild(c);
      }
      if (have && buddy === s.e) {
        const t = document.createElement('span');
        t.className = 'st-buddy-tag'; t.textContent = 'BUDDY';
        d.appendChild(t);
      }
      if (have) d.addEventListener('click', () => {
        Sfx.pop();
        const cur = Store.getBuddy();
        Store.setBuddy(cur === s.e ? '' : s.e);   // tap again to unset
        if (Store.getBuddy()) Sfx.speak(s.n + ' is your buddy now!');
        renderGrid();
      });
      el.grid.appendChild(d);
    });
  }

  function resetEgg() {
    clearTimeout(resetTimer);
    el.egg.classList.remove('wobble', 'reveal', 'deny');
    el.egg.textContent = '🥚';
    opening = false;
  }

  function openEgg() {
    if (opening) return;
    if (Store.getCoins() < EGG_COST) {
      el.egg.classList.remove('deny'); void el.egg.offsetWidth; el.egg.classList.add('deny');
      Sfx.wrong();
      renderHint();
      return;
    }
    opening = true;
    el.name.textContent = '';
    el.rarity.textContent = '';
    Store.addCoins(-EGG_COST);
    renderCoins(); renderHint();
    el.egg.classList.remove('deny', 'reveal');
    el.egg.classList.add('wobble');
    Sfx.beep(); setTimeout(() => Sfx.beep(), 320); setTimeout(() => Sfx.beep(), 640);

    setTimeout(() => {
      const s = pick();
      const isNew = Store.addSticker(s.e) === 1;
      if (!isNew) Store.addCoins(DUP_REFUND);
      el.egg.classList.remove('wobble');
      el.egg.classList.add('reveal');
      el.egg.textContent = s.e;
      el.name.textContent = isNew ? '✨ New! ' + s.n : s.n + ' again! +💰' + DUP_REFUND + ' back';
      el.rarity.textContent = RARITY[s.r];
      el.rarity.className = 'egg-rarity r' + s.r;
      Sfx.coin();
      if (s.r === 3) {
        Sfx.fanfare();
        Confetti.rain(110);
        Confetti.emojiBurst(['✨', '🌟'], 18);
      } else {
        Confetti.burst(s.r === 2 ? 70 : 45, window.innerHeight * 0.32);
      }
      Sfx.speak(isNew ? 'Wow! You got a ' + s.n + '!' : 'Another ' + s.n + '!');
      renderCoins(); renderGrid(); renderHint();
      // give the reveal a moment, then the egg is ready again
      resetTimer = setTimeout(resetEgg, 1900);
    }, 1100);
  }

  function refresh() {
    resetEgg();
    el.name.textContent = '';
    el.rarity.textContent = '';
    renderCoins(); renderGrid(); renderHint();
  }

  function init() {
    el.egg.addEventListener('click', () => { Sfx.resume(); openEgg(); });
  }

  return { init, refresh, EGG_COST };
})();
