/* Persistence layer. Everything lives in localStorage so the parent's custom
   questions survive page reloads. Export/import lets them back up & move
   between devices. */
window.Store = (function () {
  const KEY = 'milesQuiz.v1';
  const SCORE_KEY = 'milesQuiz.best.v2';      // best scores, now keyed per player
  const PLAYERS_KEY = 'milesQuiz.players.v1'; // list of player names
  const CURRENT_KEY = 'milesQuiz.current.v1'; // the active player's name

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
    migratePlayers();
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
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
    generateMath, shuffle, shuffleOptions,
    getBest, setBest, uid,
    getPlayers, getCurrentPlayer, setCurrentPlayer, addPlayer, removePlayer
  };
})();
