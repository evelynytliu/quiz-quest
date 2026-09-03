/* Persistence layer. Everything lives in localStorage so the parent's custom
   questions survive page reloads. Export/import lets them back up & move
   between devices. */
window.Store = (function () {
  const KEY = 'milesQuiz.v1';
  const SCORE_KEY = 'milesQuiz.best.v2';      // best scores, now keyed per player
  const PLAYERS_KEY = 'milesQuiz.players.v1'; // list of player names
  const CURRENT_KEY = 'milesQuiz.current.v1'; // the active player's name
  const SEEDED_KEY = 'milesQuiz.seeded.v1';   // signatures of seed questions already merged
  const SEEDED_PACKS_KEY = 'milesQuiz.seededPacks.v1';
  const COINS_KEY = 'milesQuiz.coins.v1';     // prize-machine coins, per player
  const STICKERS_KEY = 'milesQuiz.stickers.v1'; // collected stickers, per player
  const BUDDY_KEY = 'milesQuiz.buddy.v1';     // chosen buddy sticker, per player
  const WRITE_KEY = 'milesQuiz.write.v1';     // Write Quest stars, per player

  let data = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { data = JSON.parse(raw); }
    } catch (e) { /* ignore corrupt storage */ }
    if (!data || !Array.isArray(data.packs)) {
      data = clone(window.SEED);
      // give seed questions ids
      data.questions.forEach(q => { if (!q.id) q.id = uid(); });
      save();
    }
    mergeSeed();      // pull in any new default questions/packs added since last time
    removeRetiredPacks();
    relaxTimes();
    migrateWriteChars();
    migratePlayers();
    return data;
  }

  // one-time bump to the relaxed 30-second pace for questions stored before
  // the change; parents can still tune per-question times in the editor after
  const TIME30_KEY = 'milesQuiz.time30.v1';
  function relaxTimes() {
    try { if (localStorage.getItem(TIME30_KEY)) return; } catch (e) {}
    let changed = false;
    data.questions.forEach(q => { if (!q.time || q.time < 30) { q.time = 30; changed = true; } });
    if (changed) save();
    try { localStorage.setItem(TIME30_KEY, '1'); } catch (e) {}
  }

  // characters whose form was corrected after release: move any stars the
  // child already earned onto the character we now teach
  const CHAR_FIX_KEY = 'milesQuiz.charFix.v1';
  const CHAR_FIXES = { '虫': '蟲' };
  function migrateWriteChars() {
    try { if (localStorage.getItem(CHAR_FIX_KEY)) return; } catch (e) {}
    const all = readJSON(WRITE_KEY, {});
    let changed = false;
    Object.keys(all).forEach(player => {
      const stars = all[player] || {};
      Object.keys(CHAR_FIXES).forEach(from => {
        const to = CHAR_FIXES[from];
        if (stars[from] == null) return;
        stars[to] = Math.max(stars[to] || 0, stars[from]);
        delete stars[from];
        changed = true;
      });
    });
    if (changed) writeJSON(WRITE_KEY, all);
    try { localStorage.setItem(CHAR_FIX_KEY, '1'); } catch (e) {}
  }

  // default packs that were retired from the seed: clear them off devices
  // that still carry them (questions included)
  function removeRetiredPacks() {
    const gone = (window.SEED && window.SEED.removedPacks) || [];
    if (!gone.length) return;
    const before = data.packs.length + data.questions.length;
    data.packs = data.packs.filter(p => gone.indexOf(p.id) < 0);
    data.questions = data.questions.filter(q => gone.indexOf(q.packId) < 0);
    if (data.packs.length + data.questions.length !== before) save();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  // stable content fingerprint of a question, so we can tell which seed
  // questions are already present without relying on ids.
  function qSig(q) {
    return q.packId + '||' + (q.text || '') + '||' + (q.emoji || '') + '||' + (q.options || []).join('|');
  }

  // Add default questions/packs that aren't on this device yet, without
  // touching the parent's custom questions or re-adding ones they deleted.
  function mergeSeed() {
    if (!window.SEED) return;

    let seededArr = null, packsArr = null;
    try { seededArr = JSON.parse(localStorage.getItem(SEEDED_KEY) || 'null'); } catch (e) {}
    try { packsArr = JSON.parse(localStorage.getItem(SEEDED_PACKS_KEY) || 'null'); } catch (e) {}
    const firstRun = !Array.isArray(seededArr);
    const firstRunPacks = !Array.isArray(packsArr);
    const seeded = new Set(firstRun ? [] : seededArr);
    const seededPacks = new Set(firstRunPacks ? [] : packsArr);
    let changed = false;

    // new default packs (packs already have stable ids)
    const havePack = new Set(data.packs.map(p => p.id));
    window.SEED.packs.forEach(sp => {
      const known = seededPacks.has(sp.id) || (firstRunPacks && havePack.has(sp.id));
      if (!known && !havePack.has(sp.id)) { data.packs.push(clone(sp)); havePack.add(sp.id); changed = true; }
      seededPacks.add(sp.id);
    });

    // keep default packs' metadata current on devices that stored an older
    // copy (e.g. the lang tag that shelves Chinese games separately)
    window.SEED.packs.forEach(sp => {
      const p = data.packs.find(x => x.id === sp.id);
      if (!p) return;
      ['name', 'emoji', 'color', 'lang', 'generated'].forEach(k => {
        if (sp[k] !== undefined && p[k] !== sp[k]) { p[k] = sp[k]; changed = true; }
      });
    });

    // new default questions
    const haveSig = new Set(data.questions.map(qSig));
    window.SEED.questions.forEach(sq => {
      const k = qSig(sq);
      const known = seeded.has(k) || (firstRun && haveSig.has(k));
      if (!known && !haveSig.has(k)) {
        const copy = clone(sq); copy.id = uid();
        data.questions.push(copy); haveSig.add(k); changed = true;
      }
      seeded.add(k);
    });

    try { localStorage.setItem(SEEDED_KEY, JSON.stringify(Array.from(seeded))); } catch (e) {}
    try { localStorage.setItem(SEEDED_PACKS_KEY, JSON.stringify(Array.from(seededPacks))); } catch (e) {}
    if (changed) save();
  }

  function getPacks() { return data.packs; }

  function getPack(id) { return data.packs.find(p => p.id === id); }

  function questionsFor(packId) {
    return data.questions.filter(q => q.packId === packId);
  }

  function allQuestions() { return data.questions; }

  function countFor(packId) {
    const p = getPack(packId);
    if (p && p.generated) return Infinity;
    return questionsFor(packId).length;
  }

  /* ---------- editing ---------- */
  function upsertQuestion(q) {
    if (q.id) {
      const i = data.questions.findIndex(x => x.id === q.id);
      if (i >= 0) { data.questions[i] = q; }
      else { data.questions.push(q); }
    } else {
      q.id = uid();
      data.questions.push(q);
    }
    save();
    return q;
  }

  function deleteQuestion(id) {
    data.questions = data.questions.filter(q => q.id !== id);
    save();
  }

  function addPack(name, emoji) {
    const id = 'p' + uid();
    const colors = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    const color = colors[data.packs.length % colors.length];
    data.packs.push({ id, name, emoji: emoji || '⭐', color });
    save();
    return id;
  }

  function deletePack(id) {
    const p = getPack(id);
    if (!p || p.generated) return;
    data.packs = data.packs.filter(x => x.id !== id);
    data.questions = data.questions.filter(q => q.packId !== id);
    save();
  }

  /* ---------- backup ---------- */
  function exportJSON() { return JSON.stringify(data, null, 2); }

  function importJSON(text) {
    const incoming = JSON.parse(text);
    if (!incoming.packs || !incoming.questions) throw new Error('格式不正確');
    incoming.questions.forEach(q => { if (!q.id) q.id = uid(); });
    data = incoming;
    save();
  }

  function resetDefaults() {
    data = clone(window.SEED);
    data.questions.forEach(q => { if (!q.id) q.id = uid(); });
    save();
  }

  /* ---------- math machine: generate questions on the fly ---------- */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  // Return a play-copy of a question with its multiple-choice options shuffled,
  // so the correct answer isn't always in the same position. True/False keep
  // their natural order. Never mutates the stored question.
  function shuffleOptions(q) {
    if (q.type === 'tf') return q;
    const correctText = q.options[q.correct];
    const opts = shuffle(q.options.slice());
    return Object.assign({}, q, { options: opts, correct: opts.indexOf(correctText) });
  }

  function makeMathQuestion(level) {
    let a, b, op, answer;
    if (level === 1) {
      // small numbers, no carrying / borrowing
      op = Math.random() < 0.5 ? '+' : '−';
      if (op === '+') { a = rnd(2, 9); b = rnd(2, 9); answer = a + b; }
      else { a = rnd(5, 18); b = rnd(1, a - 1); answer = a - b; }
    } else if (level === 2) {
      // 3-digit, no carrying / no borrowing (digit-wise safe)
      op = Math.random() < 0.5 ? '+' : '−';
      if (op === '+') {
        const h1 = rnd(1, 4), t1 = rnd(0, 4), o1 = rnd(0, 4);
        const h2 = rnd(1, 9 - h1), t2 = rnd(0, 9 - t1), o2 = rnd(0, 9 - o1);
        a = h1 * 100 + t1 * 10 + o1; b = h2 * 100 + t2 * 10 + o2; answer = a + b;
      } else {
        const h1 = rnd(4, 9), t1 = rnd(2, 9), o1 = rnd(2, 9);
        const h2 = rnd(1, h1 - 1), t2 = rnd(0, t1), o2 = rnd(0, o1);
        a = h1 * 100 + t1 * 10 + o1; b = h2 * 100 + t2 * 10 + o2; answer = a - b;
      }
    } else {
      // challenge: 2-digit WITH carrying / borrowing (gentle practice)
      op = Math.random() < 0.5 ? '+' : '−';
      if (op === '+') {
        do { a = rnd(15, 89); b = rnd(15, 89); } while ((a % 10) + (b % 10) < 10);
        answer = a + b;
      } else {
        do { a = rnd(31, 99); b = rnd(12, a - 5); } while ((a % 10) >= (b % 10));
        answer = a - b;
      }
    }

    // build 3 distractors close to the answer
    const opts = new Set([answer]);
    let guard = 0;
    while (opts.size < 4 && guard++ < 50) {
      const delta = rnd(-9, 9);
      const cand = answer + delta;
      if (cand >= 0 && cand !== answer) opts.add(cand);
    }
    const options = shuffle([...opts]).map(String);
    const correct = options.indexOf(String(answer));

    return {
      id: uid(),
      packId: 'math-machine',
      type: 'mc',
      emoji: '🧮',
      text: `${a} ${op} ${b} = ?`,
      speak: `${a} ${op === '+' ? 'plus' : 'minus'} ${b}. What is the answer?`,
      math: { a, b, op },
      options,
      correct,
      time: 30,
      level
    };
  }

  function generateMath(level, n) {
    const out = [];
    const seen = new Set();
    let guard = 0;
    while (out.length < n && guard++ < 200) {
      const q = makeMathQuestion(level);
      if (seen.has(q.text)) continue;
      seen.add(q.text);
      out.push(q);
    }
    return out;
  }

  /* ---------- character quest: generate Chinese reading questions ----------
     Word bank for kids who can't read characters yet. Three game modes:
       - zhpic:  see the character (spoken aloud) -> tap the matching picture
       - see:    see a picture + hear the word    -> tap the matching character
       - listen: hear the word only               -> tap the matching character
     No reading required: everything is taught by sound and pictures.
     (Pictures stick to older emoji so they render on more devices.) */
  const ZH_WORDS = [
    /* level 1 — first words */
    { ch: '一', en: 'one',   pic: '1️⃣', lv: 1 },
    { ch: '二', en: 'two',   pic: '2️⃣', lv: 1 },
    { ch: '三', en: 'three', pic: '3️⃣', lv: 1 },
    { ch: '日', en: 'sun',   pic: '☀️', lv: 1 },
    { ch: '月', en: 'moon',  pic: '🌙', lv: 1 },
    { ch: '水', en: 'water', pic: '💧', lv: 1 },
    { ch: '火', en: 'fire',  pic: '🔥', lv: 1 },
    { ch: '山', en: 'mountain', pic: '⛰️', lv: 1 },
    { ch: '木', en: 'tree',  pic: '🌳', lv: 1 },
    { ch: '口', en: 'mouth', pic: '👄', lv: 1 },
    { ch: '手', en: 'hand',  pic: '✋', lv: 1 },
    { ch: '人', en: 'person', pic: '🚶', lv: 1 },
    { ch: '大', en: 'big',   pic: '',   lv: 1 },
    { ch: '小', en: 'small', pic: '',   lv: 1 },
    /* level 2 — more words */
    { ch: '四', en: 'four',  pic: '4️⃣', lv: 2 },
    { ch: '五', en: 'five',  pic: '5️⃣', lv: 2 },
    { ch: '狗', en: 'dog',   pic: '🐶', lv: 2 },
    { ch: '貓', en: 'cat',   pic: '🐱', lv: 2 },
    { ch: '魚', en: 'fish',  pic: '🐟', lv: 2 },
    { ch: '鳥', en: 'bird',  pic: '🐦', lv: 2 },
    { ch: '牛', en: 'cow',   pic: '🐮', lv: 2 },
    { ch: '馬', en: 'horse', pic: '🐴', lv: 2 },
    { ch: '羊', en: 'sheep', pic: '🐑', lv: 2 },
    { ch: '豬', en: 'pig',   pic: '🐷', lv: 2 },
    { ch: '雞', en: 'chicken', pic: '🐔', lv: 2 },
    { ch: '鴨', en: 'duck',  pic: '🦆', lv: 2 },
    { ch: '熊', en: 'bear',  pic: '🐻', lv: 2 },
    { ch: '虎', en: 'tiger', pic: '🐯', lv: 2 },
    { ch: '花', en: 'flower', pic: '🌸', lv: 2 },
    { ch: '雨', en: 'rain',  pic: '🌧️', lv: 2 },
    { ch: '星', en: 'star',  pic: '⭐', lv: 2 },
    { ch: '車', en: 'car',   pic: '🚗', lv: 2 },
    { ch: '家', en: 'home',  pic: '🏠', lv: 2 },
    { ch: '球', en: 'ball',  pic: '⚽', lv: 2 },
    { ch: '果', en: 'fruit', pic: '🍎', lv: 2 },
    { ch: '好', en: 'good',  pic: '👍', lv: 2 },
    { ch: '上', en: 'up',    pic: '',   lv: 2 },
    { ch: '下', en: 'down',  pic: '',   lv: 2 },
    { ch: '天', en: 'sky',   pic: '',   lv: 2 },
    /* level 3 — word master */
    { ch: '六', en: 'six',   pic: '6️⃣', lv: 3 },
    { ch: '七', en: 'seven', pic: '7️⃣', lv: 3 },
    { ch: '八', en: 'eight', pic: '8️⃣', lv: 3 },
    { ch: '九', en: 'nine',  pic: '9️⃣', lv: 3 },
    { ch: '十', en: 'ten',   pic: '🔟', lv: 3 },
    { ch: '兔', en: 'rabbit', pic: '🐰', lv: 3 },
    { ch: '蟲', en: 'bug',   pic: '🐛', lv: 3 },
    { ch: '草', en: 'grass', pic: '🌱', lv: 3 },
    { ch: '雪', en: 'snow',  pic: '❄️', lv: 3 },
    { ch: '雲', en: 'cloud', pic: '☁️', lv: 3 },
    { ch: '門', en: 'door',  pic: '🚪', lv: 3 },
    { ch: '書', en: 'book',  pic: '📖', lv: 3 },
    { ch: '筆', en: 'pen',   pic: '✏️', lv: 3 },
    { ch: '蛋', en: 'egg',   pic: '🥚', lv: 3 },
    { ch: '米', en: 'rice',  pic: '🍚', lv: 3 },
    { ch: '瓜', en: 'melon', pic: '🍉', lv: 3 },
    { ch: '目', en: 'eye',   pic: '👀', lv: 3 },
    { ch: '耳', en: 'ear',   pic: '👂', lv: 3 },
    { ch: '心', en: 'heart', pic: '❤️', lv: 3 },
    { ch: '王', en: 'king',  pic: '👑', lv: 3 },
    { ch: '象', en: 'elephant', pic: '🐘', lv: 3 },
    { ch: '猴', en: 'monkey', pic: '🐵', lv: 3 },
    { ch: '龍', en: 'dragon', pic: '🐉', lv: 3 },
    { ch: '蛇', en: 'snake', pic: '🐍', lv: 3 },
    { ch: '龜', en: 'turtle', pic: '🐢', lv: 3 },
    { ch: '蝶', en: 'butterfly', pic: '🦋', lv: 3 },
    { ch: '茶', en: 'tea',   pic: '🍵', lv: 3 },
    { ch: '肉', en: 'meat',  pic: '🍖', lv: 3 },
    { ch: '電', en: 'electricity', pic: '⚡', lv: 3 },
    { ch: '風', en: 'wind',  pic: '🌬️', lv: 3 },
    { ch: '燈', en: 'lamp',  pic: '💡', lv: 3 },
    { ch: '白', en: 'white', pic: '⚪', lv: 3 },
    { ch: '黑', en: 'black', pic: '⚫', lv: 3 },
    { ch: '紅', en: 'red',   pic: '🔴', lv: 3 },
    { ch: '藍', en: 'blue',  pic: '🔵', lv: 3 },
    { ch: '鞋', en: 'shoe',  pic: '👟', lv: 3 },
    { ch: '愛', en: 'love',  pic: '💖', lv: 3 }
  ];

  /* characters that sound exactly the same (mù) — keep them out of each
     other's answer rows in the sound-based modes, where the ear can't
     tell them apart */
  const ZH_HOMOPHONES = [['木', '目']];
  function zhSameSound(a, b) {
    return ZH_HOMOPHONES.some(g => g.indexOf(a) >= 0 && g.indexOf(b) >= 0);
  }

  /* ---------- word quest: two-character words ----------
     Same three game modes as Character Quest, but with 詞語 instead of
     single characters. Two-character words all sound different from each
     other, so Mandarin's many homophones stop being a problem — and kids
     learn characters the way they're actually used. */
  const ZH_WORDS2 = [
    /* level 1 — first words */
    { ch: '太陽', en: 'sun',      pic: '☀️', lv: 1 },
    { ch: '月亮', en: 'moon',     pic: '🌙', lv: 1 },
    { ch: '星星', en: 'star',     pic: '⭐', lv: 1 },
    { ch: '小狗', en: 'dog',      pic: '🐶', lv: 1 },
    { ch: '小貓', en: 'cat',      pic: '🐱', lv: 1 },
    { ch: '小鳥', en: 'bird',     pic: '🐦', lv: 1 },
    { ch: '大象', en: 'elephant', pic: '🐘', lv: 1 },
    { ch: '老虎', en: 'tiger',    pic: '🐯', lv: 1 },
    { ch: '兔子', en: 'rabbit',   pic: '🐰', lv: 1 },
    { ch: '火車', en: 'train',    pic: '🚂', lv: 1 },
    { ch: '汽車', en: 'car',      pic: '🚗', lv: 1 },
    { ch: '蘋果', en: 'apple',    pic: '🍎', lv: 1 },
    { ch: '香蕉', en: 'banana',   pic: '🍌', lv: 1 },
    { ch: '雨傘', en: 'umbrella', pic: '☔', lv: 1 },
    { ch: '房子', en: 'house',    pic: '🏠', lv: 1 },
    /* level 2 — more words */
    { ch: '恐龍', en: 'dinosaur', pic: '🦖', lv: 2 },
    { ch: '熊貓', en: 'panda',    pic: '🐼', lv: 2 },
    { ch: '猴子', en: 'monkey',   pic: '🐵', lv: 2 },
    { ch: '鴨子', en: 'duck',     pic: '🦆', lv: 2 },
    { ch: '青蛙', en: 'frog',     pic: '🐸', lv: 2 },
    { ch: '烏龜', en: 'turtle',   pic: '🐢', lv: 2 },
    { ch: '蜜蜂', en: 'bee',      pic: '🐝', lv: 2 },
    { ch: '飛機', en: 'airplane', pic: '✈️', lv: 2 },
    { ch: '下雨', en: 'rain',     pic: '🌧️', lv: 2 },
    { ch: '雪人', en: 'snowman',  pic: '⛄', lv: 2 },
    { ch: '彩虹', en: 'rainbow',  pic: '🌈', lv: 2 },
    { ch: '眼睛', en: 'eyes',     pic: '👀', lv: 2 },
    { ch: '耳朵', en: 'ear',      pic: '👂', lv: 2 },
    { ch: '鼻子', en: 'nose',     pic: '👃', lv: 2 },
    { ch: '嘴巴', en: 'mouth',    pic: '👄', lv: 2 },
    { ch: '牛奶', en: 'milk',     pic: '🥛', lv: 2 },
    { ch: '雞蛋', en: 'egg',      pic: '🥚', lv: 2 },
    { ch: '西瓜', en: 'watermelon', pic: '🍉', lv: 2 },
    { ch: '草莓', en: 'strawberry', pic: '🍓', lv: 2 },
    { ch: '麵包', en: 'bread',    pic: '🍞', lv: 2 },
    /* level 3 — word master */
    { ch: '蝴蝶', en: 'butterfly', pic: '🦋', lv: 3 },
    { ch: '蜘蛛', en: 'spider',   pic: '🕷️', lv: 3 },
    { ch: '鯊魚', en: 'shark',    pic: '🦈', lv: 3 },
    { ch: '海豚', en: 'dolphin',  pic: '🐬', lv: 3 },
    { ch: '企鵝', en: 'penguin',  pic: '🐧', lv: 3 },
    { ch: '獅子', en: 'lion',     pic: '🦁', lv: 3 },
    { ch: '斑馬', en: 'zebra',    pic: '🦓', lv: 3 },
    { ch: '火山', en: 'volcano',  pic: '🌋', lv: 3 },
    { ch: '地球', en: 'Earth',    pic: '🌍', lv: 3 },
    { ch: '火箭', en: 'rocket',   pic: '🚀', lv: 3 },
    { ch: '足球', en: 'soccer ball', pic: '⚽', lv: 3 },
    { ch: '籃球', en: 'basketball', pic: '🏀', lv: 3 },
    { ch: '電話', en: 'telephone', pic: '📞', lv: 3 },
    { ch: '電燈', en: 'lamp',     pic: '💡', lv: 3 },
    { ch: '電視', en: 'TV',       pic: '📺', lv: 3 },
    { ch: '書包', en: 'backpack', pic: '🎒', lv: 3 },
    { ch: '鉛筆', en: 'pencil',   pic: '✏️', lv: 3 },
    { ch: '剪刀', en: 'scissors', pic: '✂️', lv: 3 },
    { ch: '帽子', en: 'hat',      pic: '🎩', lv: 3 },
    { ch: '鞋子', en: 'shoes',    pic: '👟', lv: 3 },
    { ch: '皇冠', en: 'crown',    pic: '👑', lv: 3 },
    { ch: '禮物', en: 'present',  pic: '🎁', lv: 3 },
    { ch: '蛋糕', en: 'cake',     pic: '🎂', lv: 3 },
    { ch: '糖果', en: 'candy',    pic: '🍬', lv: 3 }
  ];

  function makeZhQuestion(w, bank, level, packId) {
    const others = shuffle(bank.filter(x => x.ch !== w.ch).slice());
    // easier levels lean on pictures; word masters get more listening
    const r = Math.random();
    let mode;
    if (!w.pic) mode = 'listen';
    else if (level === 1) mode = r < 0.5 ? 'pic' : r < 0.85 ? 'see' : 'listen';
    else if (level === 2) mode = r < 0.4 ? 'pic' : r < 0.7 ? 'see' : 'listen';
    else mode = r < 0.25 ? 'pic' : r < 0.5 ? 'see' : 'listen';

    if (mode === 'pic') {
      // see the word (and hear it) -> tap the matching picture
      const opts = shuffle([w].concat(others.filter(x => x.pic).slice(0, 3)));
      return {
        id: uid(), packId, type: 'zhpic',
        emoji: w.ch, zh: w.ch, en: w.en,
        text: 'Tap the matching picture!',
        options: opts.map(x => x.pic),
        optZh: opts.map(x => x.ch),
        correct: opts.indexOf(w),
        time: 30, level
      };
    }
    // hear the word (with or without a picture hint) -> tap the word;
    // every option has a 🔊 chip, so no two options may sound the same
    const picked = [w];
    for (const x of others) {
      if (picked.length >= 4) break;
      if (picked.some(p => zhSameSound(p.ch, x.ch))) continue;
      picked.push(x);
    }
    const opts = shuffle(picked);
    return {
      id: uid(), packId, type: 'zh',
      emoji: mode === 'see' ? w.pic : '👂',
      zh: w.ch, en: w.en,
      text: 'Listen and tap the word you hear',
      options: opts.map(x => x.ch),
      correct: opts.indexOf(w),
      time: 30, level
    };
  }

  /* ---------- no-repeat rotation ----------
     Remember what was shown recently (per pack, on this device) and deal the
     fresh items first, so kids cycle through the whole bank before anything
     comes back around. */
  const RECENT_KEY = 'milesQuiz.recent.v1';
  function pickFresh(packKey, bank, n) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}') || {}; } catch (e) {}
    const recent = new Set(all[packKey] || []);
    const pool = shuffle(bank.slice());
    pool.sort((a, b) => (recent.has(a.ch) ? 1 : 0) - (recent.has(b.ch) ? 1 : 0));  // fresh first
    const picks = pool.slice(0, n);
    // keep the memory just short enough that n fresh items always remain
    const cap = Math.max(0, Math.min(bank.length - n, 60));
    all[packKey] = (all[packKey] || [])
      .filter(c => !picks.some(p => p.ch === c))
      .concat(picks.map(p => p.ch))
      .slice(-cap);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(all)); } catch (e) {}
    return picks;
  }

  function generateZh(level, n) {
    const bank = ZH_WORDS.filter(w => w.lv <= level);
    const picks = pickFresh('zh-quest', bank, n);
    return picks.map(w => makeZhQuestion(w, bank, level, 'zh-quest'));
  }

  function generateZhWords(level, n) {
    const bank = ZH_WORDS2.filter(w => w.lv <= level);
    const picks = pickFresh('zh-words', bank, n);
    return picks.map(w => makeZhQuestion(w, bank, level, 'zh-words'));
  }

  /* ---------- silly sentences: funny short sentences for new readers ----------
     Humour is the hook: a pig dancing or a snowman sipping hot tea makes a
     5-7 year old want to know what the sentence says. Pictures are little
     emoji scenes; every sentence is read aloud in Mandarin. */
  const ZH_SENTS = [
    /* level 1 — short & simple */
    { ch: '貓咪愛魚',   en: 'The kitty loves fish',        pic: '🐱🐟', lv: 1 },
    { ch: '狗狗開車',   en: 'The doggy drives a car',      pic: '🐶🚗', lv: 1 },
    { ch: '豬在跳舞',   en: 'The pig is dancing',          pic: '🐷💃', lv: 1 },
    { ch: '熊貓吃飯',   en: 'The panda eats rice',         pic: '🐼🍚', lv: 1 },
    { ch: '魚會飛',     en: 'The fish can fly',            pic: '🐟✈️', lv: 1 },
    { ch: '兔子唱歌',   en: 'The bunny sings a song',      pic: '🐰🎤', lv: 1 },
    { ch: '老虎刷牙',   en: 'The tiger brushes its teeth', pic: '🐯🦷', lv: 1 },
    { ch: '雞在看書',   en: 'The chicken is reading',      pic: '🐔📖', lv: 1 },
    { ch: '馬吃蛋糕',   en: 'The horse eats cake',         pic: '🐴🎂', lv: 1 },
    { ch: '下雨了',     en: 'It is raining',               pic: '🌧️☂️', lv: 1 },
    { ch: '鴨子游泳',   en: 'The duck is swimming',        pic: '🦆🌊', lv: 1 },
    { ch: '熊在睡覺',   en: 'The bear is sleeping',        pic: '🐻💤', lv: 1 },
    { ch: '貓咪畫畫',   en: 'The kitty is painting',       pic: '🐱🎨', lv: 1 },
    { ch: '鴨子坐船',   en: 'The duck rides a boat',       pic: '🦆⛵', lv: 1 },
    { ch: '豬豬愛花',   en: 'The piggy loves flowers',     pic: '🐷🌸', lv: 1 },
    { ch: '鳥在洗澡',   en: 'The bird takes a bath',       pic: '🐦🛁', lv: 1 },
    { ch: '狗狗玩球',   en: 'The doggy plays ball',        pic: '🐶⚽', lv: 1 },
    { ch: '熊吃麵',     en: 'The bear eats noodles',       pic: '🐻🍜', lv: 1 },
    { ch: '魚看月亮',   en: 'The fish looks at the moon',  pic: '🐟🌙', lv: 1 },
    { ch: '雞在跳舞',   en: 'The chicken is dancing',      pic: '🐔💃', lv: 1 },
    { ch: '下雪了',     en: 'It is snowing',               pic: '🌨️❄️', lv: 1 },
    { ch: '月亮笑了',   en: 'The moon is smiling',         pic: '🌙😊', lv: 1 },
    /* level 2 — a little longer */
    { ch: '恐龍打籃球', en: 'The dinosaur plays basketball', pic: '🦖🏀', lv: 2 },
    { ch: '大象坐火車', en: 'The elephant rides the train',  pic: '🐘🚂', lv: 2 },
    { ch: '獅子怕老鼠', en: 'The lion is scared of the mouse', pic: '🦁🐭', lv: 2 },
    { ch: '猴子開飛機', en: 'The monkey flies a plane',      pic: '🐵✈️', lv: 2 },
    { ch: '青蛙跳很高', en: 'The frog jumps very high',      pic: '🐸⬆️', lv: 2 },
    { ch: '雪人喝熱茶', en: 'The snowman drinks hot tea',    pic: '⛄🍵', lv: 2 },
    { ch: '星星眨眼睛', en: 'The stars are blinking',        pic: '🌟👀', lv: 2 },
    { ch: '烏龜跑得快', en: 'The turtle runs fast',          pic: '🐢💨', lv: 2 },
    { ch: '小狗愛洗澡', en: 'The puppy loves baths',         pic: '🐶🛁', lv: 2 },
    { ch: '貓咪打電話', en: 'The kitty makes a phone call',  pic: '🐱📞', lv: 2 },
    { ch: '蜜蜂住城堡', en: 'The bee lives in a castle',     pic: '🐝🏰', lv: 2 },
    { ch: '熊愛吃蜂蜜', en: 'The bear loves honey',          pic: '🐻🍯', lv: 2 },
    { ch: '鯊魚愛吃糖', en: 'The shark loves candy',         pic: '🦈🍬', lv: 2 },
    { ch: '恐龍愛蛋糕', en: 'The dinosaur loves cake',       pic: '🦖🍰', lv: 2 },
    { ch: '猴子吃香蕉', en: 'The monkey eats a banana',      pic: '🐵🍌', lv: 2 },
    { ch: '老鼠愛起司', en: 'The mouse loves cheese',        pic: '🐭🧀', lv: 2 },
    { ch: '青蛙拿雨傘', en: 'The frog holds an umbrella',    pic: '🐸☂️', lv: 2 },
    { ch: '小豬蓋房子', en: 'The little pig builds a house', pic: '🐷🏠', lv: 2 },
    { ch: '鯨魚噴水',   en: 'The whale spouts water',        pic: '🐳⛲', lv: 2 },
    { ch: '貓頭鷹看書', en: 'The owl reads a book',          pic: '🦉📖', lv: 2 },
    { ch: '小鳥住樹上', en: 'The bird lives in a tree',      pic: '🐦🌳', lv: 2 },
    { ch: '蝸牛慢慢走', en: 'The snail walks slowly',        pic: '🐌⏰', lv: 2 },
    { ch: '雪人怕太陽', en: 'The snowman fears the sun',     pic: '⛄☀️', lv: 2 },
    { ch: '星星愛月亮', en: 'The star loves the moon',       pic: '🌟🌙', lv: 2 },
    { ch: '恐龍騎馬',   en: 'The dinosaur rides a horse',    pic: '🦖🐴', lv: 2 },
    { ch: '鬼怕黑',     en: 'The ghost is scared of the dark', pic: '👻🌑', lv: 2 },
    { ch: '蛋糕飛走了', en: 'The cake flew away',            pic: '🎂🎈', lv: 2 },
    { ch: '貓咪坐火箭', en: 'The kitty rides a rocket',      pic: '🐱🚀', lv: 2 },
    { ch: '恐龍上學去', en: 'The dinosaur goes to school',   pic: '🦖🎒', lv: 2 },
    { ch: '老虎喝汽水', en: 'The tiger drinks soda',         pic: '🐯🥤', lv: 2 },
    { ch: '猴子戴眼鏡', en: 'The monkey wears glasses',      pic: '🐵👓', lv: 2 },
    /* level 3 — the silliest ones */
    { ch: '章魚穿八隻鞋', en: 'The octopus wears eight shoes',  pic: '🐙👟', lv: 3 },
    { ch: '企鵝去海邊玩', en: 'The penguin goes to the beach',  pic: '🐧🏖️', lv: 3 },
    { ch: '月亮吃了餅乾', en: 'The moon ate a cookie',          pic: '🌙🍪', lv: 3 },
    { ch: '太陽戴墨鏡',   en: 'The sun wears sunglasses',       pic: '☀️🕶️', lv: 3 },
    { ch: '恐龍害怕打針', en: 'The dinosaur is scared of shots', pic: '🦖💉', lv: 3 },
    { ch: '火箭飛到月亮', en: 'The rocket flies to the moon',   pic: '🚀🌕', lv: 3 },
    { ch: '小貓當國王',   en: 'The kitten becomes king',        pic: '🐱👑', lv: 3 },
    { ch: '熊貓抱西瓜',   en: 'The panda hugs a watermelon',    pic: '🐼🍉', lv: 3 },
    { ch: '機器人會唱歌', en: 'The robot can sing',             pic: '🤖🎵', lv: 3 },
    { ch: '恐龍賣冰淇淋', en: 'The dinosaur sells ice cream',   pic: '🦖🍦', lv: 3 },
    { ch: '聖誕老人游泳', en: 'Santa goes swimming',            pic: '🎅🌊', lv: 3 },
    { ch: '青蛙王子唱歌', en: 'The frog prince sings',          pic: '🐸👑', lv: 3 },
    { ch: '熊貓騎腳踏車', en: 'The panda rides a bike',         pic: '🐼🚲', lv: 3 },
    { ch: '兔子愛紅蘿蔔', en: 'The bunny loves carrots',        pic: '🐰🥕', lv: 3 },
    { ch: '螃蟹剪頭髮',   en: 'The crab gives haircuts',        pic: '🦀✂️', lv: 3 },
    { ch: '大象學溜冰',   en: 'The elephant learns to skate',   pic: '🐘⛸️', lv: 3 },
    { ch: '章魚彈鋼琴',   en: 'The octopus plays the piano',    pic: '🐙🎹', lv: 3 },
    { ch: '獅子去剪頭髮', en: 'The lion gets a haircut',        pic: '🦁💈', lv: 3 },
    { ch: '企鵝愛吃冰',   en: 'The penguin loves shaved ice',   pic: '🐧🍧', lv: 3 },
    { ch: '外星人來地球', en: 'The alien visits Earth',         pic: '👽🌍', lv: 3 },
    { ch: '鞋子會走路',   en: 'The shoes walk by themselves',   pic: '👟👣', lv: 3 },
    { ch: '機器人吃電池', en: 'The robot eats batteries',       pic: '🤖🔋', lv: 3 },
    { ch: '恐龍打噴嚏',   en: 'The dinosaur sneezes',           pic: '🦖🤧', lv: 3 },
    { ch: '大野狼吹氣球', en: 'The big bad wolf blows balloons', pic: '🐺🎈', lv: 3 },
    { ch: '恐龍學寫字',   en: 'The dinosaur learns to write',   pic: '🦖✏️', lv: 3 },
    { ch: '螞蟻搬蛋糕',   en: 'The ants carry a cake',          pic: '🐜🍰', lv: 3 },
    { ch: '火車鑽山洞',   en: 'The train goes through the tunnel', pic: '🚂⛰️', lv: 3 }
  ];

  function makeSentQuestion(s, bank, level) {
    const others = shuffle(bank.filter(x => x.ch !== s.ch).slice());
    // young readers get mostly picture-matching; older ones read the sentences
    const r = Math.random();
    let mode;
    if (level === 1) mode = r < 0.65 ? 'pic' : 'see';
    else if (level === 2) mode = r < 0.45 ? 'pic' : r < 0.9 ? 'see' : 'listen';
    else mode = r < 0.3 ? 'pic' : r < 0.7 ? 'see' : 'listen';

    if (mode === 'pic') {
      // read (and hear) the sentence -> tap the matching little scene
      const opts = shuffle([s].concat(others.slice(0, 3)));
      return {
        id: uid(), packId: 'zh-sentences', type: 'zhpic',
        emoji: s.ch, zh: s.ch, en: s.en,
        text: 'Tap the matching picture!',
        options: opts.map(x => x.pic),
        optZh: opts.map(x => x.ch),
        correct: opts.indexOf(s),
        time: 30, level
      };
    }
    // hear the sentence (with or without its scene) -> tap the sentence
    const opts = shuffle([s].concat(others.slice(0, 3)));
    return {
      id: uid(), packId: 'zh-sentences', type: 'zh',
      emoji: mode === 'see' ? s.pic : '👂',
      zh: s.ch, en: s.en,
      text: 'Listen and tap the sentence you hear',
      options: opts.map(x => x.ch),
      correct: opts.indexOf(s),
      time: 30, level
    };
  }

  function generateZhSentences(level, n) {
    const bank = ZH_SENTS.filter(s => s.lv <= level);
    const picks = pickFresh('zh-sentences', bank, n);
    return picks.map(s => makeSentQuestion(s, bank, level));
  }

  /* ---------- players ---------- */
  function getPlayers() {
    try { return JSON.parse(localStorage.getItem(PLAYERS_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function savePlayers(list) {
    try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function getCurrentPlayer() {
    const players = getPlayers();
    let cur = '';
    try { cur = localStorage.getItem(CURRENT_KEY) || ''; } catch (e) {}
    if (cur && players.indexOf(cur) >= 0) return cur;
    return players[0] || '';
  }
  function setCurrentPlayer(name) {
    try { localStorage.setItem(CURRENT_KEY, name || ''); } catch (e) {}
  }
  function addPlayer(name) {
    name = String(name || '').trim().slice(0, 14);
    if (!name) return '';
    const players = getPlayers();
    if (players.indexOf(name) < 0) { players.push(name); savePlayers(players); }
    setCurrentPlayer(name);
    return name;
  }
  function removePlayer(name) {
    savePlayers(getPlayers().filter(n => n !== name));
    const all = allBest();
    if (all[name]) { delete all[name]; saveBest(all); }       // drop their scores too
    [COINS_KEY, STICKERS_KEY, BUDDY_KEY, WRITE_KEY, NAME_KEY, ACT_KEY, QUEST_KEY].forEach(k => {   // and their data
      const o = readJSON(k, {});
      if (o[name] != null) { delete o[name]; writeJSON(k, o); }
    });
    if (getCurrentPlayer() === name) setCurrentPlayer(getPlayers()[0] || '');
  }
  // one-time migration from the old single-name + global-score scheme
  function migratePlayers() {
    if (localStorage.getItem(PLAYERS_KEY) != null) return;     // already migrated
    let oldName = '';
    try { oldName = (localStorage.getItem('milesQuiz.name') || '').trim(); } catch (e) {}
    if (oldName) {
      savePlayers([oldName]);
      setCurrentPlayer(oldName);
      try {
        const oldBest = JSON.parse(localStorage.getItem('milesQuiz.best.v1') || 'null');
        if (oldBest && typeof oldBest === 'object') {
          const all = allBest();
          all[oldName] = Object.assign({}, all[oldName], oldBest);
          saveBest(all);
        }
      } catch (e) {}
    } else {
      savePlayers([]);
    }
  }

  /* ---------- coins / stickers / buddy (prize machine, per player) ---------- */
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  // coins should still work before any player is added
  function playerKey() { return getCurrentPlayer() || '★'; }

  function getCoins() { return readJSON(COINS_KEY, {})[playerKey()] || 0; }
  function addCoins(n) {
    const all = readJSON(COINS_KEY, {});
    const k = playerKey();
    all[k] = Math.max(0, (all[k] || 0) + n);
    writeJSON(COINS_KEY, all);
    return all[k];
  }
  function getStickers() { return readJSON(STICKERS_KEY, {})[playerKey()] || {}; }
  function addSticker(emoji) {
    const all = readJSON(STICKERS_KEY, {});
    const k = playerKey();
    all[k] = all[k] || {};
    all[k][emoji] = (all[k][emoji] || 0) + 1;
    writeJSON(STICKERS_KEY, all);
    return all[k][emoji];
  }
  function getBuddy() { return readJSON(BUDDY_KEY, {})[playerKey()] || ''; }
  function setBuddy(emoji) {
    const all = readJSON(BUDDY_KEY, {});
    all[playerKey()] = emoji || '';
    writeJSON(BUDDY_KEY, all);
  }

  /* ---------- activity log (per player, for streaks & the parent report) ---------- */
  const ACT_KEY = 'milesQuiz.activity.v1';
  const ACT_CAP = 500;                       // entries kept per player

  function todayStr(offsetDays) {
    const d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function pushActivity(entry) {
    const all = readJSON(ACT_KEY, {});
    const k = playerKey();
    all[k] = (all[k] || []).concat([entry]).slice(-ACT_CAP);
    writeJSON(ACT_KEY, all);
  }
  function logRound(packId, ok, total) {
    pushActivity({ d: todayStr(), kind: 'round', packId, ok, total });
  }
  function logWrite(ch) {
    pushActivity({ d: todayStr(), kind: 'write', ch });
  }
  function getActivityFor(name, days) {
    const all = readJSON(ACT_KEY, {});
    const list = all[name || playerKey()] || [];
    const cutoff = todayStr(-(days - 1));
    return list.filter(e => e.d >= cutoff);
  }
  function getActivity(days) { return getActivityFor('', days); }
  // consecutive days with any play, counting back from today (an empty today
  // doesn't break the chain — the streak just waits for them)
  function getPlayStreak() {
    const list = readJSON(ACT_KEY, {})[playerKey()] || [];
    const played = new Set(list.map(e => e.d));
    let streak = 0;
    let off = played.has(todayStr()) ? 0 : -1;
    while (played.has(todayStr(off))) { streak++; off--; }
    return streak;
  }

  /* ---------- daily quests (per player, reset each day) ---------- */
  const QUEST_KEY = 'milesQuiz.quests.v1';
  const QUESTS = [
    { id: 'zhround', icon: '🀄', label: 'Play a Chinese game 玩一場中文遊戲', goal: 1, reward: 10 },
    { id: 'write',   icon: '✍️', label: 'Write 3 characters 寫三個字',        goal: 3, reward: 10 },
    { id: 'correct', icon: '✅', label: 'Get 10 right 答對十題',              goal: 10, reward: 10 }
  ];
  function questState() {
    const all = readJSON(QUEST_KEY, {});
    let st = all[playerKey()];
    if (!st || st.date !== todayStr()) st = { date: todayStr(), prog: {}, done: [] };
    return st;
  }
  function saveQuestState(st) {
    const all = readJSON(QUEST_KEY, {});
    all[playerKey()] = st;
    writeJSON(QUEST_KEY, all);
  }
  function getQuests() {
    const st = questState();
    return QUESTS.map(q => ({
      id: q.id, icon: q.icon, label: q.label, goal: q.goal, reward: q.reward,
      prog: Math.min(q.goal, st.prog[q.id] || 0),
      done: st.done.indexOf(q.id) >= 0
    }));
  }
  // advance a quest; returns the quests completed by this bump (coins already added)
  function bumpQuest(id, n) {
    const q = QUESTS.find(x => x.id === id);
    if (!q || !n) return [];
    const st = questState();
    st.prog[id] = (st.prog[id] || 0) + n;
    const completed = [];
    if (st.prog[id] >= q.goal && st.done.indexOf(id) < 0) {
      st.done.push(id);
      addCoins(q.reward);
      completed.push(q);
    }
    saveQuestState(st);
    return completed;
  }

  /* ---------- the child's own name for Write Quest (per player) ---------- */
  const NAME_KEY = 'milesQuiz.writeName.v1';
  function getWriteName() { return readJSON(NAME_KEY, {})[playerKey()] || ''; }
  function setWriteName(name) {
    const all = readJSON(NAME_KEY, {});
    all[playerKey()] = String(name || '').replace(/\s+/g, '').slice(0, 5);
    writeJSON(NAME_KEY, all);
    return all[playerKey()];
  }

  /* ---------- Write Quest stars (per player) ----------
     Stars are a grade for how carefully the character was traced (3 = no
     wrong strokes). The best grade ever earned is kept per character. */
  function getWriteStars() { return readJSON(WRITE_KEY, {})[playerKey()] || {}; }
  function setWriteStars(ch, stars) {
    const all = readJSON(WRITE_KEY, {});
    const k = playerKey();
    all[k] = all[k] || {};
    all[k][ch] = Math.max(all[k][ch] || 0, Math.max(1, Math.min(3, stars)));
    writeJSON(WRITE_KEY, all);
    return all[k][ch];
  }

  /* ---------- best scores (per player) ---------- */
  function allBest() { try { return JSON.parse(localStorage.getItem(SCORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveBest(all) { try { localStorage.setItem(SCORE_KEY, JSON.stringify(all)); } catch (e) {} }
  function getBest(packId) {
    const p = getCurrentPlayer();
    const all = allBest();
    return (all[p] && all[p][packId]) || 0;
  }
  function setBest(packId, score) {
    const p = getCurrentPlayer();
    if (!p) return false;                                       // no player → don't track
    const all = allBest();
    all[p] = all[p] || {};
    if (score > (all[p][packId] || 0)) { all[p][packId] = score; saveBest(all); return true; }
    return false;
  }

  return {
    load, save, getPacks, getPack, questionsFor, allQuestions, countFor,
    upsertQuestion, deleteQuestion, addPack, deletePack,
    exportJSON, importJSON, resetDefaults,
    generateMath, generateZh, generateZhWords, generateZhSentences, shuffle, shuffleOptions,
    getBest, setBest, uid,
    getPlayers, getCurrentPlayer, setCurrentPlayer, addPlayer, removePlayer,
    getCoins, addCoins, getStickers, addSticker, getBuddy, setBuddy,
    getWriteStars, setWriteStars, getWriteName, setWriteName,
    logRound, logWrite, getActivity, getActivityFor, getPlayStreak,
    getQuests, bumpQuest
  };
})();
