/* Sentence Builder 造句: the words of a silly sentence come as blocks;
   tap them into the right order. The scene and the spoken sentence give
   the meaning, the blocks give the reading. Same sentences as Silly
   Sentences, so both games feed the same memory. */
window.Order = (function () {
  const ROUND = 6;
  let level = 1;
  let items = [];
  let idx = 0;
  let placed = [];        // block indexes in the slots (null = empty)
  let misses = 0;
  let score = 0, correct = 0;
  let locked = false;
  let ui = {};

  function open(lv) {
    level = lv || 1;
    const all = window.ZH.SENTS.map(s => Object.assign({ words: s.seg.split('/') }, s));
    const bank = all.filter(s => level === 1 ? s.words.length <= 3 && s.lv === 1
      : level === 2 ? s.words.length <= 4 && s.lv <= 2
      : s.words.length >= 4);
    items = Mini.sample(bank, ROUND);
    idx = 0; score = 0; correct = 0;
    const stage = Mini.open(api, '🧱 Sentence Builder 造句');
    stage.innerHTML = `
      <div class="mini-head">${Mini.progress(1, ROUND)}<div class="pill score-pill"><span class="mini-score">0</span> pts</div></div>
      <div class="order-card">
        <div class="order-scene"></div>
        <div class="order-en"></div>
        <button class="speak-btn order-say" type="button">🔊 Hear the sentence</button>
        <div class="order-slots"></div>
        <div class="mini-msg order-msg"></div>
      </div>
      <div class="order-blocks"></div>
      <button class="big-btn green mini-next hidden" type="button">Next ▶</button>`;
    ui = {
      prog: stage.querySelector('.mini-progress'), score: stage.querySelector('.mini-score'),
      scene: stage.querySelector('.order-scene'), en: stage.querySelector('.order-en'),
      say: stage.querySelector('.order-say'), slots: stage.querySelector('.order-slots'),
      msg: stage.querySelector('.order-msg'), blocks: stage.querySelector('.order-blocks'),
      next: stage.querySelector('.mini-next')
    };
    ui.say.addEventListener('click', () => { Sfx.tap(); say(); });
    ui.next.addEventListener('click', () => { Sfx.tap(); next(); });
    show();
  }

  function cur() { return items[idx]; }
  function say() { Sfx.stopSpeak(); Sfx.speakZh(cur().ch); }

  function show() {
    const s = cur();
    locked = false; misses = 0;
    placed = s.words.map(() => null);
    ui.prog.textContent = (idx + 1) + ' / ' + items.length;
    ui.scene.textContent = s.pic;
    ui.en.textContent = s.en;
    ui.next.classList.add('hidden');
    ui.msg.textContent = 'Tap the blocks in order! 照順序排好';
    // shuffle until the blocks are out of order
    let order = s.words.map((_, i) => i);
    do { Store.shuffle(order); } while (order.every((v, i) => v === i) && order.length > 1);
    ui.blocks.innerHTML = '';
    order.forEach((wi, k) => {
      const b = Mini.h('button', 'order-block a' + (k % 7), '');
      b.type = 'button';
      b.textContent = s.words[wi];
      b.dataset.wi = wi;
      b.addEventListener('click', () => pick(b));
      ui.blocks.appendChild(b);
    });
    renderSlots();
    Mini.later(say, 300);
  }

  function renderSlots() {
    const s = cur();
    ui.slots.innerHTML = '';
    placed.forEach((wi, i) => {
      const d = Mini.h('button', 'order-slot' + (wi != null ? ' filled' : ''), '');
      d.type = 'button';
      d.textContent = wi != null ? s.words[wi] : '';
      d.style.minWidth = (s.words[i].length * 1.4 + 1.2) + 'em';
      d.addEventListener('click', () => unpick(i));
      ui.slots.appendChild(d);
    });
  }

  function pick(b) {
    if (locked || b.classList.contains('used')) return;
    const i = placed.indexOf(null);
    if (i < 0) return;
    Sfx.pop();
    Sfx.stopSpeak(); Sfx.speakZh(b.textContent);
    placed[i] = parseInt(b.dataset.wi, 10);
    b.classList.add('used');
    renderSlots();
    if (placed.indexOf(null) < 0) Mini.later(check, 350);
  }

  function unpick(i) {
    if (locked || placed[i] == null) return;
    Sfx.tap();
    const wi = placed[i];
    placed[i] = null;
    const b = [...ui.blocks.children].find(x => parseInt(x.dataset.wi, 10) === wi);
    if (b) b.classList.remove('used');
    renderSlots();
  }

  function check() {
    const s = cur();
    if (placed.some(p => p == null)) return;
    const ok = placed.every((wi, i) => wi === i);
    if (!ok) {
      misses++;
      Sfx.wrong();
      ui.slots.classList.add('shake');
      ui.msg.textContent = misses >= 2 ? '💡 Listen: the first block is glowing 第一塊亮亮的' : 'Not quite — listen again! 再聽一次';
      Mini.later(() => {
        ui.slots.classList.remove('shake');
        placed = placed.map(() => null);
        [...ui.blocks.children].forEach(b => {
          b.classList.remove('used');
          if (misses >= 2 && parseInt(b.dataset.wi, 10) === 0) b.classList.add('hint');
        });
        renderSlots();
        say();
      }, 600);
      return;
    }
    locked = true;
    const good = misses <= 1;
    const gained = Math.max(300, 1000 - misses * 300);
    score += gained; if (good) correct++;
    ui.score.textContent = score;
    Sfx.correct();
    Confetti.burst(60, window.innerHeight * 0.35);
    Store.noteChars(s.ch, good);
    ui.msg.textContent = (good ? '🌟 ' : '👍 ') + s.ch + '  +' + gained;
    // karaoke: light the blocks up as the sentence is read
    const slots = [...ui.slots.children];
    let k = -1;
    const step = () => {
      k++;
      slots.forEach((el, i) => el.classList.toggle('lit', i === k));
      if (k < slots.length) Mini.later(step, Sfx.zhPace() * Math.max(1, s.words[k].length));
    };
    Sfx.stopSpeak(); Sfx.speakZh(s.ch);
    Mini.later(step, 250);
    ui.next.classList.remove('hidden');
    autoNext = Mini.later(next, 3600);
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
    else Mini.finish({ packId: 'zh-order', correct, total: items.length, score, replay: () => open(level) });
  }

  const api = { open, stop() { locked = true; } };
  return api;
})();
