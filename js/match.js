/* Memory Match 翻牌配對: flip cards to pair each character with its
   picture. Every flip says the character aloud, so the ear helps the
   memory — and both halves of a pair sound the same. */
window.Match = (function () {
  let level = 1;
  let cards = [];        // { key, kind: 'ch'|'pic', text, el }
  let flipped = [];      // cards currently face-up and unmatched
  let matched = 0;
  let moves = 0;
  let pairs = 0;
  let busy = false;
  let ui = {};

  function open(lv) {
    level = lv || 1;
    pairs = level === 1 ? 6 : level === 2 ? 8 : 10;
    // levels 1–2 pair single characters; level 3 uses two-character words
    const bank = level === 3
      ? window.ZH.WORDS2.filter(w => w.pic)
      : window.ZH.WORDS.filter(w => w.pic && w.lv <= (level === 1 ? 2 : 3));
    const words = Mini.sample(bank, pairs);
    cards = [];
    words.forEach(w => {
      cards.push({ key: w.ch, kind: 'ch', text: w.ch, en: w.en });
      cards.push({ key: w.ch, kind: 'pic', text: w.pic, en: w.en });
    });
    Store.shuffle(cards);
    flipped = []; matched = 0; moves = 0; busy = false;

    const stage = Mini.open(api, '🃏 Memory Match 翻牌配對');
    const cols = pairs === 10 ? 5 : 4;
    stage.innerHTML = `
      <div class="mini-head"><div class="mini-progress"><span class="match-done">0</span> / ${pairs} pairs</div>
        <div class="pill"><span class="match-moves">0</span> flips</div></div>
      <div class="match-grid cols-${cols}"></div>
      <div class="mini-msg match-msg">Find the character and its picture! 找出字和圖</div>`;
    ui = {
      grid: stage.querySelector('.match-grid'), done: stage.querySelector('.match-done'),
      moves: stage.querySelector('.match-moves'), msg: stage.querySelector('.match-msg')
    };
    cards.forEach((c, i) => {
      const b = Mini.h('button', 'mcard' + (c.kind === 'ch' ? ' is-ch' : ' is-pic') + (level === 3 ? ' is-word' : ''), '');
      b.type = 'button';
      b.innerHTML = '<span class="mcard-face mcard-front">' + ['🌟', '🎈', '🍀', '🌈'][i % 4] + '</span>'
        + '<span class="mcard-face mcard-back"></span>';
      b.querySelector('.mcard-back').textContent = c.text;
      b.addEventListener('click', () => flip(c));
      c.el = b;
      ui.grid.appendChild(b);
    });
  }

  function flip(c) {
    if (busy || c.el.classList.contains('flipped') || c.el.classList.contains('matched')) return;
    c.el.classList.add('flipped');
    Sfx.pop();
    Sfx.stopSpeak(); Sfx.speakZh(c.key);         // both halves say the character
    flipped.push(c);
    if (flipped.length < 2) return;
    moves++;
    ui.moves.textContent = moves;
    const [a, b] = flipped;
    flipped = [];
    if (a.key === b.key) {
      matched++;
      ui.done.textContent = matched;
      a.el.classList.add('matched'); b.el.classList.add('matched');
      Sfx.correct();
      Confetti.burst(30, window.innerHeight * 0.45);
      Store.noteChars(a.key, true);
      ui.msg.textContent = '✨ ' + a.key + '  ' + a.en + '!';
      Mini.later(() => { Sfx.stopSpeak(); Sfx.speakZhEn(a.key, a.en); }, 350);
      if (matched === pairs) Mini.later(finish, 1600);
    } else {
      busy = true;
      Mini.later(() => {
        a.el.classList.remove('flipped'); b.el.classList.remove('flipped');
        busy = false;
      }, 950);
    }
  }

  function finish() {
    // fewer flips = more stars; a perfect memory needs exactly `pairs` moves
    const stars = moves <= pairs * 1.6 ? 3 : moves <= pairs * 2.6 ? 2 : 1;
    const score = Math.max(100, pairs * 200 - (moves - pairs) * 25);
    Mini.finish({
      packId: 'zh-match', correct: pairs, total: pairs, score, stars,
      line: `You matched ${pairs} pairs in ${moves} flips`,
      replay: () => open(level)
    });
  }

  const api = { open, stop() { busy = true; } };
  return api;
})();
