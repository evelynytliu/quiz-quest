/* Write Quest 寫字: finger-tracing practice built on the bundled hanzi-writer
   engine (js/vendor/hanzi-writer.min.js + js/zh-strokes.js, no network needed).
   Flow: pick a character -> watch the stroke order dance -> trace it yourself.
   Wrong strokes get gentle hints; finishing a character earns stars & coins. */
window.Writer = (function () {
  const FIRST_STAR_COINS = 6;   // finishing a character the first time
  const REPEAT_COINS = 3;       // practising it again

  // what each character means, so we can say it aloud and show a friendly hint
  const META = {
    '一': { en: 'one', pic: '1️⃣' },  '二': { en: 'two', pic: '2️⃣' },
    '三': { en: 'three', pic: '3️⃣' }, '四': { en: 'four', pic: '4️⃣' },
    '五': { en: 'five', pic: '5️⃣' },  '六': { en: 'six', pic: '6️⃣' },
    '七': { en: 'seven', pic: '7️⃣' }, '八': { en: 'eight', pic: '8️⃣' },
    '九': { en: 'nine', pic: '9️⃣' },  '十': { en: 'ten', pic: '🔟' },
    '人': { en: 'person', pic: '🚶' }, '大': { en: 'big', pic: '🐘' },
    '小': { en: 'small', pic: '🐭' },  '上': { en: 'up', pic: '⬆️' },
    '下': { en: 'down', pic: '⬇️' },   '中': { en: 'middle', pic: '🎯' },
    '日': { en: 'sun', pic: '☀️' },    '月': { en: 'moon', pic: '🌙' },
    '山': { en: 'mountain', pic: '⛰️' }, '水': { en: 'water', pic: '💧' },
    '火': { en: 'fire', pic: '🔥' },   '木': { en: 'tree', pic: '🌳' },
    '土': { en: 'earth', pic: '🌱' },  '田': { en: 'field', pic: '🌾' },
    '口': { en: 'mouth', pic: '👄' },  '手': { en: 'hand', pic: '✋' },
    '心': { en: 'heart', pic: '❤️' },  '天': { en: 'sky', pic: '🌈' },
    '王': { en: 'king', pic: '👑' },   '子': { en: 'child', pic: '👶' }
  };
  const CHARS = Object.keys(window.ZH_STROKES || {});
  const INK = ['#e8472f', '#4f88d6', '#3aa86a', '#9a6bd0', '#e8850c'];

  // the adventure map: characters live on themed islands
  const ISLANDS = [
    { name: '數字島 Number Island',   emoji: '🔢', chars: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] },
    { name: '自然島 Nature Island',   emoji: '🌋', chars: ['日', '月', '山', '水', '火', '木', '土', '田', '天'] },
    { name: '小人島 People Island',   emoji: '🚶', chars: ['人', '大', '小', '上', '下', '中'] },
    { name: '寶貝島 Treasure Island', emoji: '👑', chars: ['口', '手', '心', '王', '子'] }
  ];

  let writer = null;       // the live hanzi-writer instance
  let current = '';        // character being practised
  let mode = 'idle';       // 'demo' | 'quiz' | 'idle' — the canvas is always
                           // touchable: touching it during a demo (or after
                           // finishing) jumps straight into tracing

  const el = {};
  function grab() {
    ['write-coins', 'write-picker', 'write-grid', 'write-practice', 'write-back',
     'write-char-label', 'write-word', 'write-stars', 'write-target', 'write-msg',
     'write-watch', 'write-next'].forEach(id => {
      el[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
    });
  }

  function renderCoins() { el.writeCoins.textContent = Store.getCoins(); }

  function starStr(n) { return '⭐'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n)); }

  function renderGrid() {
    const stars = Store.getWriteStars();
    el.writeGrid.innerHTML = '';
    ISLANDS.forEach((island, i) => {
      const sec = document.createElement('section');
      sec.className = 'write-island island-' + i;
      const mastered = island.chars.filter(c => (stars[c] || 0) >= 3).length;
      const head = document.createElement('div');
      head.className = 'island-head';
      head.innerHTML = '<span class="island-emoji">' + island.emoji + '</span>'
        + '<span class="island-name">' + island.name + '</span>'
        + '<span class="island-progress">🌟 ' + mastered + ' / ' + island.chars.length + '</span>';
      sec.appendChild(head);
      const trail = document.createElement('div');
      trail.className = 'island-trail';
      island.chars.forEach(ch => {
        const n = stars[ch] || 0;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'write-cell' + (n >= 3 ? ' mastered' : n ? ' started' : '');
        b.innerHTML = '<span class="wc-char">' + ch + '</span>'
          + '<span class="wc-stars">' + (n ? starStr(n) : '') + '</span>';
        b.addEventListener('click', () => { Sfx.tap(); enter(ch); });
        trail.appendChild(b);
      });
      sec.appendChild(trail);
      el.writeGrid.appendChild(sec);
    });
  }

  function targetSize() {
    // a comfy square that fits phones and big tablets alike
    return Math.round(Math.min(Math.min(window.innerWidth, 720) * 0.72, window.innerHeight * 0.46, 380));
  }

  function makeWriter(ch) {
    el.writeTarget.innerHTML = '';
    const size = targetSize();
    el.writeTarget.style.width = size + 'px';
    el.writeTarget.style.height = size + 'px';
    writer = HanziWriter.create('write-target', ch, {
      width: size, height: size, padding: Math.round(size * 0.08),
      showCharacter: false,
      showOutline: true,
      strokeColor: '#e8472f',
      outlineColor: '#f3e3d2',
      drawingColor: INK[Math.floor(Math.random() * INK.length)],
      drawingWidth: 22,
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      highlightColor: '#f3c64c',
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 350,
      charDataLoader: (c, done) => done(window.ZH_STROKES[c])
    });
  }

  function setMsg(t) { el.writeMsg.textContent = t || ''; }

  // all characters in map order, so "next" walks the adventure trail
  const ORDER = [].concat.apply([], ISLANDS.map(i => i.chars));
  function nextChar() {
    const i = ORDER.indexOf(current);
    return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : '';
  }
  function showNext(show) {
    if (!el.writeNext) return;
    const nx = nextChar();
    el.writeNext.textContent = nx ? '▶ Next 下一個字：' + nx : '🏁 All done! 回地圖';
    el.writeNext.classList.toggle('hidden', !show);
  }

  function enter(ch) {
    current = ch;
    mode = 'idle';
    el.writePicker.classList.add('hidden');
    el.writePractice.classList.remove('hidden');
    const m = META[ch] || { en: '', pic: '' };
    el.writeCharLabel.textContent = ch;
    el.writeWord.textContent = (m.pic ? m.pic + ' ' : '') + m.en;
    el.writeStars.textContent = starStr(Store.getWriteStars()[ch] || 0);
    showNext(false);
    makeWriter(ch);
    Sfx.stopSpeak();
    Sfx.speakZh(ch);
    demo();
  }

  function demo() {
    if (!writer) return;
    mode = 'demo';
    showNext(false);
    try { writer.cancelQuiz(); } catch (e) {}
    setMsg('👀 Watch how ' + current + ' is written — or just start tracing!');
    writer.animateCharacter({
      onComplete: () => {
        // straight into tracing, no button needed
        if (mode === 'demo') quiz();
      }
    });
  }

  function quiz() {
    if (!writer) return;
    mode = 'quiz';
    showNext(false);
    writer.hideCharacter();
    setMsg('✍️ Your turn — trace each stroke with your finger!');
    Sfx.speakZh(current);
    let misses = 0;                 // wrong strokes = fewer stars
    writer.quiz({
      onCorrectStroke: () => Sfx.pop(),
      onMistake: () => { misses++; Sfx.tap(); },
      onComplete: () => {
        mode = 'idle';
        // grade this attempt: careful writing earns more stars
        const grade = misses === 0 ? 3 : misses <= 2 ? 2 : 1;
        const prev = Store.getWriteStars()[current] || 0;
        const n = Store.setWriteStars(current, grade);
        const coins = prev === 0 ? FIRST_STAR_COINS : REPEAT_COINS;
        Store.addCoins(coins);
        Store.logWrite(current);
        const quest = Store.bumpQuest('write', 1);
        Sfx.fanfare(); Sfx.coin();
        Confetti.burst(70, window.innerHeight * 0.4);
        if (grade === 3) Confetti.emojiBurst(['✨', '🌟'], 14);
        el.writeStars.textContent = starStr(n);
        const praise = grade === 3 ? '🌟 Perfect writing! 完美！'
          : grade === 2 ? '🎉 Great writing! 很棒！'
          : '💪 Done! Write it again for more stars 再寫一次拿更多星！';
        setMsg(praise + '  +💰' + coins
          + (quest.length ? '  ·  🎯 Daily quest done! +💰' + quest[0].reward : ''));
        const m = META[current] || {};
        Sfx.speakZhEn(current, m.en);
        renderCoins();
        showNext(true);            // one tap goes on to the next character
      }
    });
  }

  function goNext() {
    const nx = nextChar();
    if (nx) enter(nx); else back();
  }

  function back() {
    if (writer) { try { writer.cancelQuiz(); } catch (e) {} }
    mode = 'idle';
    Sfx.stopSpeak();
    el.writePractice.classList.add('hidden');
    el.writePicker.classList.remove('hidden');
    renderGrid();
  }

  function open() {
    Sfx.resume();
    Game.stop();
    renderCoins();
    renderGrid();
    el.writePractice.classList.add('hidden');
    el.writePicker.classList.remove('hidden');
    showScreen('write');
  }

  function init() {
    grab();
    el.writeBack.addEventListener('click', () => { Sfx.tap(); back(); });
    el.writeWatch.addEventListener('click', () => { Sfx.tap(); demo(); });
    el.writeNext.addEventListener('click', () => { Sfx.tap(); goNext(); });
    // touching the square is always an invitation to write: it skips the
    // demo, and after a finished character it starts another round
    el.writeTarget.addEventListener('pointerdown', () => {
      if (mode !== 'quiz') quiz();
    });
    // re-fit the writing square when the tablet is rotated
    window.addEventListener('resize', () => {
      if (current && !el.writePractice.classList.contains('hidden') && mode !== 'quiz') {
        makeWriter(current);
        demo();
      }
    });
  }

  return { init, open };
})();
