/* Ancient Pictures 象形變身: the sun emoji becomes the ancient drawing ☉
   and then the modern 日. Seeing where a character came from makes it
   stick — 日 月 山 水 火 木 are all pictures that grew up.
   The ancient forms are simple hand-drawn line art (SVG paths), in the
   spirit of oracle-bone script rather than exact copies. */
window.Morph = (function () {
  const ROUND = 8;
  const S = 'fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"';
  const ART = {
    '日': `<circle cx="50" cy="50" r="30" ${S}/><circle cx="50" cy="50" r="6" fill="currentColor"/>`,
    '月': `<path d="M64 12 C 26 22, 26 78, 64 88 C 44 72, 44 28, 64 12 Z" ${S}/><path d="M50 40 L56 50" ${S}/>`,
    '山': `<path d="M8 84 L26 30 L42 66 L54 12 L66 66 L80 32 L92 84 Z" ${S}/>`,
    '水': `<path d="M50 8 C 38 28, 62 42, 50 58 C 38 74, 62 86, 50 96" ${S}/><path d="M28 26 C 22 34, 34 38, 28 46" ${S}/><path d="M26 60 C 20 68, 32 72, 26 80" ${S}/><path d="M72 26 C 78 34, 66 38, 72 46" ${S}/><path d="M74 60 C 80 68, 68 72, 74 80" ${S}/>`,
    '火': `<path d="M50 10 C 40 30, 36 44, 44 58 C 30 52, 24 62, 26 78 C 30 92, 70 92, 74 78 C 76 62, 70 52, 56 58 C 64 44, 60 30, 50 10 Z" ${S}/><path d="M50 56 C 44 66, 44 74, 50 82 C 56 74, 56 66, 50 56 Z" ${S}/>`,
    '木': `<path d="M50 12 L50 90" ${S}/><path d="M50 40 C 40 34, 30 28, 20 18" ${S}/><path d="M50 40 C 60 34, 70 28, 80 18" ${S}/><path d="M50 66 C 42 74, 34 82, 24 92" ${S}/><path d="M50 66 C 58 74, 66 82, 76 92" ${S}/>`,
    '人': `<path d="M60 10 C 54 30, 48 46, 40 62 C 34 74, 28 84, 22 94" ${S}/><path d="M52 34 C 62 42, 70 50, 76 60" ${S}/>`,
    '口': `<path d="M20 30 L80 30 L72 74 L28 74 Z" ${S}/>`,
    '目': `<path d="M10 50 C 30 22, 70 22, 90 50 C 70 78, 30 78, 10 50 Z" ${S}/><circle cx="50" cy="50" r="11" ${S}/>`,
    '雨': `<path d="M50 6 L50 20" ${S}/><path d="M14 20 L86 20" ${S}/><path d="M28 32 L28 48" ${S}/><path d="M50 32 L50 54" ${S}/><path d="M72 32 L72 48" ${S}/><path d="M38 58 L38 76" ${S}/><path d="M62 58 L62 76" ${S}/><path d="M50 66 L50 90" ${S}/>`,
    '田': `<path d="M20 20 L80 20 L80 80 L20 80 Z" ${S}/><path d="M50 20 L50 80" ${S}/><path d="M20 50 L80 50" ${S}/>`,
    '門': `<path d="M22 12 L22 90" ${S}/><path d="M22 20 L44 20 L44 58 L22 58" ${S}/><path d="M78 12 L78 90" ${S}/><path d="M78 20 L56 20 L56 58 L78 58" ${S}/>`,
    '魚': `<path d="M14 50 C 32 18, 72 18, 90 50 C 72 82, 32 82, 14 50 Z" ${S}/><path d="M14 50 L4 36" ${S}/><path d="M14 50 L4 64" ${S}/><circle cx="72" cy="46" r="4" fill="currentColor"/><path d="M48 26 L48 74" ${S}/><path d="M34 32 L34 68" ${S}/><path d="M62 30 L62 70" ${S}/>`,
    '鳥': `<path d="M30 56 C 30 30, 60 26, 72 40 C 84 54, 78 74, 60 80 C 48 84, 34 76, 30 56 Z" ${S}/><path d="M32 48 C 22 40, 16 34, 8 34 L18 42" ${S}/><circle cx="34" cy="44" r="3.5" fill="currentColor"/><path d="M60 80 L70 94" ${S}/><path d="M60 80 L52 94" ${S}/><path d="M44 80 L40 94" ${S}/><path d="M46 52 C 56 48, 66 52, 68 62" ${S}/>`,
    '羊': `<path d="M50 26 C 40 28, 28 20, 26 8" ${S}/><path d="M50 26 C 60 28, 72 20, 74 8" ${S}/><path d="M50 26 L50 92" ${S}/><path d="M28 48 L72 48" ${S}/><path d="M30 68 L70 68" ${S}/>`,
    '牛': `<path d="M50 32 C 38 30, 24 18, 18 6" ${S}/><path d="M50 32 C 62 30, 76 18, 82 6" ${S}/><path d="M50 32 L50 92" ${S}/><path d="M24 58 L76 58" ${S}/>`,
    '手': `<path d="M50 92 L50 54" ${S}/><path d="M50 54 L22 30" ${S}/><path d="M50 54 L36 18" ${S}/><path d="M50 54 L50 10" ${S}/><path d="M50 54 L64 18" ${S}/><path d="M50 54 L78 30" ${S}/>`,
    '心': `<path d="M50 86 C 20 62, 12 46, 22 34 C 30 24, 44 28, 50 40 C 56 28, 70 24, 78 34 C 88 46, 80 62, 50 86 Z" ${S}/><path d="M50 40 L50 62" ${S}/>`,
    '子': `<circle cx="50" cy="26" r="14" ${S}/><path d="M50 40 L50 90" ${S}/><path d="M18 58 C 30 52, 70 52, 82 58" ${S}/>`,
    '車': `<path d="M50 6 L50 94" ${S}/><path d="M30 14 L70 14 L70 32 L30 32 Z" ${S}/><path d="M30 68 L70 68 L70 86 L30 86 Z" ${S}/><path d="M36 42 L64 42 L64 58 L36 58 Z" ${S}/>`,
    '大': `<circle cx="50" cy="12" r="5" fill="currentColor"/><path d="M50 16 L50 58" ${S}/><path d="M12 36 C 30 30, 70 30, 88 36" ${S}/><path d="M50 58 L26 92" ${S}/><path d="M50 58 L74 92" ${S}/>`,
    '龜': `<path d="M50 22 C 76 22, 82 40, 82 58 C 82 76, 70 84, 50 84 C 30 84, 18 76, 18 58 C 18 40, 24 22, 50 22 Z" ${S}/><path d="M50 22 L50 84" ${S}/><path d="M28 40 C 40 46, 60 46, 72 40" ${S}/><path d="M24 62 C 40 68, 60 68, 76 62" ${S}/><path d="M46 22 C 42 12, 58 6, 60 14 C 61 18, 54 22, 50 22" ${S}/><path d="M22 42 L8 32" ${S}/><path d="M78 42 L92 32" ${S}/><path d="M22 72 L8 82" ${S}/><path d="M78 72 L92 82" ${S}/><path d="M50 84 L50 96" ${S}/>`
  };
  const CHARS = Object.keys(ART);

  let items = [];
  let idx = 0;
  let score = 0, correct = 0;
  let locked = false;
  let ui = {};

  function svg(ch) {
    return '<svg viewBox="0 0 100 100" class="morph-svg" aria-hidden="true">' + ART[ch] + '</svg>';
  }

  function open() {
    items = Mini.sample(CHARS, ROUND).map(ch => window.ZH.word(ch)).filter(Boolean);
    idx = 0; score = 0; correct = 0;
    const stage = Mini.open(api, '🏺 Ancient Pictures 象形變身');
    stage.innerHTML = `
      <div class="mini-head">${Mini.progress(1, items.length)}<div class="pill score-pill"><span class="mini-score">0</span> pts</div></div>
      <div class="morph-card">
        <div class="morph-stage">
          <div class="morph-layer morph-emoji"></div>
          <div class="morph-layer morph-ancient"></div>
          <div class="morph-layer morph-modern"></div>
        </div>
        <div class="mini-msg morph-msg"></div>
      </div>
      <div class="morph-opts"></div>
      <button class="big-btn green mini-next hidden" type="button">Next ▶</button>`;
    ui = {
      prog: stage.querySelector('.mini-progress'), score: stage.querySelector('.mini-score'),
      stage: stage.querySelector('.morph-stage'), emoji: stage.querySelector('.morph-emoji'),
      ancient: stage.querySelector('.morph-ancient'), modern: stage.querySelector('.morph-modern'),
      msg: stage.querySelector('.morph-msg'), opts: stage.querySelector('.morph-opts'),
      next: stage.querySelector('.mini-next')
    };
    ui.next.addEventListener('click', () => { Sfx.tap(); next(); });
    show();
  }

  function cur() { return items[idx]; }

  function show() {
    const w = cur();
    locked = false;
    ui.prog.textContent = (idx + 1) + ' / ' + items.length;
    ui.stage.className = 'morph-stage show-ancient';
    ui.emoji.textContent = w.pic;
    ui.ancient.innerHTML = svg(w.ch);
    ui.modern.textContent = w.ch;
    ui.next.classList.add('hidden');
    ui.msg.textContent = 'Long ago, people drew this. Which character did it become? 這個古代的圖變成哪個字？';
    const others = Mini.sample(CHARS.filter(c => c !== w.ch), 2);
    const opts = Store.shuffle([w.ch].concat(others));
    ui.opts.innerHTML = '';
    opts.forEach((ch, i) => {
      const b = Mini.h('button', 'answer-btn zh-opt morph-opt a' + i, '<span class="zh-opt-char"></span>');
      b.type = 'button';
      b.querySelector('.zh-opt-char').textContent = ch;
      b.addEventListener('click', () => answer(ch, b));
      ui.opts.appendChild(b);
    });
    Sfx.stopSpeak();
    Mini.later(() => Sfx.speak('Which character is this?'), 200);
  }

  function answer(ch, btn) {
    if (locked) return;
    locked = true;
    const w = cur();
    const right = ch === w.ch;
    [...ui.opts.children].forEach(b => {
      b.style.pointerEvents = 'none';
      if (b.querySelector('.zh-opt-char').textContent === w.ch) b.classList.add('right');
      else if (b === btn) b.classList.add('wrong');
      else b.classList.add('dimmed');
    });
    Store.noteChar(w.ch, right);
    if (right) { correct++; score += 1000; Sfx.correct(); Confetti.burst(50, window.innerHeight * 0.4); }
    else Sfx.wrong();
    ui.score.textContent = score;
    ui.msg.textContent = (right ? '🌟 Yes! ' : '👀 It was ') + w.ch + ' — watch it change! 看它變身';
    // the transformation: picture → ancient drawing → today's character
    ui.stage.className = 'morph-stage show-emoji';
    Mini.later(() => { ui.stage.className = 'morph-stage show-ancient'; }, 1100);
    Mini.later(() => {
      ui.stage.className = 'morph-stage show-modern';
      Sfx.stopSpeak(); Sfx.speakZhEn(w.ch, w.en);
      Confetti.emojiBurst([w.pic, '✨'], 8);
    }, 2200);
    ui.next.classList.remove('hidden');
    autoNext = Mini.later(next, 4600);
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
    else Mini.finish({ packId: 'zh-morph', correct, total: items.length, score, replay: open });
  }

  const api = { open, stop() { locked = true; }, ART };
  return api;
})();
