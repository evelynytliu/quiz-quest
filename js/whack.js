/* Whack-a-Char 打地鼠: hear a word, bop the mole holding that character
   before it ducks back down. Speed and hand-eye fun for kids who like a
   bit of action — the character is learned on the way. */
window.Whack = (function () {
  const HOLES = 9;
  const TARGETS = 10;
  const SPEED = {            // per level: how long a mole stays up, gap between waves, moles per wave
    1: { up: 1900, gap: 500, moles: 2 },
    2: { up: 1400, gap: 400, moles: 3 },
    3: { up: 1000, gap: 300, moles: 3 }
  };
  let level = 1;
  let targets = [];
  let idx = 0;
  let hits = 0;
  let score = 0;
  let streak = 0;
  let waves = 0;
  let running = false;
  let ui = {};
  let bank = [];

  function open(lv) {
    level = lv || 1;
    bank = window.ZH.WORDS.filter(w => w.lv <= level && w.pic);
    targets = Mini.sample(bank, TARGETS);
    idx = 0; hits = 0; score = 0; streak = 0;
    const stage = Mini.open(api, '🔨 Whack-a-Char 打地鼠');
    stage.innerHTML = `
      <div class="mini-head">${Mini.progress(1, TARGETS)}<div class="pill score-pill"><span class="mini-score">0</span> pts</div></div>
      <div class="whack-target">
        <span class="whack-find">Find</span>
        <span class="whack-pic"></span>
        <span class="whack-char"></span>
        <button class="speak-btn whack-say" type="button">🔊 Hear it</button>
      </div>
      <div class="whack-field">${Array.from({ length: HOLES }).map(() =>
        '<div class="hole"><div class="dirt"></div><button class="mole" type="button"><span class="mole-face">🐹</span><span class="mole-char"></span></button></div>').join('')}
      </div>
      <div class="mini-msg whack-msg">Bop the mole holding the word you hear! 打中對的字</div>`;
    ui = {
      prog: stage.querySelector('.mini-progress'), score: stage.querySelector('.mini-score'),
      pic: stage.querySelector('.whack-pic'), char: stage.querySelector('.whack-char'),
      msg: stage.querySelector('.whack-msg'), say: stage.querySelector('.whack-say'),
      moles: [...stage.querySelectorAll('.mole')]
    };
    ui.say.addEventListener('click', () => { Sfx.tap(); sayTarget(); });
    ui.moles.forEach((m, i) => m.addEventListener('click', () => bop(i)));
    running = true;
    showTarget();
  }

  function cur() { return targets[idx]; }
  function sayTarget() { Sfx.stopSpeak(); Sfx.speakZh(cur().ch); }

  function showTarget() {
    const t = cur();
    waves = 0;
    ui.prog.textContent = (idx + 1) + ' / ' + TARGETS;
    ui.pic.textContent = t.pic;
    // level 1 shows the character too; higher levels go by ear + picture
    ui.char.textContent = level === 1 ? t.ch : '';
    ui.moles.forEach(m => { m.classList.remove('up', 'bonk', 'wrong'); m.dataset.ch = ''; });
    sayTarget();
    Mini.later(wave, 900);
  }

  // a wave: a few moles pop up, one of them (usually) holding the target
  function wave() {
    if (!running) return;
    const sp = SPEED[level];
    waves++;
    const holes = Mini.sample([...Array(HOLES).keys()], sp.moles);
    const hasTarget = level === 1 || waves % 2 === 1 || Math.random() < 0.7;
    const others = Store.shuffle(bank.filter(w => w.ch !== cur().ch)).map(w => w.ch);
    holes.forEach((h, i) => {
      const m = ui.moles[h];
      const ch = (hasTarget && i === 0) ? cur().ch : others[i];
      m.dataset.ch = ch;
      m.querySelector('.mole-char').textContent = ch;
      m.querySelector('.mole-face').textContent = ['🐹', '🐭', '🦫'][h % 3];
      m.classList.remove('bonk', 'wrong');
      m.classList.add('up');
    });
    Mini.later(() => {
      if (!running) return;
      holes.forEach(h => ui.moles[h].classList.remove('up'));
      if (waves >= 5) return miss();
      Mini.later(wave, sp.gap);
    }, sp.up);
  }

  function bop(i) {
    if (!running) return;
    const m = ui.moles[i];
    if (!m.classList.contains('up')) return;
    if (m.dataset.ch === cur().ch) {
      running = false;                       // freeze the field until the next target
      streak++;
      const gained = 100 + Math.min(streak, 5) * 20 + Math.max(0, 5 - waves) * 20;
      score += gained; hits++;
      ui.score.textContent = score;
      m.classList.add('bonk');
      Sfx.correct();
      Confetti.burst(30, window.innerHeight * 0.5);
      Store.noteChar(cur().ch, true);
      ui.msg.textContent = '🎯 ' + cur().ch + '  ' + cur().en + '!  +' + gained;
      Sfx.stopSpeak(); Sfx.speakZhEn(cur().ch, cur().en);
      Mini.later(() => { ui.moles.forEach(x => x.classList.remove('up')); }, 500);
      Mini.later(advance, 1900);
    } else {
      streak = 0;
      m.classList.add('wrong');
      m.querySelector('.mole-face').textContent = '😝';
      Sfx.wrong();
      ui.msg.textContent = 'Oops, that was ' + m.dataset.ch + '. Listen again! 再聽一次';
      Mini.later(() => m.classList.remove('up', 'wrong'), 350);
    }
  }

  function miss() {
    if (!running) return;
    running = false;
    streak = 0;
    Store.noteChar(cur().ch, false);
    ui.msg.textContent = '⏰ It was ' + cur().ch + ' ' + cur().pic + ' — next one!';
    // show the answer on one mole so the miss still teaches
    const m = ui.moles[4];
    m.dataset.ch = cur().ch;
    m.querySelector('.mole-char').textContent = cur().ch;
    m.querySelector('.mole-face').textContent = '🐹';
    m.classList.add('up', 'bonk');
    Sfx.stopSpeak(); Sfx.speakZhEn(cur().ch, cur().en);
    Mini.later(advance, 2000);
  }

  function advance() {
    idx++;
    if (idx < TARGETS) { running = true; showTarget(); }
    else Mini.finish({ packId: 'zh-whack', correct: hits, total: TARGETS, score, replay: () => open(level) });
  }

  const api = { open, stop() { running = false; } };
  return api;
})();
