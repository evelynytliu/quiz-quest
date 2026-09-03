/* App glue: screen routing, home grid, game launching, the shared level
   picker, parent gate. Loaded last. */
(function () {
  const ROUND_SIZE = 10;
  let gateAnswer = 0;
  let gateThen = null;          // what to do once a grown-up has answered
  const lastLevel = {};          // remembered per game for "Play again"

  const screens = {
    home: 'screen-home',
    countdown: 'screen-countdown',
    quiz: 'screen-quiz',
    results: 'screen-results',
    prizes: 'screen-prizes',
    write: 'screen-write',
    mini: 'screen-mini',
    parent: 'screen-parent'
  };

  window.showScreen = function (name) {
    Object.values(screens).forEach(id => document.getElementById(id).classList.remove('active'));
    const id = screens[name] || name;
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
  };

  // one line under each game's name on the home screen
  const SUBS = {
    'zh-quest': '👂 listen & tap', 'zh-words': '👂 two-character words', 'zh-sentences': '😜 funny sentences',
    'zh-write': '✍️ trace & learn', 'zh-build': '🧩 snap pieces together', 'zh-whack': '🔨 bop the right one',
    'zh-twins': '👀 spot the difference', 'zh-match': '🃏 flip & match', 'zh-bingo': '🎱 3 in a row',
    'zh-order': '🧱 put words in order', 'zh-morph': '🏺 pictures become words', 'zh-flash': '⚡ look, then write',
    'zh-hunt': '🔍 find the hidden ones', 'zh-count': '🔢 how many?', 'zh-opposites': '↔️ big ↔ small',
    'zh-garden': '🌱 water your words'
  };

  /* ---------- home ---------- */
  function renderHome() {
    const cur = Store.getCurrentPlayer();
    const buddy = Store.getBuddy();
    const tagline = document.querySelector('.tagline');
    if (tagline) tagline.textContent = cur
      ? `Hi, ${cur}! ${buddy || '👋'}  Pick a game and beat your best`
      : 'Pick a game and beat your high score';

    const coins = Store.getCoins();
    document.getElementById('home-coins').textContent = coins;
    // wiggle the prize button when there's an egg waiting to be opened
    document.getElementById('open-prizes').classList.toggle('ready', coins >= Prizes.EGG_COST);

    // today's quests + play streak
    const rows = document.getElementById('quest-rows');
    rows.innerHTML = '';
    Store.getQuests().forEach(q => {
      const row = document.createElement('div');
      row.className = 'quest-row' + (q.done ? ' done' : '');
      row.innerHTML = `<span class="q-icon">${q.icon}</span>
        <span class="q-label">${q.label}</span>
        <span class="q-prog">${q.done ? '✅ +💰' + q.reward : q.prog + ' / ' + q.goal}</span>`;
      rows.appendChild(row);
    });
    const streak = Store.getPlayStreak();
    document.getElementById('quest-streak').textContent = streak >= 2 ? ` · 🔥 ${streak} days` : '';

    // two labeled shelves — Chinese games and English games look different
    // so a pre-reader can tell them apart at a glance
    const grids = {
      zh: document.getElementById('pack-grid-zh'),
      en: document.getElementById('pack-grid-en')
    };
    grids.zh.innerHTML = ''; grids.en.innerHTML = '';
    const thirsty = Store.dueChars().length;
    const plants = Object.keys(Store.getCharStats()).length;

    // keys: shown while there are still games to open
    const keys = Store.getKeys();
    const lockedLeft = Store.lockedGames().length;
    const keyCard = document.getElementById('key-card');
    keyCard.classList.toggle('hidden', !lockedLeft);
    document.getElementById('home-keys').textContent = keys;
    const left = Store.keysLeftToday();
    document.getElementById('key-msg').textContent = keys
      ? '👆 Tap a locked game to open it! 點鎖住的遊戲就能打開'
      : left > 0
        ? 'Get ⭐⭐ in any game to earn a key 任何遊戲拿兩顆星就有鑰匙 (' + left + ' more today)'
        : 'No more keys today — come back tomorrow! 今天的鑰匙拿完了，明天再來';

    Store.getPacks().forEach(p => {
      const count = Store.countFor(p.id);
      if (!p.generated && count === 0) return; // hide empty custom packs
      const lang = p.lang === 'zh' ? 'zh' : 'en';
      const card = document.createElement('button');
      card.className = 'pack-card ' + (p.color || 'a1') + (lang === 'zh' ? ' zh-card' : '');
      let sub = SUBS[p.id] || (p.generated ? '∞ endless' : count + ' question' + (count === 1 ? '' : 's'));
      if (p.id === 'zh-garden') sub = plants ? `🌱 ${plants} plants` + (thirsty ? ` · 💧 ${thirsty} thirsty` : '') : sub;
      const best = Store.getBest(p.id);
      card.innerHTML = `<span class="p-emoji">${p.emoji}</span>
        <span class="p-name">${escapeHtml(p.name)}</span>
        <span class="p-count">${sub}${best ? ' · 🏅' + best : ''}</span>`;
      if (p.id === 'zh-garden' && thirsty) card.classList.add('thirsty');
      if (Store.isLocked(p.id)) {
        card.classList.add('locked');
        if (keys > 0) card.classList.add('unlockable');
        card.querySelector('.p-count').textContent = keys > 0 ? '🔑 tap to unlock 點我解鎖' : '🔒 needs a key 要一把鑰匙';
        const lock = document.createElement('span');
        lock.className = 'p-lock'; lock.textContent = keys > 0 ? '🔓' : '🔒';
        card.appendChild(lock);
        card.addEventListener('click', () => { Sfx.resume(); tryUnlock(p, card); });
      } else {
        card.addEventListener('click', () => { Sfx.resume(); Sfx.tap(); launchPack(p.id); });
      }
      grids[lang].appendChild(card);
    });
  }

  /* ---------- unlocking ----------
     With a key: the padlock pops, the card lights up and the game opens.
     Without one: a little teaser of what's inside, and how to earn a key. */
  let unlocking = false;
  function tryUnlock(pack, card) {
    if (unlocking) return;
    const g = GAMES[pack.id] || {};
    if (Store.getKeys() <= 0) {
      Sfx.tap();
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      const left = Store.keysLeftToday();
      document.getElementById('key-msg').textContent = '🔒 ' + pack.name + ' — ' + (g.desc || '')
        + (left > 0 ? ' Get ⭐⭐ in any game for a key!' : ' No more keys today, try tomorrow!');
      Sfx.speak(pack.name.replace(/[^\x00-\x7f]+/g, '').trim() + '. ' + (g.desc || '')
        + (left > 0 ? ' Get two stars in any game to earn a key!' : ' Come back tomorrow for more keys!'));
      return;
    }
    if (!Store.unlockGame(pack.id)) return;
    unlocking = true;
    card.classList.add('unlocking');
    card.querySelector('.p-lock').textContent = '🔓';
    card.querySelector('.p-count').textContent = '✨ Unlocked! 解鎖了！';
    Sfx.fanfare(); Sfx.coin();
    Confetti.burst(80, card.getBoundingClientRect().top + 60);
    Confetti.emojiBurst(['🔑', '✨', '🌟'], 16);
    Sfx.speak('Unlocked! ' + pack.name.replace(/[^\x00-\x7f]+/g, '').trim() + '!');
    setTimeout(() => { unlocking = false; renderHome(); launchPack(pack.id); }, 1500);
  }

  /* ---------- launching ----------
     Every generated game is described here: how to ask for a level and
     how to start it. Quiz-engine games build a question list; mini-games
     open their own module. */
  const LEVELS = {
    quest: [['🐣 First Words', '14 easy words 入門字'], ['🦊 More Words', '40 words 更多字'], ['🐉 Word Master', 'all the words 全部的字']],
    words: [['🐣 First Words', '15 easy words 入門詞'], ['🦊 More Words', '35 words 更多詞'], ['🐉 Word Master', 'all 59 words 全部的詞']],
    sents: [['🐣 First Sentences', '22 easy ones 入門句'], ['🦊 More Sentences', '53 sentences 更多句'], ['🐉 Sentence Master', 'all 80 句子大師']],
    math: [['🐣 Easy', 'small numbers'], ['🦊 Medium', '3-digit, no carrying'], ['🐉 Challenge', 'carrying & borrowing']],
    build: [['🐣 Two Pieces', '日＋月＝明 簡單的字'], ['🦊 More Pieces', 'trickier characters 更多字'], ['🐉 Three Pieces', '木木木＝森 三塊拼一起']],
    whack: [['🐣 Slow Moles', 'easy words, slow 慢慢來'], ['🦊 Quick Moles', 'more words, faster 快一點'], ['🐉 Speedy Moles', 'all words, fast! 超快']],
    twins: [['🐣 Easy Twins', '4 tiles, big differences 明顯的'], ['🦊 Tricky Twins', '4 tiles, look closely 仔細看'], ['🐉 Eagle Eyes', '6 tiles, tiny differences 超像的']],
    match: [['🐣 6 Pairs', 'characters & pictures 字配圖'], ['🦊 8 Pairs', 'more characters 更多字'], ['🐉 10 Pairs', 'two-character words 詞語配圖']],
    bingo: [['🐣 3 × 3', 'hear it, see a picture 有圖提示'], ['🦊 4 × 4', 'bigger board 更大的板'], ['🐉 4 × 4 by ear', 'no picture hints 只用耳朵聽']],
    order: [['🐣 3 Blocks', 'short sentences 短短的句子'], ['🦊 3–4 Blocks', 'longer ones 長一點'], ['🐉 4–5 Blocks', 'the silliest sentences 最長的']],
    flash: [['🐣 Simple Shapes', '1–3 strokes 筆畫少'], ['🦊 Medium Shapes', '4–6 strokes 中等'], ['🐉 Tricky Shapes', '7+ strokes 筆畫多']],
    hunt: [['🐣 Small Crowd', '20 characters 少少的'], ['🦊 Big Crowd', '30 characters 多一點'], ['🐉 Twins Hiding', 'look-alikes mixed in 混進雙胞胎']],
    count: [['🐣 Up to 3', '一、兩、三 數到三'], ['🦊 Up to 5', 'more things 數到五'], ['🐉 Up to 9', 'lots of things 數到九']],
    opposites: [['🐣 First Pairs', '大小 上下 冷熱 入門'], ['🦊 More Pairs', '左右 快慢 男女 更多'], ['🐉 All Pairs', 'every opposite 全部的']]
  };
  const quiz = gen => level => { Game.stop(); Game.start(gen.id, gen.make(level, ROUND_SIZE)); };
  const GAMES = {
    'math-machine': { levels: LEVELS.math, desc: 'How tricky do you want it?', start: level => { Game.stop(); Game.start('math-machine', Store.generateMath(level, ROUND_SIZE)); } },
    'zh-quest':     { levels: LEVELS.quest, desc: 'Listen, look, and tap — no reading needed!', start: quiz({ id: 'zh-quest', make: Store.generateZh }) },
    'zh-words':     { levels: LEVELS.words, desc: 'Listen, look, and tap — no reading needed!', start: quiz({ id: 'zh-words', make: Store.generateZhWords }) },
    'zh-sentences': { levels: LEVELS.sents, desc: 'Funny little sentences — listen, giggle, and tap!', start: quiz({ id: 'zh-sentences', make: Store.generateZhSentences }) },
    'zh-twins':     { levels: LEVELS.twins, desc: 'Three are the same, one is different. Find it!', start: quiz({ id: 'zh-twins', make: Store.generateTwins }) },
    'zh-count':     { levels: LEVELS.count, desc: 'Count the things and pick the right words!', start: quiz({ id: 'zh-count', make: Store.generateCount }) },
    'zh-opposites': { levels: LEVELS.opposites, desc: 'Hear a word, tap its opposite!', start: quiz({ id: 'zh-opposites', make: Store.generateOpposites }) },
    'zh-build':     { levels: LEVELS.build, desc: 'Snap pieces together to build a character!', start: level => Builder.open(level) },
    'zh-whack':     { levels: LEVELS.whack, desc: 'Hear a word, bop the mole holding it!', start: level => Whack.open(level) },
    'zh-match':     { levels: LEVELS.match, desc: 'Flip cards to match characters with pictures!', start: level => Match.open(level) },
    'zh-bingo':     { levels: LEVELS.bingo, desc: 'Hear a word, stamp it. Three in a row wins!', start: level => Bingo.open(level) },
    'zh-order':     { levels: LEVELS.order, desc: 'Put the word blocks in order to build the sentence!', start: level => Order.open(level) },
    'zh-flash':     { levels: LEVELS.flash, desc: 'Look carefully, then write it from memory!', start: level => Flash.open(level) },
    'zh-hunt':      { levels: LEVELS.hunt, desc: 'Characters are hiding in the crowd. Find them all!', start: level => Hunt.open(level) },
    'zh-morph':     { start: () => Morph.open() },
    'zh-write':     { start: () => Writer.open() },
    'zh-garden':    { start: () => Garden.open() }
  };

  function launchPack(packId) {
    const pack = Store.getPack(packId);
    if (!pack || Store.isLocked(packId)) return;
    if (pack.generated) {
      const g = GAMES[packId];
      if (!g) return;
      if (g.levels) openLevels(pack, g);
      else g.start();
      return;
    }
    let qs = Store.questionsFor(packId).slice();
    if (!qs.length) return;
    qs = Store.shuffle(qs).slice(0, ROUND_SIZE).map(Store.shuffleOptions);
    Game.stop();
    Game.start(packId, qs);
  }

  // the "Play again" button: same game, same level
  function replay() {
    const custom = Results.replay();
    if (custom) { custom(); return; }
    const pid = Results.currentPack();
    const pack = Store.getPack(pid);
    const g = GAMES[pid];
    if (pack && pack.generated && g) g.start(lastLevel[pid] || 1);
    else launchPack(pid);
  }

  /* ---------- level picker (one modal, every game) ---------- */
  function openLevels(pack, g) {
    document.getElementById('level-title').textContent = pack.emoji + ' ' + pack.name;
    document.getElementById('level-desc').textContent = g.desc || 'Pick a level';
    const box = document.getElementById('level-buttons');
    box.innerHTML = '';
    g.levels.forEach((lv, i) => {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.dataset.level = i + 1;
      btn.innerHTML = escapeHtml(lv[0]) + '<br><small>' + escapeHtml(lv[1]) + '</small>';
      btn.addEventListener('click', () => {
        Sfx.tap();
        lastLevel[pack.id] = i + 1;
        closeModal('level-modal');
        g.start(i + 1);
      });
      box.appendChild(btn);
    });
    document.getElementById('level-modal').classList.remove('hidden');
  }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => closeModal(b.dataset.close));
  });

  /* ---------- parent gate ---------- */
  // other screens (e.g. setting a child's name) can ask for the same check
  window.askParent = function (then) { openGate(then); };

  function openGate(then) {
    gateThen = typeof then === 'function' ? then : null;
    const a = 6 + Math.floor(Math.random() * 4);   // 6..9
    const b = 6 + Math.floor(Math.random() * 4);
    gateAnswer = a * b;
    document.getElementById('gate-question').textContent = `${a} × ${b} = ?`;
    document.getElementById('gate-answer').value = '';
    document.getElementById('gate-error').classList.add('hidden');
    document.getElementById('gate-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('gate-answer').focus(), 50);
  }

  document.getElementById('open-parent').addEventListener('click', () => openGate(null));
  document.getElementById('gate-submit').addEventListener('click', checkGate);
  document.getElementById('gate-answer').addEventListener('keydown', e => { if (e.key === 'Enter') checkGate(); });

  /* ---------- parent weekly report ---------- */
  function renderReport() {
    const body = document.getElementById('report-body');
    if (!body) return;
    const players = Store.getPlayers();
    const names = players.length ? players : [''];
    body.innerHTML = '';
    names.forEach(name => {
      const acts = Store.getActivityFor(name, 7);
      const rounds = acts.filter(a => a.kind === 'round');
      const writes = acts.filter(a => a.kind === 'write');
      const zhRounds = rounds.filter(r => { const p = Store.getPack(r.packId); return p && p.lang === 'zh'; });
      const grown = Object.keys(Store.getCharStats()).length;
      const ok = rounds.reduce((s, r) => s + (r.ok || 0), 0);
      const total = rounds.reduce((s, r) => s + (r.total || 0), 0);
      const days = new Set(acts.map(a => a.d)).size;
      const chars = {};
      writes.forEach(w => { chars[w.ch] = (chars[w.ch] || 0) + 1; });
      const charList = Object.keys(chars).join('、');

      const div = document.createElement('div');
      div.className = 'report-player';
      const title = name ? `👦 ${escapeHtml(name)}` : '👦 (未命名玩家)';
      div.innerHTML = !acts.length
        ? `<h4>${title}</h4><p class="report-empty">這週還沒有遊玩紀錄</p>`
        : `<h4>${title} <span class="muted">玩了 ${days} 天</span></h4>
          <ul class="report-list">
            <li>🎮 完成 ${rounds.length} 回合（中文 ${zhRounds.length} 回合）</li>
            <li>✅ 答對率 ${total ? Math.round(ok / total * 100) + '%（' + ok + ' / ' + total + ' 題）' : '—'}</li>
            <li>✍️ 寫了 ${writes.length} 次字${charList ? '：<span class="report-chars">' + charList + '</span>' : ''}</li>
            <li>🌱 花園裡有 ${grown} 個字</li>
          </ul>`;
      body.appendChild(div);
    });
  }

  /* ---------- parent: unlock switches ---------- */
  function renderUnlockStatus() {
    const el = document.getElementById('unlock-status');
    if (!el) return;
    const locked = Store.lockedGames().length;
    el.textContent = (Store.getCurrentPlayer() || '（未命名玩家）') + '：還有 ' + locked + ' 個遊戲鎖住，手上有 ' + Store.getKeys() + ' 把鑰匙';
  }
  document.getElementById('unlock-all').addEventListener('click', () => {
    Store.unlockAll(); renderUnlockStatus();
  });
  document.getElementById('lock-all').addEventListener('click', () => {
    if (confirm('把全部小遊戲重新鎖上，鑰匙歸零？')) { Store.lockAll(); renderUnlockStatus(); }
  });

  function checkGate() {
    const val = parseInt(document.getElementById('gate-answer').value, 10);
    if (val === gateAnswer) {
      closeModal('gate-modal');
      if (gateThen) { const fn = gateThen; gateThen = null; fn(); return; }
      Editor.refresh();
      renderReport();
      renderUnlockStatus();
      showScreen('parent');
    } else {
      document.getElementById('gate-error').classList.remove('hidden');
      document.getElementById('gate-answer').value = '';
    }
  }

  document.getElementById('parent-exit').addEventListener('click', () => {
    renderHome();
    showScreen('home');
  });

  // 🏠 exit-to-home buttons shown during the countdown and quiz
  function goHome() { Sfx.tap(); Game.stop(); Mini.stop(); renderHome(); showScreen('home'); }
  document.querySelectorAll('.exit-home').forEach(b => b.addEventListener('click', goHome));

  /* ---------- results buttons ---------- */
  document.getElementById('play-again').addEventListener('click', () => { Sfx.tap(); replay(); });
  document.getElementById('back-home').addEventListener('click', () => {
    Sfx.tap(); Game.stop(); Mini.stop(); renderHome(); showScreen('home');
  });

  /* ---------- prize machine ---------- */
  function openPrizes() {
    Sfx.resume(); Sfx.tap();
    Game.stop(); Mini.stop();
    Prizes.refresh();
    showScreen('prizes');
  }
  document.getElementById('open-prizes').addEventListener('click', openPrizes);
  document.getElementById('go-prizes').addEventListener('click', openPrizes);

  /* ---------- players ---------- */
  function renderPlayers() {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    const players = Store.getPlayers();
    const current = Store.getCurrentPlayer();
    if (!players.length) {
      const hint = document.createElement('span');
      hint.className = 'player-hint';
      hint.textContent = 'Add your name →';
      list.appendChild(hint);
    }
    players.forEach(name => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'player-chip' + (name === current ? ' active' : '');
      const nm = document.createElement('span'); nm.className = 'pc-name'; nm.textContent = name;
      const x = document.createElement('span'); x.className = 'pc-x'; x.textContent = '✕'; x.title = 'Remove';
      chip.appendChild(nm); chip.appendChild(x);
      chip.addEventListener('click', () => { Sfx.tap(); Store.setCurrentPlayer(name); renderPlayers(); renderHome(); });
      x.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`移除玩家「${name}」和他的最高分紀錄？`)) { Store.removePlayer(name); renderPlayers(); renderHome(); }
      });
      list.appendChild(chip);
    });
  }

  document.getElementById('add-player').addEventListener('click', () => {
    Sfx.tap();
    const name = (prompt('小朋友的名字：') || '').trim();
    if (!name) return;
    Store.addPlayer(name);
    renderPlayers(); renderHome();
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- boot ---------- */
  Store.load();
  Editor.init();
  Prizes.init();
  Writer.init();
  renderPlayers();
  renderHome();
  showScreen('home');
  // unlock audio on first interaction (browser autoplay policy)
  document.addEventListener('click', () => Sfx.resume(), { once: true });
})();
