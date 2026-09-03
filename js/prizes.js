/* Prize Machine: coins earned in quizzes crack open surprise capsules full
   of stickers. There is one machine per sticker series — finish a series
   and the next machine arrives. Rarer stickers glow harder, any pull can
   turn out ✨ shiny, duplicates pile up into golden tickets, and the golden
   machine only ever gives rare stickers. Per-player, stored via Store. */
window.Prizes = (function () {
  const EGG_COST = 10;               // the classic machine (home screen wiggle)
  const SHINY_ODDS = 1 / 20;

  // r: 1 common · 2 rare · 3 super rare · 4 legendary
  const SERIES = [
    { id: 1, name: 'Classic 經典', emoji: '🎁', cost: 10, theme: 'classic', stickers: [
      { e: '🐶', n: 'Puppy', r: 1 }, { e: '🐱', n: 'Kitten', r: 1 }, { e: '🐰', n: 'Bunny', r: 1 },
      { e: '🐹', n: 'Hamster', r: 1 }, { e: '🐸', n: 'Frog', r: 1 }, { e: '🐢', n: 'Turtle', r: 1 },
      { e: '🐝', n: 'Busy Bee', r: 1 }, { e: '🦋', n: 'Butterfly', r: 1 }, { e: '🐞', n: 'Ladybug', r: 1 },
      { e: '🐠', n: 'Rainbow Fish', r: 1 }, { e: '🦆', n: 'Ducky', r: 1 }, { e: '🐷', n: 'Piggy', r: 1 },
      { e: '🐮', n: 'Moo Cow', r: 1 }, { e: '🐵', n: 'Cheeky Monkey', r: 1 }, { e: '🍎', n: 'Shiny Apple', r: 1 },
      { e: '🍪', n: 'Cookie', r: 1 }, { e: '🧁', n: 'Cupcake', r: 1 }, { e: '🍩', n: 'Donut', r: 1 },
      { e: '⚽', n: 'Soccer Ball', r: 1 }, { e: '🏀', n: 'Basketball', r: 1 }, { e: '🚗', n: 'Race Car', r: 1 },
      { e: '🚂', n: 'Choo-Choo Train', r: 1 }, { e: '⛵', n: 'Sailboat', r: 1 }, { e: '🎈', n: 'Balloon', r: 1 },
      { e: '🦊', n: 'Clever Fox', r: 2 }, { e: '🐼', n: 'Panda', r: 2 }, { e: '🐨', n: 'Koala', r: 2 },
      { e: '🦁', n: 'Lion King', r: 2 }, { e: '🐙', n: 'Octopus', r: 2 }, { e: '🦉', n: 'Wise Owl', r: 2 },
      { e: '🐧', n: 'Penguin', r: 2 }, { e: '🦖', n: 'T-Rex', r: 2 }, { e: '🦕', n: 'Long-Neck Dino', r: 2 },
      { e: '🚀', n: 'Rocket Ship', r: 2 }, { e: '🛸', n: 'Flying Saucer', r: 2 }, { e: '🌈', n: 'Rainbow', r: 2 },
      { e: '🦄', n: 'Unicorn', r: 3 }, { e: '🐉', n: 'Dragon', r: 3 }, { e: '🧜‍♀️', n: 'Mermaid', r: 3 },
      { e: '🧚', n: 'Fairy', r: 3 }, { e: '🤖', n: 'Super Robot', r: 3 }, { e: '👑', n: 'Golden Crown', r: 3 },
      { e: '💎', n: 'Diamond', r: 3 }, { e: '🏆', n: 'Gold Trophy', r: 3 }
    ] },
    { id: 2, name: 'Ocean 海洋', emoji: '🐬', cost: 20, theme: 'ocean', stickers: [
      { e: '🦀', n: 'Crab', r: 1 }, { e: '🐚', n: 'Seashell', r: 1 }, { e: '🐡', n: 'Puffer Fish', r: 1 },
      { e: '🦐', n: 'Shrimp', r: 1 }, { e: '🐟', n: 'Little Fish', r: 1 }, { e: '🦑', n: 'Squid', r: 1 },
      { e: '🌊', n: 'Big Wave', r: 1 }, { e: '🏖️', n: 'Sandy Beach', r: 1 }, { e: '🏝️', n: 'Palm Island', r: 1 },
      { e: '⚓', n: 'Anchor', r: 1 }, { e: '🛶', n: 'Canoe', r: 1 }, { e: '🚤', n: 'Speedboat', r: 1 },
      { e: '🎣', n: 'Fishing Rod', r: 1 }, { e: '🐊', n: 'Crocodile', r: 1 },
      { e: '🐬', n: 'Dolphin', r: 2 }, { e: '🐳', n: 'Spouting Whale', r: 2 }, { e: '🦈', n: 'Shark', r: 2 },
      { e: '🦞', n: 'Lobster', r: 2 }, { e: '🧭', n: 'Compass', r: 2 }, { e: '🚢', n: 'Cruise Ship', r: 2 },
      { e: '🏴‍☠️', n: 'Pirate Flag', r: 3 }, { e: '🌅', n: 'Ocean Sunrise', r: 3 }, { e: '🐋', n: 'Blue Whale', r: 3 },
      { e: '🔱', n: 'Golden Trident', r: 4 }, { e: '🧜‍♂️', n: 'Merman King', r: 4 }
    ] },
    { id: 3, name: 'Space 太空', emoji: '🪐', cost: 20, theme: 'space', stickers: [
      { e: '🪐', n: 'Ringed Planet', r: 1 }, { e: '🌙', n: 'Crescent Moon', r: 1 }, { e: '⭐', n: 'Little Star', r: 1 },
      { e: '🌟', n: 'Glowing Star', r: 1 }, { e: '☄️', n: 'Comet', r: 1 }, { e: '🌍', n: 'Earth', r: 1 },
      { e: '🌕', n: 'Full Moon', r: 1 }, { e: '🔭', n: 'Telescope', r: 1 }, { e: '🛰️', n: 'Satellite', r: 1 },
      { e: '🌠', n: 'Shooting Star', r: 1 }, { e: '🌌', n: 'Milky Way', r: 1 }, { e: '✈️', n: 'Jet Plane', r: 1 },
      { e: '🎇', n: 'Sparkler', r: 1 }, { e: '🌞', n: 'Smiling Sun', r: 1 },
      { e: '👩‍🚀', n: 'Astronaut', r: 2 }, { e: '👨‍🚀', n: 'Space Captain', r: 2 }, { e: '👽', n: 'Friendly Alien', r: 2 },
      { e: '🌛', n: 'Sleepy Moon', r: 2 }, { e: '🛩️', n: 'Little Plane', r: 2 }, { e: '🎆', n: 'Fireworks', r: 2 },
      { e: '🌚', n: 'Moon Face', r: 2 },
      { e: '🌏', n: 'Blue Planet', r: 3 }, { e: '🎑', n: 'Moon Festival', r: 3 }, { e: '💫', n: 'Dizzy Star', r: 3 },
      { e: '☀️', n: 'Golden Sun', r: 4 }, { e: '👾', n: 'Space Invader', r: 4 }
    ] },
    { id: 4, name: 'Magic 魔法', emoji: '🔮', cost: 30, theme: 'magic', stickers: [
      { e: '🏰', n: 'Castle', r: 1 }, { e: '🔮', n: 'Crystal Ball', r: 1 }, { e: '🎩', n: 'Magic Hat', r: 1 },
      { e: '🍄', n: 'Magic Mushroom', r: 1 }, { e: '🌹', n: 'Rose', r: 1 }, { e: '🕯️', n: 'Candle', r: 1 },
      { e: '📜', n: 'Old Scroll', r: 1 }, { e: '🗝️', n: 'Old Key', r: 1 }, { e: '🧸', n: 'Teddy Bear', r: 1 },
      { e: '🎠', n: 'Carousel', r: 1 }, { e: '🎪', n: 'Circus Tent', r: 1 }, { e: '🧩', n: 'Puzzle Piece', r: 1 },
      { e: '🎭', n: 'Theatre Masks', r: 1 }, { e: '🎁', n: 'Gift Box', r: 1 },
      { e: '🧙', n: 'Wizard', r: 2 }, { e: '🧝', n: 'Elf', r: 2 }, { e: '🧞', n: 'Genie', r: 2 },
      { e: '🦸', n: 'Superhero', r: 2 }, { e: '🐲', n: 'Baby Dragon', r: 2 }, { e: '🦢', n: 'Swan', r: 2 },
      { e: '🦚', n: 'Peacock', r: 2 },
      { e: '👸', n: 'Princess', r: 3 }, { e: '🤴', n: 'Prince', r: 3 }, { e: '🧙‍♀️', n: 'Sorceress', r: 3 },
      { e: '🗡️', n: 'Magic Sword', r: 4 }, { e: '🛡️', n: 'Hero Shield', r: 4 }
    ] },
    { id: 5, name: 'Wild World 世界動物', emoji: '🦒', cost: 30, theme: 'wild', stickers: [
      { e: '🦒', n: 'Giraffe', r: 1 }, { e: '🦓', n: 'Zebra', r: 1 }, { e: '🦘', n: 'Kangaroo', r: 1 },
      { e: '🐘', n: 'Elephant', r: 1 }, { e: '🦛', n: 'Hippo', r: 1 }, { e: '🦏', n: 'Rhino', r: 1 },
      { e: '🐪', n: 'Camel', r: 1 }, { e: '🦙', n: 'Llama', r: 1 }, { e: '🐿️', n: 'Squirrel', r: 1 },
      { e: '🦔', n: 'Hedgehog', r: 1 }, { e: '🦇', n: 'Bat', r: 1 }, { e: '🐺', n: 'Wolf', r: 1 },
      { e: '🐻', n: 'Bear', r: 1 }, { e: '🐗', n: 'Boar', r: 1 },
      { e: '🦥', n: 'Sloth', r: 2 }, { e: '🦦', n: 'Otter', r: 2 }, { e: '🦩', n: 'Flamingo', r: 2 },
      { e: '🦃', n: 'Turkey', r: 2 }, { e: '🦡', n: 'Badger', r: 2 }, { e: '🐆', n: 'Leopard', r: 2 },
      { e: '🐅', n: 'Tiger', r: 2 },
      { e: '🦍', n: 'Gorilla', r: 3 }, { e: '🦧', n: 'Orangutan', r: 3 }, { e: '🦅', n: 'Eagle', r: 3 },
      { e: '🐯', n: 'Golden Tiger', r: 4 }, { e: '🦜', n: 'Rainbow Parrot', r: 4 }
    ] }
  ];
  // the golden machine: every unlocked series, rare and up, legendary odds doubled
  const GOLD = { id: 'gold', name: 'Golden 黃金', emoji: '🏆', cost: 50, theme: 'gold' };

  const WEIGHT = { 1: 10, 2: 5, 3: 3, 4: 3 };        // ≈ 3% legendary per pull
  const GOLD_WEIGHT = { 2: 4, 3: 3, 4: 3 };
  const RARITY = { 1: '⭐ Common', 2: '⭐⭐ Rare', 3: '⭐⭐⭐ Super Rare', 4: '🌈 LEGENDARY 傳說' };

  // idle -> dispensing (knob turns, capsule drops) -> ready (tap to open) -> idle
  let phase = 'idle';
  let prize = null;        // { sticker, shiny, paidWithTicket }
  let resetTimer = null;
  let machine = SERIES[0]; // the machine on display

  const el = {
    coins: document.getElementById('prize-coins'),
    tickets: document.getElementById('prize-tickets'),
    ticketPill: document.getElementById('ticket-pill'),
    tabs: document.getElementById('machine-tabs'),
    title: document.getElementById('machine-title'),
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
    book: document.getElementById('sticker-book'),
    dupeCount: document.getElementById('dupe-count')
  };

  /* ---------- which series are open ---------- */
  function seriesComplete(s) {
    const owned = Store.getStickers();
    return s.stickers.every(x => owned[x.e]);
  }
  // a series opens once the one before it is complete
  function seriesOpen(s) {
    const i = SERIES.indexOf(s);
    return i <= 0 || seriesComplete(SERIES[i - 1]);
  }
  function openSeries() { return SERIES.filter(seriesOpen); }
  function allStickers() { return [].concat.apply([], SERIES.map(s => s.stickers)); }
  function findSticker(e) { return allStickers().find(s => s.e === e); }

  function pool() {
    if (machine === GOLD) return [].concat.apply([], openSeries().map(s => s.stickers)).filter(s => s.r >= 2);
    return machine.stickers;
  }
  function pick() {
    const list = pool();
    const w = machine === GOLD ? GOLD_WEIGHT : WEIGHT;
    let total = 0;
    list.forEach(s => { total += w[s.r] || 0; });
    let roll = Math.random() * total;
    for (const s of list) {
      roll -= w[s.r] || 0;
      if (roll < 0) return s;
    }
    return list[0];
  }

  /* ---------- rendering ---------- */
  const BALL_COLORS = {
    classic: ['#ec5f49', '#4f88d6', '#f3c64c', '#3aa86a', '#9a6bd0', '#f08cae'],
    ocean: ['#4f88d6', '#74c5c0', '#2f9bd6', '#7fd3f2', '#3aa86a', '#fffdf8'],
    space: ['#8a7fda', '#4f5bd6', '#f3c64c', '#2c2f6b', '#f08cae', '#74c5c0'],
    magic: ['#9a6bd0', '#f3a0bb', '#e6b03f', '#8a7fda', '#ec5f49', '#f3c64c'],
    wild: ['#e8850c', '#3aa86a', '#c98a4b', '#f3c64c', '#8b5a2b', '#a6d36b'],
    gold: ['#f5c045', '#ffe08a', '#e6b03f', '#fff3cf', '#f0b429', '#ffd166']
  };
  function fillDome() {
    if (!el.balls) return;
    el.balls.innerHTML = '';
    const colors = BALL_COLORS[machine.theme] || BALL_COLORS.classic;
    for (let i = 0; i < 14; i++) {
      const b = document.createElement('span');
      b.className = 'gacha-ball';
      const c1 = colors[i % colors.length];
      b.style.background = `linear-gradient(160deg, ${c1} 50%, #fffdf8 50%)`;
      b.style.setProperty('--jig', (Math.random() * 0.6 + 0.7).toFixed(2) + 's');
      b.style.left = (4 + (i % 5) * 19 + Math.random() * 4) + '%';
      b.style.bottom = (2 + Math.floor(i / 5) * 26 + Math.random() * 8) + '%';
      el.balls.appendChild(b);
    }
  }

  function renderCoins() {
    el.coins.textContent = Store.getCoins();
    const t = Store.getTickets();
    el.tickets.textContent = t;
    el.ticketPill.classList.toggle('has', t > 0);
    if (el.dupeCount) el.dupeCount.textContent = Store.getDupes();
  }

  function machineCost() {
    if (machine === GOLD && Store.getTickets() > 0) return 0;   // a ticket pays
    return machine.cost;
  }
  function renderHint() {
    const cost = machineCost();
    if (machine === GOLD && cost === 0) el.hint.textContent = '🎟️ You have a golden ticket — turn the knob for a free rare capsule!';
    else el.hint.textContent = Store.getCoins() >= cost
      ? 'Turn the knob to get a capsule! 轉轉看！'
      : 'You need 💰' + cost + ' — play a game to earn more coins!';
  }

  function renderTabs() {
    el.tabs.innerHTML = '';
    SERIES.concat([GOLD]).forEach(s => {
      const open = s === GOLD || seriesOpen(s);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'machine-tab theme-' + s.theme + (s === machine ? ' active' : '') + (open ? '' : ' locked');
      const done = s !== GOLD && seriesComplete(s);
      b.innerHTML = '<span class="mt-emoji">' + (open ? s.emoji : '🔒') + '</span>'
        + '<span class="mt-name">' + s.name + '</span>'
        + '<span class="mt-cost">' + (open ? (s === GOLD ? '💰50 / 🎟️' : '💰' + s.cost) + (done ? ' ✅' : '') : 'finish ' + SERIES[SERIES.indexOf(s) - 1].emoji + ' first') + '</span>';
      b.addEventListener('click', () => {
        Sfx.tap();
        if (!open) {
          const prev = SERIES[SERIES.indexOf(s) - 1];
          el.hint.textContent = '🔒 Collect every ' + prev.name + ' sticker to open the ' + s.name + ' machine! 收齊上一彈才會開';
          Sfx.speak('Collect all the ' + prev.name.replace(/[^\x00-\x7f]+/g, '').trim() + ' stickers first!');
          return;
        }
        if (phase !== 'idle') return;
        machine = s;
        refresh();
      });
      el.tabs.appendChild(b);
    });
  }

  function renderMachine() {
    el.machine.className = 'gacha-machine theme-' + machine.theme;
    el.title.textContent = machine.emoji + ' ' + machine.name + (machine === GOLD ? ' — rare and up only! 只出稀有以上' : ' Series');
    el.price.textContent = machine === GOLD ? (Store.getTickets() > 0 ? '🎟️ 1' : '50') : String(machine.cost);
    fillDome();
  }

  function renderBook() {
    const owned = Store.getStickers();
    const shiny = Store.getShiny();
    const buddy = Store.getBuddy();
    let have = 0, total = 0;
    el.book.innerHTML = '';
    SERIES.forEach((s, si) => {
      const open = seriesOpen(s);
      const got = s.stickers.filter(x => owned[x.e]).length;
      if (open) { have += got; total += s.stickers.length; }
      const sec = document.createElement('section');
      sec.className = 'book-series theme-' + s.theme + (open ? '' : ' locked');
      const head = document.createElement('div');
      head.className = 'book-head';
      head.innerHTML = '<span class="bh-emoji">' + s.emoji + '</span><span class="bh-name">Series ' + s.id + ' · ' + s.name + '</span>'
        + '<span class="bh-prog">' + (open ? (got === s.stickers.length ? '🏅 Complete!' : got + ' / ' + s.stickers.length) : '🔒 finish Series ' + (s.id - 1)) + '</span>';
      sec.appendChild(head);
      const grid = document.createElement('div');
      grid.className = 'sticker-grid';
      s.stickers.forEach(x => {
        const n = open ? (owned[x.e] || 0) : 0;
        const sh = open ? (shiny[x.e] || 0) : 0;
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'sticker' + (n ? ' owned' : ' locked')
          + (x.r === 2 ? ' rare' : x.r === 3 ? ' epic' : x.r === 4 ? ' legend' : '')
          + (sh ? ' shiny' : '') + (n && buddy === x.e ? ' buddy' : '');
        d.textContent = n ? x.e : '❓';
        d.title = n ? (sh ? 'Shiny ' : '') + x.n : '???';
        if (n > 1) {
          const c = document.createElement('span');
          c.className = 'st-count'; c.textContent = 'x' + n;
          d.appendChild(c);
        }
        if (sh) {
          const c = document.createElement('span');
          c.className = 'st-shiny'; c.textContent = '✨';
          d.appendChild(c);
        }
        if (n && buddy === x.e) {
          const t = document.createElement('span');
          t.className = 'st-buddy-tag'; t.textContent = 'BUDDY';
          d.appendChild(t);
        }
        if (n) d.addEventListener('click', () => {
          Sfx.pop();
          const cur = Store.getBuddy();
          Store.setBuddy(cur === x.e ? '' : x.e);   // tap again to unset
          if (Store.getBuddy()) Sfx.speak(x.n + ' is your buddy now!');
          renderBook();
        });
        grid.appendChild(d);
      });
      sec.appendChild(grid);
      el.book.appendChild(sec);
    });
    el.count.textContent = have + ' / ' + total;
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
    el.capsule.classList.remove('landed', 'open', 'r2', 'r3', 'r4', 'shiny');
    el.capSticker.textContent = '';
  }

  // step 1: turn the knob — a capsule rattles down the chute
  function turnKnob() {
    if (phase !== 'idle') return;
    const cost = machineCost();
    if (Store.getCoins() < cost) {
      el.machine.classList.remove('deny'); void el.machine.offsetWidth; el.machine.classList.add('deny');
      Sfx.wrong();
      renderHint();
      return;
    }
    phase = 'dispensing';
    el.name.textContent = '';
    el.rarity.textContent = '';
    el.rarity.className = 'egg-rarity';
    let ticket = false;
    if (cost === 0) ticket = Store.useTicket();
    else Store.addCoins(-cost);
    renderCoins();
    el.hint.textContent = '🌀 Rrrrr… here it comes!';

    const sticker = pick();
    prize = { sticker, shiny: Math.random() < SHINY_ODDS, ticket };
    el.knob.classList.add('turning');
    el.machine.classList.add('shaking');
    Sfx.beep(); setTimeout(() => Sfx.beep(), 300); setTimeout(() => Sfx.beep(), 600);

    // the capsule appears in the chute and drops
    setTimeout(() => {
      el.drop.className = 'gacha-drop r' + sticker.r;
      el.drop.classList.add('falling');
      Sfx.pop();
    }, 750);

    // then rolls out as a big capsule, ready to open
    setTimeout(() => {
      el.knob.classList.remove('turning');
      el.machine.classList.remove('shaking');
      el.drop.classList.add('hidden');
      el.capsule.className = 'gacha-capsule landed r' + sticker.r + (prize.shiny ? ' shiny' : '');
      el.capSticker.textContent = '';
      el.hint.textContent = sticker.r === 4 ? '🌈 Something is glowing in there… tap it!'
        : '👆 Tap the capsule to open it!';
      Sfx.coin();
      if (sticker.r === 4) Sfx.fanfare();
      phase = 'ready';
    }, 1500);
  }

  // step 2: tap the capsule — it cracks open and the sticker pops out
  function openCapsule() {
    if (phase !== 'ready' || !prize) return;
    phase = 'open';
    const s = prize.sticker;
    const isNew = Store.addSticker(s.e) === 1;
    let newShiny = false;
    if (prize.shiny) newShiny = Store.addShiny(s.e) === 1;
    // a duplicate that isn't a new shiny goes into the ticket pile
    let ticketMade = false;
    if (!isNew && !newShiny) ticketMade = Store.addDupe();
    const wasComplete = seriesComplete(machine === GOLD ? SERIES[0] : machine);
    el.capSticker.textContent = s.e;
    el.capsule.classList.add('open');
    const shinyTag = prize.shiny ? '✨ Shiny ' : '';
    el.name.textContent = isNew ? '✨ New! ' + shinyTag + s.n
      : newShiny ? '✨ Shiny ' + s.n + '! 閃亮版！'
      : s.n + ' again! ' + (ticketMade ? '🎟️ Golden ticket made! 換到兌換券！' : '+1 towards a 🎟️');
    el.rarity.textContent = RARITY[s.r];
    el.rarity.className = 'egg-rarity r' + s.r;
    Sfx.coin();
    if (s.r === 4) {
      Sfx.fanfare(); setTimeout(() => Sfx.fanfare(), 500);
      Confetti.rain(160); setTimeout(() => Confetti.rain(120), 700);
      Confetti.emojiBurst(['🌈', '✨', '🌟', '💫'], 28);
    } else if (s.r === 3) {
      Sfx.fanfare();
      Confetti.rain(110);
      Confetti.emojiBurst(['✨', '🌟'], 18);
    } else {
      Confetti.burst(s.r === 2 ? 70 : 45, window.innerHeight * 0.32);
    }
    if (prize.shiny) { setTimeout(() => Sfx.coin(), 250); Confetti.emojiBurst(['✨'], 14); }
    if (ticketMade) { setTimeout(() => { Sfx.coin(); Confetti.emojiBurst(['🎟️'], 8); }, 500); }
    const said = s.r === 4 ? 'Legendary! You got the ' + s.n + '!'
      : isNew ? 'Wow! You got a ' + (prize.shiny ? 'shiny ' : '') + s.n + '!'
      : newShiny ? 'Ooh, a shiny ' + s.n + '!'
      : 'Another ' + s.n + '!' + (ticketMade ? ' You made a golden ticket!' : '');
    Sfx.speak(said);
    renderCoins(); renderBook(); renderHint();
    // a completed series opens the next machine
    const cur = machine === GOLD ? null : machine;
    if (cur && !wasComplete && seriesComplete(cur)) {
      const next = SERIES[SERIES.indexOf(cur) + 1];
      setTimeout(() => {
        Sfx.fanfare(); Confetti.rain(150); Confetti.emojiBurst(['🏅', '🎉'], 20);
        el.hint.textContent = '🏅 Series complete! ' + (next ? 'The ' + next.name + ' machine has arrived! 新扭蛋機來了！' : 'You collected EVERYTHING! 全部收齊了！');
        Sfx.speak('Series complete! ' + (next ? 'A new machine has arrived!' : 'You collected everything!'));
        renderTabs();
      }, 2200);
      resetTimer = setTimeout(resetMachine, 5200);
      return;
    }
    // admire the sticker, then the machine is ready again
    resetTimer = setTimeout(resetMachine, 2300);
  }

  function refresh() {
    resetMachine();
    const seeded = Store.seedTickets();
    if (machine !== GOLD && !seriesOpen(machine)) machine = SERIES[0];
    renderTabs();
    renderMachine();
    el.name.textContent = '';
    el.rarity.textContent = '';
    renderCoins(); renderBook(); renderHint();
    if (seeded) {
      el.hint.textContent = '🎟️ Your old duplicates made ' + seeded + ' golden ticket' + (seeded > 1 ? 's' : '') + '! Try the Golden machine!';
      Sfx.coin();
    }
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

  return { init, refresh, EGG_COST, SERIES, findSticker };
})();
