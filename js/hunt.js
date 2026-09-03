/* Hide & Seek 找字: a crowd of characters, and three of them are the one
   you're looking for. Tap them all. Visual search with a reading twist —
   and at the top level the crowd hides look-alike twins (木 among 本). */
window.Hunt = (function () {
  const TARGETS = 5;
  const COPIES = { 1: 2, 2: 3, 3: 3 };
  const GRID = { 1: [5, 4], 2: [6, 5], 3: [6, 6] };     // columns × rows of hiding spots
  const DECOR = ['🌳', '🌸', '🍄', '☁️', '🌈', '🪨', '🌷', '🦋'];
  let level = 1;
  let targets = [];
  let idx = 0;
  let found = 0, wrongs = 0, roundWrong = 0;
  let score = 0, correct = 0;
  let locked = false;
  let ui = {};

  function open(lv) {
    level = lv || 1;
    const bank = window.ZH.WORDS.filter(w => w.pic && w.lv <= level);
    targets = Mini.sample(bank, TARGETS);
    idx = 0; wrongs = 0; score = 0; correct = 0;
    const stage = Mini.open(api, '🔍 Hide & Seek 找字');
    stage.innerHTML = `
      <div class="mini-head">${Mini.progress(1, TARGETS)}<div class="pill score-pill"><span class="mini-score">0</span> pts</div></div>
      <div class="hunt-target">
        <span class="hunt-find">Find</span>
        <span class="hunt-count"></span>
        <span class="hunt-char"></span>
        <span class="hunt-pic"></span>
        <button class="speak-btn hunt-say" type="button">🔊</button>
      </div>
      <div class="hunt-board"></div>
      <div class="mini-msg hunt-msg">Tap every one you can find! 全部找出來</div>`;
    ui = {
      prog: stage.querySelector('.mini-progress'), score: stage.querySelector('.mini-score'),
      count: stage.querySelector('.hunt-count'), char: stage.querySelector('.hunt-char'),
      pic: stage.querySelector('.hunt-pic'), say: stage.querySelector('.hunt-say'),
      board: stage.querySelector('.hunt-board'), msg: stage.querySelector('.hunt-msg')
    };
    ui.say.addEventListener('click', () => { Sfx.tap(); say(); });
    show();
  }

  function cur() { return targets[idx]; }
  function say() { Sfx.stopSpeak(); Sfx.speakZh(cur().ch); }

  function show() {
    const t = cur();
    const copies = COPIES[level];
    const [cols, rows] = GRID[level];
    found = 0; roundWrong = 0; locked = false;
    ui.prog.textContent = (idx + 1) + ' / ' + TARGETS;
    ui.char.textContent = t.ch;
    ui.pic.textContent = t.pic;
    ui.count.textContent = copies + ' ×';
    ui.msg.textContent = 'Find ' + copies + ' × ' + t.ch + '! 找出 ' + copies + ' 個「' + t.ch + '」';

    // the crowd: the targets, look-alikes at level 3, other characters,
    // and a few decorations so it feels like a scene
    const n = cols * rows;
    const twins = level === 3
      ? window.ZH.TWINS.filter(p => p.a === t.ch || p.b === t.ch).map(p => p.a === t.ch ? p.b : p.a) : [];
    const others = Store.shuffle(window.ZH.WORDS.filter(w => w.ch !== t.ch && twins.indexOf(w.ch) < 0).map(w => w.ch));
    const decorN = level === 1 ? 3 : 4;
    const fill = [];
    for (let i = 0; i < copies; i++) fill.push({ ch: t.ch, kind: 'target' });
    twins.forEach(tw => { for (let i = 0; i < 2; i++) fill.push({ ch: tw, kind: 'twin' }); });
    for (let i = 0; i < decorN; i++) fill.push({ ch: DECOR[(idx * 3 + i) % DECOR.length], kind: 'decor' });
    let k = 0;
    while (fill.length < n) fill.push({ ch: others[k++ % others.length], kind: 'other' });
    Store.shuffle(fill);

    ui.board.innerHTML = '';
    ui.board.style.setProperty('--cols', cols);
    ui.board.style.setProperty('--rows', rows);
    fill.slice(0, n).forEach((f, i) => {
      const cell = Mini.h(f.kind === 'decor' ? 'span' : 'button', 'hunt-tile' + (f.kind === 'decor' ? ' decor' : ' c' + (i % 6)), '');
      if (f.kind !== 'decor') cell.type = 'button';
      cell.textContent = f.ch;
      // a little jitter so it reads as a scene, not a spreadsheet
      const rot = (Math.random() * 24 - 12).toFixed(1);
      const dx = (Math.random() * 30 - 15).toFixed(0), dy = (Math.random() * 30 - 15).toFixed(0);
      cell.style.transform = `translate(${dx}%, ${dy}%) rotate(${rot}deg)`;
      cell.style.fontSize = (0.85 + Math.random() * 0.45).toFixed(2) + 'em';
      if (f.kind !== 'decor') cell.addEventListener('click', () => tap(cell, f));
      ui.board.appendChild(cell);
    });
    Mini.later(say, 300);
  }

  function tap(cell, f) {
    if (locked || cell.classList.contains('found')) return;
    if (f.kind === 'target') {
      found++;
      cell.classList.add('found');
      Sfx.pop();
      score += 200;
      ui.score.textContent = score;
      ui.msg.textContent = '✅ ' + found + ' / ' + COPIES[level] + ' found!';
      if (found >= COPIES[level]) {
        locked = true;
        const good = roundWrong <= 1;
        if (good) correct++;
        Store.noteChar(cur().ch, good);
        Sfx.correct();
        Confetti.burst(60, window.innerHeight * 0.4);
        ui.msg.textContent = '🎉 All found! ' + cur().ch + '  ' + cur().en;
        Sfx.stopSpeak(); Sfx.speakZhEn(cur().ch, cur().en);
        Mini.later(next, 1900);
      }
    } else {
      roundWrong++; wrongs++;
      score = Math.max(0, score - 50);
      ui.score.textContent = score;
      Sfx.wrong();
      cell.classList.add('shake');
      Mini.later(() => cell.classList.remove('shake'), 400);
      ui.msg.textContent = f.kind === 'twin'
        ? '👀 So close! That is ' + f.ch + ', not ' + cur().ch + ' 這是雙胞胎'
        : 'That is ' + f.ch + '. Keep looking! 再找找';
    }
  }

  function next() {
    idx++;
    if (idx < TARGETS) show();
    else Mini.finish({ packId: 'zh-hunt', correct, total: TARGETS, score, replay: () => open(level) });
  }

  const api = { open, stop() { locked = true; } };
  return api;
})();
