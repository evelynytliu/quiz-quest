/* Write Quest 寫字: finger-tracing practice built on the hanzi-writer engine.
   The engine and the practice stroke data load on demand (the first time the
   game is opened), and a child's own name is traced from per-character stroke
   files under data/strokes/ — so any Chinese name works, offline, once seen.
   Flow: pick a character -> watch the stroke order -> trace it yourself.
   Wrong strokes cost stars; finishing a character earns stars & coins. */
window.Writer = (function () {
  const FIRST_STAR_COINS = 6;   // finishing a character the first time
  const REPEAT_COINS = 3;       // practising it again

  // what each character means, so we can say it aloud and show a friendly hint
  const META = {
    '一': { en: 'one', pic: '1️⃣' },   '二': { en: 'two', pic: '2️⃣' },
    '三': { en: 'three', pic: '3️⃣' }, '四': { en: 'four', pic: '4️⃣' },
    '五': { en: 'five', pic: '5️⃣' },  '六': { en: 'six', pic: '6️⃣' },
    '七': { en: 'seven', pic: '7️⃣' }, '八': { en: 'eight', pic: '8️⃣' },
    '九': { en: 'nine', pic: '9️⃣' },  '十': { en: 'ten', pic: '🔟' },
    '百': { en: 'hundred', pic: '💯' }, '千': { en: 'thousand', pic: '🧮' },
    '日': { en: 'sun', pic: '☀️' },    '月': { en: 'moon', pic: '🌙' },
    '山': { en: 'mountain', pic: '⛰️' }, '水': { en: 'water', pic: '💧' },
    '火': { en: 'fire', pic: '🔥' },   '木': { en: 'tree', pic: '🌳' },
    '土': { en: 'earth', pic: '🌱' },  '田': { en: 'field', pic: '🌾' },
    '天': { en: 'sky', pic: '🌈' },    '石': { en: 'stone', pic: '🗿' },
    '雨': { en: 'rain', pic: '🌧️' },   '雲': { en: 'cloud', pic: '☁️' },
    '風': { en: 'wind', pic: '🌬️' },   '花': { en: 'flower', pic: '🌸' },
    '草': { en: 'grass', pic: '🍀' },
    '人': { en: 'person', pic: '🚶' }, '大': { en: 'big', pic: '🐘' },
    '小': { en: 'small', pic: '🐭' },  '上': { en: 'up', pic: '⬆️' },
    '下': { en: 'down', pic: '⬇️' },   '中': { en: 'middle', pic: '🎯' },
    '出': { en: 'go out', pic: '🚪' }, '入': { en: 'go in', pic: '📥' },
    '左': { en: 'left', pic: '👈' },   '右': { en: 'right', pic: '👉' },
    '口': { en: 'mouth', pic: '👄' },  '手': { en: 'hand', pic: '✋' },
    '心': { en: 'heart', pic: '❤️' },  '王': { en: 'king', pic: '👑' },
    '子': { en: 'child', pic: '👶' },  '目': { en: 'eye', pic: '👀' },
    '耳': { en: 'ear', pic: '👂' },    '足': { en: 'foot', pic: '🦶' },
    '牙': { en: 'tooth', pic: '🦷' },  '毛': { en: 'fur', pic: '🧸' },
    '爸': { en: 'dad', pic: '👨' },    '媽': { en: 'mum', pic: '👩' },
    '哥': { en: 'big brother', pic: '👦' }, '姐': { en: 'big sister', pic: '👧' },
    '弟': { en: 'little brother', pic: '🧒' }, '妹': { en: 'little sister', pic: '👶' },
    '我': { en: 'me', pic: '🙋' },     '你': { en: 'you', pic: '🫵' },
    '牛': { en: 'cow', pic: '🐮' },    '羊': { en: 'sheep', pic: '🐑' },
    '馬': { en: 'horse', pic: '🐴' },  '鳥': { en: 'bird', pic: '🐦' },
    '魚': { en: 'fish', pic: '🐟' },   '犬': { en: 'dog', pic: '🐶' },
    '兔': { en: 'rabbit', pic: '🐰' }, '蟲': { en: 'bug', pic: '🐛' },
    '白': { en: 'white', pic: '⚪' },  '黑': { en: 'black', pic: '⚫' },
    '紅': { en: 'red', pic: '🔴' },    '黃': { en: 'yellow', pic: '🟡' },
    '藍': { en: 'blue', pic: '🔵' },   '綠': { en: 'green', pic: '🟢' },
    '光': { en: 'light', pic: '💡' },  '色': { en: 'colour', pic: '🎨' }
  };
  // characters outside this list (the Builder's compound characters) take
  // their meaning from the shared bank
  function meta(ch) { return META[ch] || window.ZH.word(ch) || { en: '', pic: '' }; }
  const INK = ['#e8472f', '#4f88d6', '#3aa86a', '#9a6bd0', '#e8850c'];

  // the adventure map: characters live on themed islands
  const ISLANDS = [
    { name: '數字島 Number Island', emoji: '🔢', chars: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千'] },
    { name: '自然島 Nature Island', emoji: '🌋', chars: ['日', '月', '山', '水', '火', '木', '土', '田', '天', '石', '雨', '雲', '風', '花', '草'] },
    { name: '小人島 People Island', emoji: '🚶', chars: ['人', '大', '小', '上', '下', '中', '出', '入', '左', '右'] },
    { name: '寶貝島 Treasure Island', emoji: '👑', chars: ['口', '手', '心', '王', '子', '目', '耳', '足', '牙', '毛', '門', '車'] },
    { name: '家人島 Family Island', emoji: '👨‍👩‍👧', chars: ['爸', '媽', '哥', '姐', '弟', '妹', '我', '你'] },
    { name: '動物島 Animal Island', emoji: '🐾', chars: ['牛', '羊', '馬', '鳥', '魚', '犬', '兔', '蟲'] },
    { name: '顏色島 Colour Island', emoji: '🎨', chars: ['白', '黑', '紅', '黃', '藍', '綠', '光', '色'] },
    { name: '合體島 Combo Island', emoji: '🧩', chars: ['明', '林', '炎', '朋', '好', '休', '鳴', '男', '思', '問', '星', '女', '力', '生'] },
    { name: '三合一島 Triple Island', emoji: '✨', chars: ['森', '晶', '品', '旦', '尖', '李', '古', '聞', '泉', '岩', '仙', '里'] }
  ];

  let writer = null;       // the live hanzi-writer instance
  let current = '';        // character being practised
  let wantQuiz = false;    // they tapped the square before it finished loading
  let mode = 'idle';       // 'demo' | 'quiz' | 'idle' — the canvas is always
                           // touchable: touching it during a demo (or after
                           // finishing) jumps straight into tracing

  const el = {};
  function grab() {
    ['write-coins', 'write-picker', 'write-grid', 'write-practice', 'write-back',
     'write-char-label', 'write-word', 'write-stars', 'write-target', 'write-msg',
     'write-watch', 'write-next', 'name-modal', 'name-input', 'name-status',
     'name-save', 'name-clear'].forEach(id => {
      el[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
    });
  }

  /* ---------- loading the engine and stroke data on demand ---------- */
  // keep the cache-busting version of the page for the files we pull in later
  const VER = (function () {
    const tag = document.querySelector('script[src*="js/write.js"]');
    const m = tag && tag.src.match(/[?&]v=([^&]+)/);
    return m ? '?v=' + m[1] : '';
  })();
  const extra = {};        // stroke data for characters outside the practice set
  let enginePromise = null, basePromise = null;
  const charPromises = {};

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  function ensureEngine() {
    if (window.HanziWriter) return Promise.resolve();
    if (!enginePromise) enginePromise = loadScript('js/vendor/hanzi-writer.min.js' + VER);
    return enginePromise;
  }
  function ensureBase() {
    if (window.ZH_STROKES) return Promise.resolve();
    if (!basePromise) basePromise = loadScript('js/zh-strokes.js' + VER);
    return basePromise;
  }
  // stroke files are sharded by code point so no folder holds thousands of files
  function charUrl(ch) {
    const shard = (ch.codePointAt(0) % 64).toString(16);
    return 'data/strokes/' + (shard.length < 2 ? '0' + shard : shard) + '/'
      + encodeURIComponent(ch) + '.json';
  }
  function charData(ch) {
    return (window.ZH_STROKES && window.ZH_STROKES[ch]) || extra[ch] || null;
  }
  // resolves with the character's stroke data, or null when we have none
  function ensureChar(ch) {
    return ensureBase().then(() => {
      if (charData(ch)) return charData(ch);
      if (!charPromises[ch]) {
        charPromises[ch] = fetch(charUrl(ch))
          .then(r => (r.ok ? r.json() : null))
          .then(d => { if (d) extra[ch] = d; return d || null; })
          .catch(() => null);
      }
      return charPromises[ch];
    });
  }

  function renderCoins() { el.writeCoins.textContent = Store.getCoins(); }

  function starStr(n) { return '⭐'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n)); }

  function nameChars() { return Array.from(Store.getWriteName() || ''); }

  function stone(ch, stars) {
    const n = stars[ch] || 0;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'write-cell' + (n >= 3 ? ' mastered' : n ? ' started' : '');
    b.innerHTML = '<span class="wc-char"></span><span class="wc-stars">'
      + (n ? starStr(n) : '') + '</span>';
    b.querySelector('.wc-char').textContent = ch;
    b.addEventListener('click', () => { Sfx.tap(); enter(ch); });
    return b;
  }

  function renderGrid() {
    const stars = Store.getWriteStars();
    el.writeGrid.innerHTML = '';

    // the child's own name comes first — the most special island of all
    const mine = nameChars();
    const nameSec = document.createElement('section');
    nameSec.className = 'write-island island-mine';
    const nameHead = document.createElement('div');
    nameHead.className = 'island-head';
    nameHead.innerHTML = '<span class="island-emoji">🌟</span>'
      + '<span class="island-name">我的名字 My Name</span>'
      + (mine.length ? '<span class="island-progress">🌟 '
          + mine.filter(c => (stars[c] || 0) >= 3).length + ' / ' + mine.length + '</span>' : '')
      + '<button type="button" class="name-edit" title="家長設定名字">✏️</button>';
    nameSec.appendChild(nameHead);
    nameHead.querySelector('.name-edit').addEventListener('click', () => {
      Sfx.tap();
      // grown-ups only: the same gate that guards the question editor
      if (window.askParent) window.askParent(openNameModal); else openNameModal();
    });
    if (mine.length) {
      const trail = document.createElement('div');
      trail.className = 'island-trail';
      mine.forEach(ch => trail.appendChild(stone(ch, stars)));
      nameSec.appendChild(trail);
    } else {
      const hint = document.createElement('p');
      hint.className = 'name-empty';
      hint.textContent = '想學寫自己的名字嗎？請家長點 ✏️ 設定名字';
      nameSec.appendChild(hint);
    }
    el.writeGrid.appendChild(nameSec);

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
      island.chars.forEach(ch => trail.appendChild(stone(ch, stars)));
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
      charDataLoader: (c, done) => done(charData(c))
    });
  }

  function setMsg(t) { el.writeMsg.textContent = t || ''; }

  // every character in map order (name first), so "next" walks the whole trail
  function order() {
    return nameChars().concat([].concat.apply([], ISLANDS.map(i => i.chars)));
  }
  function nextChar() {
    const list = order();
    const i = list.indexOf(current);
    return i >= 0 && i < list.length - 1 ? list[i + 1] : '';
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
    if (writer) { try { writer.cancelQuiz(); } catch (e) {} writer = null; }
    el.writePicker.classList.add('hidden');
    el.writePractice.classList.remove('hidden');
    const m = meta(ch);
    el.writeCharLabel.textContent = ch;
    el.writeWord.textContent = m.en ? (m.pic ? m.pic + ' ' : '') + m.en : '⭐ 我的名字';
    el.writeStars.textContent = starStr(Store.getWriteStars()[ch] || 0);
    el.writeTarget.innerHTML = '';
    wantQuiz = false;
    showNext(false);
    setMsg('⏳ 準備中…');
    Promise.all([ensureEngine(), ensureChar(ch)]).then(res => {
      if (current !== ch) return;                 // they already moved on
      if (!res[1]) { setMsg('😅 這個字還沒有筆順資料，先玩別的字吧！'); return; }
      makeWriter(ch);
      Sfx.stopSpeak();
      Sfx.speakZh(ch);
      // a child who already tapped the square wants to write, not watch
      if (wantQuiz) quiz(); else demo();
    }).catch(() => {
      if (current === ch) setMsg('😅 載入失敗，請檢查網路再試一次');
    });
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
        const m = meta(current);
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
    current = '';
    Sfx.stopSpeak();
    el.writePractice.classList.add('hidden');
    el.writePicker.classList.remove('hidden');
    renderGrid();
  }

  /* ---------- the name a grown-up sets for this player ---------- */
  function openNameModal() {
    el.nameInput.value = Store.getWriteName() || '';
    el.nameStatus.textContent = '';
    el.nameStatus.className = 'name-status';
    el.nameModal.classList.remove('hidden');
    setTimeout(() => el.nameInput.focus(), 50);
  }
  function closeNameModal() { el.nameModal.classList.add('hidden'); }

  function saveName() {
    const raw = (el.nameInput.value || '').replace(/\s+/g, '');
    if (!raw) { el.nameStatus.textContent = '請先輸入名字'; return; }
    const chars = Array.from(raw);
    if (chars.length > 5) { el.nameStatus.textContent = '名字最多 5 個字'; return; }
    const bad = chars.filter(c => !/[㐀-鿿]/.test(c));
    if (bad.length) { el.nameStatus.textContent = '請輸入中文字（' + bad.join('') + ' 沒辦法寫）'; return; }
    el.nameStatus.textContent = '檢查筆順資料中…';
    el.nameSave.disabled = true;
    Promise.all(chars.map(ensureChar)).then(list => {
      el.nameSave.disabled = false;
      const missing = chars.filter((c, i) => !list[i]);
      if (missing.length) {
        el.nameStatus.textContent = '「' + missing.join('、') + '」暫時沒有筆順資料，請換個寫法或先用其他字';
        return;
      }
      Store.setWriteName(raw);
      closeNameModal();
      renderGrid();
      Sfx.fanfare();
      Confetti.emojiBurst(['🌟', '✨'], 12);
    }).catch(() => {
      el.nameSave.disabled = false;
      el.nameStatus.textContent = '載入筆順資料失敗，請檢查網路再試一次';
    });
  }

  function clearName() {
    Store.setWriteName('');
    closeNameModal();
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
    ensureEngine().catch(() => {});   // warm up while they choose a character
    ensureBase().catch(() => {});
  }

  function init() {
    grab();
    el.writeBack.addEventListener('click', () => { Sfx.tap(); back(); });
    el.writeWatch.addEventListener('click', () => { Sfx.tap(); demo(); });
    el.writeNext.addEventListener('click', () => { Sfx.tap(); goNext(); });
    el.nameSave.addEventListener('click', () => { Sfx.tap(); saveName(); });
    el.nameClear.addEventListener('click', () => { Sfx.tap(); clearName(); });
    el.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });
    // touching the square is always an invitation to write: it skips the
    // demo, and after a finished character it starts another round
    el.writeTarget.addEventListener('pointerdown', () => {
      if (writer) { if (mode !== 'quiz') quiz(); }
      else if (current) wantQuiz = true;     // still loading — start writing as soon as it is ready
    });
    // re-fit the writing square when the tablet is rotated
    window.addEventListener('resize', () => {
      if (writer && current && !el.writePractice.classList.contains('hidden') && mode !== 'quiz') {
        makeWriter(current);
        demo();
      }
    });
  }

  return { init, open, ensureEngine, ensureBase, ensureChar, charData };
})();
