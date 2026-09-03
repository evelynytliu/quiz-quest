/* Character Builder 拼字: tap the pieces that snap together into a new
   character — 日 + 月 = 明. Kids love combining things, and this is the
   core insight of reading Chinese: characters are built from parts. */
window.Builder = (function () {
  const ROUND = 8;
  let level = 1;
  let items = [];
  let idx = 0;
  let misses = 0;
  let score = 0;
  let correct = 0;
  let slots = [];          // chars placed so far (null = empty)
  let locked = false;
  let ui = {};

  function open(lv) {
    level = lv || 1;
    const bank = window.ZH.BUILD.filter(b => b.lv <= level);
    // level 3 leans on the three-piece characters
    const pool = level === 3 ? bank.filter(b => b.lv === 3).concat(Mini.sample(bank.filter(b => b.lv < 3), 4)) : bank;
    items = Mini.sample(pool, Math.min(ROUND, pool.length));
    idx = 0; score = 0; correct = 0;
    const stage = Mini.open(api, '🧩 Character Builder 拼字');
    stage.innerHTML = `
      <div class="mini-head">${Mini.progress(1, items.length)}<div class="pill score-pill"><span class="mini-score">0</span> pts</div></div>
      <div class="build-card">
        <div class="build-goal">
          <span class="build-pic"></span>
          <span class="build-ghost"></span>
          <button class="speak-btn build-say" type="button">🔊</button>
        </div>
        <div class="build-word"></div>
        <div class="build-slots"></div>
        <div class="build-result hidden"></div>
        <div class="mini-msg build-msg"></div>
      </div>
      <div class="build-parts"></div>
      <button class="big-btn green mini-next hidden" type="button">Next ▶</button>`;
    ui = {
      prog: stage.querySelector('.mini-progress'), score: stage.querySelector('.mini-score'),
      pic: stage.querySelector('.build-pic'), ghost: stage.querySelector('.build-ghost'),
      word: stage.querySelector('.build-word'), slots: stage.querySelector('.build-slots'),
      result: stage.querySelector('.build-result'), msg: stage.querySelector('.build-msg'),
      parts: stage.querySelector('.build-parts'), next: stage.querySelector('.mini-next'),
      say: stage.querySelector('.build-say')
    };
    ui.next.addEventListener('click', () => { Sfx.tap(); next(); });
    ui.say.addEventListener('click', () => { Sfx.tap(); sayGoal(); });
    show();
  }

  function cur() { return items[idx]; }

  function sayGoal() {
    const b = cur();
    Sfx.stopSpeak();
    Sfx.speakZhEn(b.ch, b.en);
  }

  function show() {
    const b = cur();
    locked = false; misses = 0;
    slots = b.parts.map(() => null);
    ui.prog.textContent = (idx + 1) + ' / ' + items.length;
    ui.pic.textContent = b.pic;
    // the faint target helps young eyes find the pieces inside the
    // character; the top level hides it and goes by sound + picture
    ui.ghost.textContent = b.ch;
    ui.ghost.classList.toggle('hidden', level >= 3);
    ui.word.textContent = b.en + ' · ' + b.ch;
    ui.result.classList.add('hidden');
    ui.result.textContent = '';
    ui.slots.className = 'build-slots layout-' + b.layout;
    ui.slots.classList.remove('hidden');
    ui.next.classList.add('hidden');
    renderSlots();
    setMsg('Tap the pieces that make ' + b.ch + '! 找出拼成「' + b.ch + '」的字');

    // pieces: the right ones plus a few red herrings
    const extra = level === 1 ? 2 : level === 2 ? 3 : 4;
    const bankChars = window.ZH.WORDS.filter(w => w.lv <= 2 && b.parts.indexOf(w.ch) < 0 && w.ch !== b.ch).map(w => w.ch);
    const distract = Mini.sample(bankChars, extra);
    const tiles = Store.shuffle(b.parts.concat(distract));
    ui.parts.innerHTML = '';
    tiles.forEach((ch, i) => {
      const t = Mini.h('button', 'build-tile a' + (i % 7), '');
      t.type = 'button';
      t.textContent = ch;
      t.dataset.ch = ch;
      t.addEventListener('click', () => pick(t));
      ui.parts.appendChild(t);
    });
    Mini.later(sayGoal, 250);
  }

  function renderSlots() {
    const b = cur();
    ui.slots.innerHTML = '';
    slots.forEach((ch, i) => {
      const s = Mini.h('button', 'build-slot' + (ch ? ' filled' : '') + (b.layout === 'wrap' && i === 1 ? ' inner' : ''), '');
      s.type = 'button';
      s.textContent = ch || '';
      s.addEventListener('click', () => unpick(i));
      ui.slots.appendChild(s);
    });
  }

  function setMsg(t) { ui.msg.textContent = t; }

  function pick(tile) {
    if (locked || tile.classList.contains('used')) return;
    const i = slots.indexOf(null);
    if (i < 0) return;
    Sfx.pop();
    Sfx.stopSpeak(); Sfx.speakZh(tile.dataset.ch);
    slots[i] = tile.dataset.ch;
    tile.classList.add('used');
    tile.dataset.slot = i;
    renderSlots();
    if (slots.indexOf(null) < 0) Mini.later(check, 350);
  }

  function unpick(i) {
    if (locked || !slots[i]) return;
    Sfx.tap();
    const ch = slots[i];
    slots[i] = null;
    const tile = [...ui.parts.children].find(t => t.classList.contains('used') && t.dataset.slot == i && t.dataset.ch === ch);
    if (tile) { tile.classList.remove('used'); delete tile.dataset.slot; }
    renderSlots();
  }

  function sameSet(a, b) {
    const x = a.slice().sort().join(''), y = b.slice().sort().join('');
    return x === y;
  }

  function check() {
    const b = cur();
    if (slots.some(s => !s)) return;
    if (!sameSet(slots, b.parts)) return wrong();
    locked = true;
    // right pieces in a different order: swap them into place first
    if (slots.join('') !== b.parts.join('')) {
      slots = b.parts.slice();
      renderSlots();
      ui.slots.classList.add('swap');
      setMsg('Right pieces — let me swap them round! 換個位置');
      Mini.later(merge, 700);
    } else merge();
  }

  function merge() {
    const b = cur();
    ui.slots.classList.remove('swap');
    ui.slots.classList.add('merging');
    Sfx.correct();
    Mini.later(() => {
      ui.slots.classList.add('hidden');
      ui.result.textContent = b.ch;
      ui.result.classList.remove('hidden');
      ui.result.classList.remove('pop'); void ui.result.offsetWidth; ui.result.classList.add('pop');
      Confetti.burst(60, window.innerHeight * 0.35);
      Confetti.emojiBurst([b.pic, '✨'], 10);
      const good = misses <= 1;
      const gained = Math.max(300, 1000 - misses * 300);
      score += gained; if (good) correct++;
      ui.score.textContent = score;
      Store.noteChars(b.parts.join('') + b.ch, good);
      setMsg((good ? '🌟 ' : '👍 ') + b.parts.join(' + ') + ' = ' + b.ch + '  ' + b.en + '!  +' + gained);
      // say the recipe: 日、月、明！ … bright
      Sfx.stopSpeak();
      Sfx.speakZhEn(b.parts.join('、') + '，' + b.ch, b.en);
      ui.next.classList.remove('hidden');
      autoNext = Mini.later(next, 3600);
    }, 650);
  }

  function wrong() {
    misses++;
    Sfx.wrong();
    ui.slots.classList.add('shake');
    setMsg(misses >= 2 ? '💡 The glowing pieces fit! 亮亮的就是對的' : 'Not quite — try other pieces! 再試試');
    Mini.later(() => {
      ui.slots.classList.remove('shake');
      slots = slots.map(() => null);
      [...ui.parts.children].forEach(t => {
        t.classList.remove('used'); delete t.dataset.slot;
        // after two misses, light up the right pieces
        if (misses >= 2 && cur().parts.indexOf(t.dataset.ch) >= 0) t.classList.add('hint');
      });
      renderSlots();
    }, 500);
  }

  let advancing = false;
  let autoNext = null;      // the auto-advance timer, cancelled when Next is tapped
  function next() {
    if (advancing) return;
    clearTimeout(autoNext);
    advancing = true;
    Mini.later(() => { advancing = false; }, 300);
    idx++;
    if (idx < items.length) show();
    else Mini.finish({ packId: 'zh-build', correct, total: items.length, score, replay: () => open(level) });
  }

  const api = { open, stop() { locked = true; } };
  return api;
})();
