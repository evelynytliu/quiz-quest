/* App glue: screen routing, home grid, pack launching, math-level picker,
   parent gate. Loaded last. */
(function () {
  const ROUND_SIZE = 10;
  let pendingMathLevel = null;
  let gateAnswer = 0;

  const screens = {
    home: 'screen-home',
    countdown: 'screen-countdown',
    quiz: 'screen-quiz',
    results: 'screen-results',
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
    const grid = document.getElementById('pack-grid');
    grid.innerHTML = '';
    Store.getPacks().forEach(p => {
      const count = Store.countFor(p.id);
      if (!p.generated && count === 0) return; // hide empty custom packs
      const card = document.createElement('button');
      card.className = 'pack-card ' + (p.color || 'a1');
      const sub = p.generated ? '∞ endless' : count + ' question' + (count === 1 ? '' : 's');
      const best = Store.getBest(p.id);
      card.innerHTML = `<span class="p-emoji">${p.emoji}</span>
        <span class="p-name">${escapeHtml(p.name)}</span>
        <span class="p-count">${sub}${best ? ' · 🏅' + best : ''}</span>`;
      card.addEventListener('click', () => { Sfx.resume(); Sfx.tap(); launchPack(p.id); });
      grid.appendChild(card);
    });
  }

  /* ---------- launching ---------- */
  function launchPack(packId) {
    const pack = Store.getPack(packId);
    if (!pack) return;
    if (pack.generated) { openMathModal(packId); return; }
    let qs = Store.questionsFor(packId).slice();
    if (!qs.length) return;
    qs = Store.shuffle(qs).slice(0, ROUND_SIZE);
    Game.stop();
    Game.start(packId, qs);
  }

  function startMath(level) {
    const qs = Store.generateMath(level, ROUND_SIZE);
    Game.stop();
    Game.start('math-machine', qs);
  }

  function replay() {
    const pid = Game.currentPack();
    const pack = Store.getPack(pid);
    if (pack && pack.generated) { startMath(pendingMathLevel || 2); }
    else { launchPack(pid); }
  }

  /* ---------- math modal ---------- */
  function openMathModal() { document.getElementById('math-modal').classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sfx.tap();
      pendingMathLevel = parseInt(btn.dataset.level, 10);
      closeModal('math-modal');
      startMath(pendingMathLevel);
    });
  });

  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => closeModal(b.dataset.close));
  });

  /* ---------- parent gate ---------- */
  function openGate() {
    const a = 6 + Math.floor(Math.random() * 4);   // 6..9
    const b = 6 + Math.floor(Math.random() * 4);
    gateAnswer = a * b;
    document.getElementById('gate-question').textContent = `${a} × ${b} = ?`;
    document.getElementById('gate-answer').value = '';
    document.getElementById('gate-error').classList.add('hidden');
    document.getElementById('gate-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('gate-answer').focus(), 50);
  }

  document.getElementById('open-parent').addEventListener('click', openGate);
  document.getElementById('gate-submit').addEventListener('click', checkGate);
  document.getElementById('gate-answer').addEventListener('keydown', e => { if (e.key === 'Enter') checkGate(); });

  function checkGate() {
    const val = parseInt(document.getElementById('gate-answer').value, 10);
    if (val === gateAnswer) {
      closeModal('gate-modal');
      Editor.refresh();
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

  /* ---------- results buttons ---------- */
  document.getElementById('play-again').addEventListener('click', () => { Sfx.tap(); replay(); });
  document.getElementById('back-home').addEventListener('click', () => {
    Sfx.tap(); Game.stop(); renderHome(); showScreen('home');
  });

  /* ---------- name ---------- */
  const nameInput = document.getElementById('player-name');
  nameInput.value = Store.getName();
  nameInput.addEventListener('input', () => Store.setName(nameInput.value.trim()));

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- boot ---------- */
  Store.load();
  Editor.init();
  renderHome();
  showScreen('home');
  // unlock audio on first interaction (browser autoplay policy)
  document.addEventListener('click', () => Sfx.resume(), { once: true });
})();
