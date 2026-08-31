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
    migratePlayers();
    return data;
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
      time: level === 3 ? 25 : 20,
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

  function makeZhQuestion(w, bank, level) {
    const others = shuffle(bank.filter(x => x.ch !== w.ch).slice());
    // easier levels lean on pictures; word masters get more listening
    const r = Math.random();
    let mode;
    if (!w.pic) mode = 'listen';
    else if (level === 1) mode = r < 0.5 ? 'pic' : r < 0.85 ? 'see' : 'listen';
    else if (level === 2) mode = r < 0.4 ? 'pic' : r < 0.7 ? 'see' : 'listen';
    else mode = r < 0.25 ? 'pic' : r < 0.5 ? 'see' : 'listen';

    if (mode === 'pic') {
      // see the character (and hear it) -> tap the matching picture
      const opts = shuffle([w].concat(others.filter(x => x.pic).slice(0, 3)));
      return {
        id: uid(), packId: 'zh-quest', type: 'zhpic',
        emoji: w.ch, zh: w.ch, en: w.en,
        text: 'Tap the matching picture!',
        options: opts.map(x => x.pic),
        optZh: opts.map(x => x.ch),
        correct: opts.indexOf(w),
        time: 20, level
      };
    }
    // hear the word (with or without a picture hint) -> tap the character;
    // every option has a 🔊 chip, so no two options may sound the same
    const picked = [w];
    for (const x of others) {
      if (picked.length >= 4) break;
      if (picked.some(p => zhSameSound(p.ch, x.ch))) continue;
      picked.push(x);
    }
    const opts = shuffle(picked);
    return {
      id: uid(), packId: 'zh-quest', type: 'zh',
      emoji: mode === 'see' ? w.pic : '👂',
      zh: w.ch, en: w.en,
      text: 'Listen and tap the word you hear',
      options: opts.map(x => x.ch),
      correct: opts.indexOf(w),
      time: 22, level
    };
  }

  function generateZh(level, n) {
    const bank = ZH_WORDS.filter(w => w.lv <= level);
    const picks = shuffle(bank.slice()).slice(0, n);
    return picks.map(w => makeZhQuestion(w, bank, level));
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
    [COINS_KEY, STICKERS_KEY, BUDDY_KEY].forEach(k => {       // and their prizes
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
    generateMath, generateZh, shuffle, shuffleOptions,
    getBest, setBest, uid,
    getPlayers, getCurrentPlayer, setCurrentPlayer, addPlayer, removePlayer,
    getCoins, addCoins, getStickers, addSticker, getBuddy, setBuddy
  };
})();
