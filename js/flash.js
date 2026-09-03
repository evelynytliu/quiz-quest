/* Flash Write 閃字記憶: the character appears for a few seconds, then
   vanishes — write it from memory on the blank grid. Write Quest with the
   training wheels off. A peek is allowed, but it costs a star. */
window.Flash = (function () {
  const ROUND = 6;
  const LOOK_MS = 3000;
  let level = 1;
  let items = [];
  let idx = 0;
  let score = 0, correct = 0;
  let writer = null;
  let misses = 0, peeks = 0;
  let phase = 'idle';       // look | write | done
  let ui = {};

  function strokeCount(ch) {
    const d = window.ZH_STROKES[ch];
    return d && d.strokes ? d.strokes.length : 0;
  }

  function open(lv) {
    level = lv || 1;
    const all = Object.keys(window.ZH_STROKES || {}).filter(ch => window.ZH.word(ch));
    const bank = all.filter(ch => {
      const n = strokeCount(ch);
      return level === 1 ? n <= 3 : level === 2 ? n >= 4 && n <= 6 : n >= 7;
    });
    items = Mini.sample(bank.length >= 4 ? bank : all, ROUND).map(ch => window.ZH.word(ch));
    idx = 0; score = 0; correct = 0;
    const stage = Mini.open(api, '⚡ Flash Write 閃字記憶');
    stage.innerHTML = `
      <div class="mini-head">${Mini.progress(1, items.length)}<div class="pill score-pill"><span class="mini-score">0</span> pts</div></div>
      <div class="write-stage flash-stage">
        <div class="write-info">
          <div class="flash-pic"></div>
          <div class="write-word flash-word"></div>
          <div class="write-stars flash-stars">☆☆☆</div>
        </div>
        <div class="flash-look"><span class="flash-big"></span><div class="flash-ring"><div class="flash-ring-fill"></div></div></div>
        <div id="flash-target" class="write-target hidden"></div>
        <div class="write-msg flash-msg" aria-live="polite"></div>
        <div class="write-actions">
          <button class="big-btn blue small flash-peek hidden" type="button">👀 Peek 偷看一下</button>
          <button class="big-btn green mini-next hidden" type="button">▶ Next 下一個字</button>
        </div>
      </div>`;
    ui = {
      prog: stage.querySelector('.mini-progress'), score: stage.querySelector('.mini-score'),
      pic: stage.querySelector('.flash-pic'), word: stage.querySelector('.flash-word'),
      stars: stage.querySelector('.flash-stars'), look: stage.querySelector('.flash-look'),
      big: stage.querySelector('.flash-big'), ring: stage.querySelector('.flash-ring-fill'),
      target: stage.querySelector('#flash-target'), msg: stage.querySelector('.flash-msg'),
      peek: stage.querySelector('.flash-peek'), next: stage.querySelector('.mini-next')
    };
    ui.peek.addEventListener('click', () => { Sfx.tap(); peek(); });
    ui.next.addEventListener('click', () => { Sfx.tap(); next(); });
    show();
  }

  function cur() { return items[idx]; }
  function starStr(n) { return '⭐'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n)); }

  function targetSize() {
    return Math.round(Math.min(Math.min(window.innerWidth, 720) * 0.66, window.innerHeight * 0.42, 340));
  }

  function show() {
    const w = cur();
    misses = 0; peeks = 0; phase = 'look';
    ui.prog.textContent = (idx + 1) + ' / ' + items.length;
    ui.pic.textContent = w.pic;
    ui.word.textContent = w.en + ' · ' + strokeCount(w.ch) + ' strokes';
    ui.stars.textContent = '☆☆☆';
    ui.big.textContent = w.ch;
    ui.look.classList.remove('hidden');
    ui.target.classList.add('hidden');
    ui.peek.classList.add('hidden');
    ui.next.classList.add('hidden');
    ui.msg.textContent = '👀 Look carefully! It will disappear… 仔細看，等一下會不見';
    ui.ring.style.transition = 'none'; ui.ring.style.width = '100%';
    void ui.ring.offsetWidth;
    ui.ring.style.transition = 'width ' + LOOK_MS + 'ms linear'; ui.ring.style.width = '0%';
    Sfx.stopSpeak(); Sfx.speakZhEn(w.ch, w.en);
    Mini.later(write, LOOK_MS);
  }

  function write() {
    if (phase !== 'look') return;
    phase = 'write';
    const w = cur();
    ui.look.classList.add('hidden');
    ui.target.classList.remove('hidden');
    ui.peek.classList.remove('hidden');
    ui.msg.textContent = '✍️ Now write ' + w.en + ' from memory! 憑記憶寫出來';
    const size = targetSize();
    ui.target.innerHTML = '';
    ui.target.style.width = size + 'px'; ui.target.style.height = size + 'px';
    writer = HanziWriter.create('flash-target', w.ch, {
      width: size, height: size, padding: Math.round(size * 0.08),
      showCharacter: false, showOutline: false,
      strokeColor: '#e8472f', drawingColor: '#4f88d6', drawingWidth: 22,
      showHintAfterMisses: 3, highlightOnComplete: true, highlightColor: '#f3c64c',
      charDataLoader: (c, done) => done(window.ZH_STROKES[c])
    });
    Sfx.speakZh(w.ch);
    writer.quiz({
      onCorrectStroke: () => Sfx.pop(),
      onMistake: () => { misses++; Sfx.tap(); },
      onComplete: () => done()
    });
  }

  // a quick look at the answer, then it hides again
  function peek() {
    if (phase !== 'write' || !writer) return;
    peeks++;
    ui.peek.disabled = true;
    writer.showOutline({ duration: 200 });
    Mini.later(() => {
      if (writer && phase === 'write') writer.hideOutline({ duration: 300 });
      ui.peek.disabled = false;
    }, 1300);
  }

  function done() {
    phase = 'done';
    const w = cur();
    const stars = (misses === 0 && peeks === 0) ? 3 : (misses <= 2 && peeks <= 1) ? 2 : 1;
    const gained = 200 + stars * 300;
    score += gained; if (stars >= 2) correct++;
    ui.score.textContent = score;
    ui.stars.textContent = starStr(stars);
    ui.peek.classList.add('hidden');
    Store.logWrite(w.ch);
    Store.noteChar(w.ch, stars >= 2);
    const quest = Store.bumpQuest('write', 1);
    Sfx.fanfare();
    Confetti.burst(70, window.innerHeight * 0.4);
    if (stars === 3) Confetti.emojiBurst(['⚡', '🌟'], 14);
    ui.msg.textContent = (stars === 3 ? '🌟 From memory — amazing! 記住了！' : stars === 2 ? '🎉 Great writing! 很棒！' : '💪 Done! 完成！')
      + '  +' + gained + (quest.length ? '  ·  🎯 Daily quest done! +💰' + quest[0].reward : '');
    Sfx.stopSpeak(); Sfx.speakZhEn(w.ch, w.en);
    ui.next.classList.remove('hidden');
    Mini.renderCoins();
  }

  function next() {
    if (phase === 'look') return;
    if (writer) { try { writer.cancelQuiz(); } catch (e) {} writer = null; }
    idx++;
    if (idx < items.length) show();
    else Mini.finish({ packId: 'zh-flash', correct, total: items.length, score, replay: () => open(level) });
  }

  const api = { open, stop() { phase = 'idle'; if (writer) { try { writer.cancelQuiz(); } catch (e) {} writer = null; } } };
  return api;
})();
