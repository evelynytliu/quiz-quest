/* App glue: screen routing, home grid, pack launching, math-level picker,
   parent gate. Loaded last. */
(function () {
  const ROUND_SIZE = 10;
  let pendingMathLevel = null;
  let pendingZhLevel = null;
  let pendingZhwLevel = null;
  let pendingZhsLevel = null;
  let gateAnswer = 0;
  let gateThen = null;          // what to do once a grown-up has answered

  const screens = {
    home: 'screen-home',
    countdown: 'screen-countdown',
    quiz: 'screen-quiz',
    results: 'screen-results',
    prizes: 'screen-prizes',
    write: 'screen-write',
    parent: 'screen-parent'
  };

  window.showScreen = function (name) {
    Object.values(screens).forEach(id => document.getElementById(id).classList.remove('active'));
    const id = screens[name] || name;
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
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
    Store.getPacks().forEach(p => {
      const count = Store.countFor(p.id);
      if (!p.generated && count === 0) return; // hide empty custom packs
      const lang = p.lang === 'zh' ? 'zh' : 'en';
      const card = document.createElement('button');
      card.className = 'pack-card ' + (p.color || 'a1') + (lang === 'zh' ? ' zh-card' : '');
      const sub = p.id === 'zh-write' ? '✍️ trace & learn'
        : p.generated ? '∞ endless' : count + ' question' + (count === 1 ? '' : 's');
      const best = Store.getBest(p.id);
      card.innerHTML = `<span class="p-emoji">${p.emoji}</span>
        <span class="p-name">${escapeHtml(p.name)}</span>
        <span class="p-count">${sub}${best ? ' · 🏅' + best : ''}</span>`;
      card.addEventListener('click', () => { Sfx.resume(); Sfx.tap(); launchPack(p.id); });
      grids[lang].appendChild(card);
    });
  }

  /* ---------- launching ---------- */
  function launchPack(packId) {
    const pack = Store.getPack(packId);
    if (!pack) return;
    if (pack.generated) {
      // generated packs ask for a level first
      if (packId === 'zh-quest') openZhModal();
      else if (packId === 'zh-words') openZhwModal();
      else if (packId === 'zh-sentences') openZhsModal();
      else if (packId === 'zh-write') { Writer.open(); return; }
      else openMathModal();
      return;
    }
    let qs = Store.questionsFor(packId).slice();
    if (!qs.length) return;
    qs = Store.shuffle(qs).slice(0, ROUND_SIZE).map(Store.shuffleOptions);
    Game.stop();
    Game.start(packId, qs);
  }

  function startMath(level) {
    const qs = Store.generateMath(level, ROUND_SIZE);
    Game.stop();
    Game.start('math-machine', qs);
  }

  function startZhQuest(level) {
    const qs = Store.generateZh(level, ROUND_SIZE);
    Game.stop();
    Game.start('zh-quest', qs);
  }

  function startZhWords(level) {
    const qs = Store.generateZhWords(level, ROUND_SIZE);
    Game.stop();
    Game.start('zh-words', qs);
  }

  function startZhSentences(level) {
    const qs = Store.generateZhSentences(level, ROUND_SIZE);
    Game.stop();
    Game.start('zh-sentences', qs);
  }

  function replay() {
    const pid = Game.currentPack();
    const pack = Store.getPack(pid);
    if (pack && pack.generated) {
      if (pid === 'zh-quest') startZhQuest(pendingZhLevel || 1);
      else if (pid === 'zh-words') startZhWords(pendingZhwLevel || 1);
      else if (pid === 'zh-sentences') startZhSentences(pendingZhsLevel || 1);
      else startMath(pendingMathLevel || 2);
    }
    else { launchPack(pid); }
  }

  /* ---------- level modals (math machine / Chinese quests) ---------- */
  function openMathModal() { document.getElementById('math-modal').classList.remove('hidden'); }
  function openZhModal() { document.getElementById('zh-modal').classList.remove('hidden'); }
  function openZhwModal() { document.getElementById('zhw-modal').classList.remove('hidden'); }
  function openZhsModal() { document.getElementById('zhs-modal').classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  document.querySelectorAll('#math-modal .level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sfx.tap();
      pendingMathLevel = parseInt(btn.dataset.level, 10);
      closeModal('math-modal');
      startMath(pendingMathLevel);
    });
  });

  document.querySelectorAll('#zh-modal .level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sfx.tap();
      pendingZhLevel = parseInt(btn.dataset.level, 10);
      closeModal('zh-modal');
      startZhQuest(pendingZhLevel);
    });
  });

  document.querySelectorAll('#zhw-modal .level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sfx.tap();
      pendingZhwLevel = parseInt(btn.dataset.level, 10);
      closeModal('zhw-modal');
      startZhWords(pendingZhwLevel);
    });
  });

  document.querySelectorAll('#zhs-modal .level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sfx.tap();
      pendingZhsLevel = parseInt(btn.dataset.level, 10);
      closeModal('zhs-modal');
      startZhSentences(pendingZhsLevel);
    });
  });

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
      const zhIds = { chinese: 1, 'zh-quest': 1, 'zh-words': 1, 'zh-sentences': 1 };
      const zhRounds = rounds.filter(r => zhIds[r.packId]);
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
          </ul>`;
      body.appendChild(div);
    });
  }

  function checkGate() {
    const val = parseInt(document.getElementById('gate-answer').value, 10);
    if (val === gateAnswer) {
      closeModal('gate-modal');
      if (gateThen) { const fn = gateThen; gateThen = null; fn(); return; }
      Editor.refresh();
      renderReport();
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
  function goHome() { Sfx.tap(); Game.stop(); renderHome(); showScreen('home'); }
  document.querySelectorAll('.exit-home').forEach(b => b.addEventListener('click', goHome));

  /* ---------- results buttons ---------- */
  document.getElementById('play-again').addEventListener('click', () => { Sfx.tap(); replay(); });
  document.getElementById('back-home').addEventListener('click', () => {
    Sfx.tap(); Game.stop(); renderHome(); showScreen('home');
  });

  /* ---------- prize machine ---------- */
  function openPrizes() {
    Sfx.resume(); Sfx.tap();
    Game.stop();
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
