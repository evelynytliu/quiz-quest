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
     Word banks live in js/zh-data.js (window.ZH) and are shared by every
     Chinese game. Three game modes here:
       - zhpic:  see the character (spoken aloud) -> tap the matching picture
       - see:    see a picture + hear the word    -> tap the matching character
       - listen: hear the word only               -> tap the matching character
     No reading required: everything is taught by sound and pictures. */
  const ZH_WORDS = window.ZH.WORDS;
  const ZH_WORDS2 = window.ZH.WORDS2;
  const ZH_SENTS = window.ZH.SENTS;
  const zhSameSound = window.ZH.sameSound;


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


  /* ---------- Spot the Twin: three of a kind and one look-alike ----------
     Trains the eye to catch the small difference between 木 and 本, 日 and
     目 — exactly the mix-ups new readers make. The odd one out is the
     answer; the 🔊 chips stay hidden so the sound can't give it away. */
  function generateTwins(level, n) {
    const bank = window.ZH.TWINS.filter(t => t.lv <= level);
    const picks = pickFresh('zh-twins', bank.map(t => Object.assign({ ch: t.a + t.b }, t)), n);
    return picks.map(t => {
      const flip = Math.random() < 0.5;            // which of the pair is the odd one
      const base = flip ? t.b : t.a, odd = flip ? t.a : t.b;
      const baseEn = flip ? t.be : t.ae, oddEn = flip ? t.ae : t.be;
      const slots = level >= 3 ? 6 : 4;
      const opts = new Array(slots).fill(base);
      const correct = Math.floor(Math.random() * slots);
      opts[correct] = odd;
      return {
        id: uid(), packId: 'zh-twins', type: 'zhodd',
        emoji: '🔍', zh: odd, en: oddEn, base, baseEn,
        text: 'Tap the one that is different! 找出不一樣的字',
        say: '哪一個不一樣？',
        after: { zh: base + '，' + odd, en: baseEn + ' … ' + oddEn },
        // spoken after answering: the common character with its meaning,
        // then the odd one out with its meaning, each lit up as it is said
        seq: [{ zh: base, en: baseEn }, { zh: odd, en: oddEn }],
        options: opts, correct, time: 30, level
      };
    });
  }

  /* ---------- Opposites: hear a word, tap its opposite ---------- */
  function generateOpposites(level, n) {
    const bank = window.ZH.OPPOSITES.filter(o => o.lv <= level);
    const picks = pickFresh('zh-opposites', bank.map(o => Object.assign({ ch: o.a + o.b }, o)), n);
    return picks.map(o => {
      const flip = Math.random() < 0.5;
      const from = flip ? o.b : o.a, to = flip ? o.a : o.b;
      const fromP = flip ? o.bp : o.ap, toP = flip ? o.ap : o.bp;
      const fromE = flip ? o.be : o.ae, toE = flip ? o.ae : o.be;
      // wrong answers: halves of other pairs (never this pair's own words)
      const pool = shuffle(bank.filter(x => x !== o).map(x => Math.random() < 0.5 ? x.a : x.b));
      const others = [];
      for (const c of pool) { if (others.length >= 3) break; if (c !== from && c !== to && others.indexOf(c) < 0) others.push(c); }
      const opts = shuffle([to].concat(others));
      return {
        id: uid(), packId: 'zh-opposites', type: 'zh',
        emoji: from, zh: to, en: toE,
        text: fromP + ' ' + from + '  ↔  ?',
        say: from + '，相反的是什麼？',
        after: { zh: from + '、' + to, en: fromE + ' and ' + toE },
        options: opts, correct: opts.indexOf(to), time: 30, level,
        picHint: toP
      };
    });
  }

  /* ---------- Count & Say: how many? answer with the right measure word ----------
     Ties numbers to characters: 三隻貓, 兩條魚. Level 1 counts to 3,
     level 2 to 5, level 3 to 9. */
  function generateCount(level, n) {
    const bank = window.ZH.COUNT.filter(c => c.lv <= level);
    const picks = pickFresh('zh-count', bank, n);
    const NUM = window.ZH.NUMBERS, NUM_EN = window.ZH.NUM_EN;
    const max = level === 1 ? 3 : level === 2 ? 5 : 9;
    return picks.map(c => {
      const k = rnd(1, max);
      const phrase = j => NUM[j] + c.m + c.ch;
      const nums = new Set([k]);
      while (nums.size < Math.min(4, max)) nums.add(rnd(1, max));
      const opts = shuffle(Array.from(nums)).map(phrase);
      return {
        id: uid(), packId: 'zh-count', type: 'zh',
        emoji: c.pic.repeat(k), count: k,
        zh: phrase(k), en: NUM_EN[k] + ' ' + c.en + (k > 1 ? 's' : ''),
        text: 'How many? 有幾' + c.m + c.ch + '？',
        say: '有幾' + c.m + c.ch + '？',
        options: opts, correct: opts.indexOf(phrase(k)), time: 30, level
      };
    });
  }

  /* ---------- per-character memory: the Garden's soil ----------
     Every Chinese game reports each character it showed and whether the
     child got it right. A character grows a stage when it's answered right
     on or after its due day (spaced repetition: 0, 1, 3, 7, 14 days), so
     a plant that's watered too early stays the same size — the child has
     to come back tomorrow. */
  const CHARS_KEY = 'milesQuiz.chars.v1';
  const GROW_DAYS = [0, 1, 3, 7, 14];          // wait before each stage can grow
  const MAX_STAGE = 4;
  const CJK_RE = /[一-鿿]/;
  function daysBetween(a, b) {
    const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00');
    return Math.round(ms / 86400000);
  }
  function getCharStats() { return readJSON(CHARS_KEY, {})[playerKey()] || {}; }
  function saveCharStats(st) {
    const all = readJSON(CHARS_KEY, {});
    all[playerKey()] = st;
    writeJSON(CHARS_KEY, all);
  }
  // is this character ready to grow (or thirsty, in garden speak)?
  function charDue(c) {
    if (!c) return true;
    if (c.stage >= MAX_STAGE) return false;
    return daysBetween(c.last, todayStr()) >= GROW_DAYS[c.stage];
  }
  // note a meeting with a character (or a word/sentence — each known
  // character in it gets credit). Returns the characters that grew.
  function noteChars(text, right) {
    const st = getCharStats();
    const grown = [];
    const seen = new Set();
    Array.from(String(text || '')).forEach(ch => {
      if (!CJK_RE.test(ch) || seen.has(ch) || !window.ZH.word(ch)) return;
      seen.add(ch);
      const c = st[ch] || { stage: 0, seen: 0, ok: 0, last: todayStr(), planted: todayStr() };
      c.seen++;
      if (right) {
        c.ok++;
        if (charDue(c) && c.stage < MAX_STAGE) { c.stage++; c.last = todayStr(); grown.push(ch); }
        else if (c.seen === 1) c.last = todayStr();
      } else if (c.stage > 1 && c.seen > 2 && c.ok / c.seen < 0.5) {
        c.stage--;                                   // a wilting plant asks for care
        c.last = todayStr();
      }
      st[ch] = c;
    });
    saveCharStats(st);
    return grown;
  }
  function noteChar(ch, right) { return noteChars(ch, right); }
  // the variety quest counts distinct games played today
  function noteGamePlayed(packId) {
    const st = questState();
    st.games = st.games || [];
    if (st.games.indexOf(packId) >= 0) { saveQuestState(st); return []; }
    st.games.push(packId);
    saveQuestState(st);
    return bumpQuest('variety', 1);
  }
  // characters the garden wants watered today, thirstiest first
  function dueChars() {
    const st = getCharStats();
    return Object.keys(st)
      .filter(ch => charDue(st[ch]))
      .sort((a, b) => st[a].stage - st[b].stage || daysBetween(st[b].last, todayStr()) - daysBetween(st[a].last, todayStr()));
  }
  // a watering round: questions about thirsty characters first, then the
  // smallest plants, so the garden as a whole keeps growing
  function generateGarden(n) {
    const st = getCharStats();
    const known = Object.keys(st);
    if (!known.length) return [];
    const due = dueChars();
    const rest = known.filter(ch => due.indexOf(ch) < 0).sort((a, b) => st[a].stage - st[b].stage);
    const picks = shuffle(due).concat(shuffle(rest)).slice(0, n).map(ch => window.ZH.word(ch)).filter(Boolean);
    const bank = ZH_WORDS;
    return picks.map(w => makeZhQuestion(w, bank, w.lv >= 3 ? 3 : 2, 'zh-garden'));
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
    [COINS_KEY, STICKERS_KEY, SHINY_KEY, TICKET_KEY, BUDDY_KEY, WRITE_KEY, NAME_KEY, ACT_KEY, QUEST_KEY, CHARS_KEY, UNLOCK_KEY].forEach(k => {   // and their data
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
  // shiny ✨ versions of stickers, collected separately
  const SHINY_KEY = 'milesQuiz.shiny.v1';
  function getShiny() { return readJSON(SHINY_KEY, {})[playerKey()] || {}; }
  function addShiny(emoji) {
    const all = readJSON(SHINY_KEY, {});
    const k = playerKey();
    all[k] = all[k] || {};
    all[k][emoji] = (all[k][emoji] || 0) + 1;
    writeJSON(SHINY_KEY, all);
    return all[k][emoji];
  }
  // duplicates pile up; every DUPES_PER_TICKET of them become a golden ticket
  const TICKET_KEY = 'milesQuiz.tickets.v1';
  const DUPES_PER_TICKET = 5;
  function ticketState() { return readJSON(TICKET_KEY, {})[playerKey()] || { tickets: 0, dupes: 0, seeded: false }; }
  function saveTicketState(st) {
    const all = readJSON(TICKET_KEY, {});
    all[playerKey()] = st;
    writeJSON(TICKET_KEY, all);
  }
  function getTickets() { return ticketState().tickets; }
  function getDupes() { return ticketState().dupes; }
  // note a duplicate pull; returns true when it completed a ticket
  function addDupe() {
    const st = ticketState();
    st.dupes++;
    let ticket = false;
    if (st.dupes >= DUPES_PER_TICKET) { st.dupes -= DUPES_PER_TICKET; st.tickets++; ticket = true; }
    saveTicketState(st);
    return ticket;
  }
  function useTicket() {
    const st = ticketState();
    if (st.tickets <= 0) return false;
    st.tickets--;
    saveTicketState(st);
    return true;
  }
  // one-time: duplicates collected before tickets existed count towards them
  function seedTickets() {
    const st = ticketState();
    if (st.seeded) return 0;
    const owned = getStickers();
    let extra = 0;
    Object.keys(owned).forEach(e => { extra += Math.max(0, owned[e] - 1); });
    st.tickets += Math.floor(extra / DUPES_PER_TICKET);
    st.dupes = extra % DUPES_PER_TICKET;
    st.seeded = true;
    saveTicketState(st);
    return Math.floor(extra / DUPES_PER_TICKET);
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
    { id: 'correct', icon: '✅', label: 'Get 10 right 答對十題',              goal: 10, reward: 10 },
    { id: 'variety', icon: '🎲', label: 'Try 3 different games 玩三種遊戲',    goal: 3, reward: 10 }
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

  /* ---------- game unlocks (per player) ----------
     The mini-games start locked. A round finished with two stars or more
     earns a key 🔑 (at most KEYS_PER_DAY a day), and a key opens whichever
     locked game the child picks — so new games arrive a couple at a time,
     and each one is something they chose and worked for. */
  const UNLOCK_KEY = 'milesQuiz.unlock.v1';
  const KEYS_PER_DAY = 2;
  const LOCKED_GAMES = ['zh-build', 'zh-whack', 'zh-twins', 'zh-match', 'zh-bingo', 'zh-order',
    'zh-morph', 'zh-flash', 'zh-hunt', 'zh-count', 'zh-opposites', 'zh-garden'];
  function unlockState() {
    const st = readJSON(UNLOCK_KEY, {})[playerKey()] || {};
    return { keys: st.keys || 0, unlocked: st.unlocked || [], today: st.today || { date: '', earned: 0 } };
  }
  function saveUnlockState(st) {
    const all = readJSON(UNLOCK_KEY, {});
    all[playerKey()] = st;
    writeJSON(UNLOCK_KEY, all);
  }
  function isLocked(packId) {
    return LOCKED_GAMES.indexOf(packId) >= 0 && unlockState().unlocked.indexOf(packId) < 0;
  }
  function lockedGames() { return LOCKED_GAMES.filter(isLocked); }
  function getKeys() { return unlockState().keys; }
  // keys still earnable today
  function keysLeftToday() {
    const st = unlockState();
    return KEYS_PER_DAY - (st.today.date === todayStr() ? st.today.earned : 0);
  }
  // a good round earns a key (daily cap); returns true when one was earned
  function earnKey() {
    if (!lockedGames().length) return false;
    const st = unlockState();
    if (st.today.date !== todayStr()) st.today = { date: todayStr(), earned: 0 };
    if (st.today.earned >= KEYS_PER_DAY) return false;
    st.today.earned++;
    st.keys++;
    saveUnlockState(st);
    return true;
  }
  // spend a key on a game; returns true when it was unlocked
  function unlockGame(packId) {
    const st = unlockState();
    if (!isLocked(packId) || st.keys <= 0) return false;
    st.keys--;
    st.unlocked.push(packId);
    saveUnlockState(st);
    return true;
  }
  function unlockAll() {
    const st = unlockState();
    st.unlocked = LOCKED_GAMES.slice();
    saveUnlockState(st);
  }
  function lockAll() {
    saveUnlockState({ keys: 0, unlocked: [], today: { date: '', earned: 0 } });
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
    generateMath, generateZh, generateZhWords, generateZhSentences,
    generateTwins, generateOpposites, generateCount, generateGarden, shuffle, shuffleOptions,
    getCharStats, noteChar, noteChars, dueChars, charDue, noteGamePlayed, todayStr,
    getBest, setBest, uid,
    getPlayers, getCurrentPlayer, setCurrentPlayer, addPlayer, removePlayer,
    getCoins, addCoins, getStickers, addSticker, getBuddy, setBuddy,
    getShiny, addShiny, getTickets, getDupes, addDupe, useTicket, seedTickets, DUPES_PER_TICKET,
    getWriteStars, setWriteStars, getWriteName, setWriteName,
    logRound, logWrite, getActivity, getActivityFor, getPlayStreak,
    getQuests, bumpQuest,
    isLocked, lockedGames, getKeys, keysLeftToday, earnKey, unlockGame, unlockAll, lockAll, KEYS_PER_DAY
  };
})();
