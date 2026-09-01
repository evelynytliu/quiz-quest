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

  // idle -> dispensing (knob turns, capsule drops) -> ready (tap to open) -> idle
  let phase = 'idle';
  let prize = null;        // the sticker inside the current capsule
  let resetTimer = null;

  const el = {
    coins: document.getElementById('prize-coins'),
    machine: document.getElementById('gacha-machine'),
    balls: document.getElementById('gacha-balls'),
    knob: document.getElementById('gacha-knob'),
    drop: document.getElementById('gacha-drop'),
    capsule: document.getElementById('gacha-capsule'),
    capSticker: document.getElementById('cap-sticker'),
    price: document.getElementById('gacha-price'),
    name: document.getElementById('egg-name'),
    rarity: document.getElementById('egg-rarity'),
    hint: document.getElementById('egg-hint'),
    count: document.getElementById('sticker-count'),
    grid: document.getElementById('sticker-grid')
  };

  // a domeful of colourful capsule balls, laid out once
  const BALL_COLORS = ['#ec5f49', '#4f88d6', '#f3c64c', '#3aa86a', '#9a6bd0', '#f08cae'];
  function fillDome() {
    if (!el.balls || el.balls.childElementCount) return;
    for (let i = 0; i < 14; i++) {
      const b = document.createElement('span');
      b.className = 'gacha-ball';
      const c1 = BALL_COLORS[i % BALL_COLORS.length];
      b.style.background = `linear-gradient(160deg, ${c1} 50%, #fffdf8 50%)`;
      b.style.setProperty('--jig', (Math.random() * 0.6 + 0.7).toFixed(2) + 's');
      b.style.left = (4 + (i % 5) * 19 + Math.random() * 4) + '%';
      b.style.bottom = (2 + Math.floor(i / 5) * 26 + Math.random() * 8) + '%';
      el.balls.appendChild(b);
    }
  }

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
      ? 'Turn the knob to get a capsule! 轉轉看！'
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

  function resetMachine() {
    clearTimeout(resetTimer);
    phase = 'idle';
    prize = null;
    el.machine.classList.remove('shaking', 'deny');
    el.knob.classList.remove('turning');
    el.drop.classList.add('hidden');
    el.drop.classList.remove('falling');
    el.capsule.classList.add('hidden');
    el.capsule.classList.remove('landed', 'open', 'r2', 'r3');
    el.capSticker.textContent = '';
  }

  // step 1: turn the knob — a capsule rattles down the chute
  function turnKnob() {
    if (phase !== 'idle') return;
    if (Store.getCoins() < EGG_COST) {
      el.machine.classList.remove('deny'); void el.machine.offsetWidth; el.machine.classList.add('deny');
      Sfx.wrong();
      renderHint();
      return;
    }
    phase = 'dispensing';
    el.name.textContent = '';
    el.rarity.textContent = '';
    el.rarity.className = 'egg-rarity';
    Store.addCoins(-EGG_COST);
    renderCoins();
    el.hint.textContent = '🌀 Rrrrr… here it comes!';

    prize = pick();
    el.knob.classList.add('turning');
    el.machine.classList.add('shaking');
    Sfx.beep(); setTimeout(() => Sfx.beep(), 300); setTimeout(() => Sfx.beep(), 600);

    // the capsule appears in the chute and drops
    setTimeout(() => {
      el.drop.className = 'gacha-drop r' + prize.r;
      el.drop.classList.add('falling');
      Sfx.pop();
    }, 750);

    // then rolls out as a big capsule, ready to open
    setTimeout(() => {
      el.knob.classList.remove('turning');
      el.machine.classList.remove('shaking');
      el.drop.classList.add('hidden');
      el.capsule.className = 'gacha-capsule landed r' + prize.r;
      el.capSticker.textContent = '';
      el.hint.textContent = '👆 Tap the capsule to open it!';
      Sfx.coin();
      phase = 'ready';
    }, 1500);
  }

  // step 2: tap the capsule — it cracks open and the sticker pops out
  function openCapsule() {
    if (phase !== 'ready' || !prize) return;
    phase = 'open';
    const s = prize;
    const isNew = Store.addSticker(s.e) === 1;
    if (!isNew) Store.addCoins(DUP_REFUND);
    el.capSticker.textContent = s.e;
    el.capsule.classList.add('open');
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
    // admire the sticker, then the machine is ready again
    resetTimer = setTimeout(resetMachine, 2300);
  }

  function refresh() {
    resetMachine();
    fillDome();
    el.name.textContent = '';
    el.rarity.textContent = '';
    renderCoins(); renderGrid(); renderHint();
  }

  function init() {
    fillDome();
    el.knob.addEventListener('click', () => { Sfx.resume(); turnKnob(); });
    el.machine.addEventListener('click', (e) => {
      if (e.target === el.knob || el.knob.contains(e.target)) return;
      Sfx.resume(); turnKnob();
    });
    el.capsule.addEventListener('click', () => { Sfx.resume(); openCapsule(); });
  }

  return { init, refresh, EGG_COST };
})();
