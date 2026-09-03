/* Bingo 賓果: a board of characters; the caller says a word, the child
   stamps it. Three in a row wins. Works as a parent-and-child game too —
   the grown-up can read the calls instead of the tablet. */
window.Bingo = (function () {
  let level = 1;
  let size = 3;
  let board = [];        // words on the board, row-major
  let calls = [];        // the order they'll be called in
  let ci = 0;            // current call index
  let stamped = [];      // booleans, row-major
  let lines = 0;         // completed lines so far
  let need = 1;          // lines needed to win
  let right = 0, wrongs = 0, score = 0;
  let locked = false;
  let ui = {};

  function open(lv) {
    level = lv || 1;
    size = level === 1 ? 3 : 4;
    need = level;                       // 1, 2 or 3 lines to win
    const bank = window.ZH.WORDS.filter(w => w.pic && w.lv <= (level === 1 ? 2 : 3));
    board = Mini.sample(bank, size * size);
    calls = Store.shuffle(board.slice());
    ci = 0; lines = 0; right = 0; wrongs = 0; score = 0; locked = false;
    stamped = board.map(() => false);

    const stage = Mini.open(api, '🎱 Bingo 賓果');
    stage.innerHTML = `
      <div class="mini-head"><div class="mini-progress">🏆 <span class="bingo-lines">0</span> / ${need} lines</div>
        <div class="pill score-pill"><span class="mini-score">0</span> pts</div></div>
      <div class="bingo-call">
        <span class="bingo-call-pic"></span>
        <span class="bingo-call-txt">Listen… 聽好囉</span>
        <button class="speak-btn bingo-say" type="button">🔊 Hear it again</button>
      </div>
      <div class="bingo-board size-${size}"></div>
      <div class="mini-msg bingo-msg">Tap the character you hear! 聽到什麼就蓋什麼</div>
      <div class="bingo-banner hidden">BINGO!</div>`;
    ui = {
      lines: stage.querySelector('.bingo-lines'), score: stage.querySelector('.mini-score'),
      pic: stage.querySelector('.bingo-call-pic'), txt: stage.querySelector('.bingo-call-txt'),
      say: stage.querySelector('.bingo-say'), board: stage.querySelector('.bingo-board'),
      msg: stage.querySelector('.bingo-msg'), banner: stage.querySelector('.bingo-banner')
    };
    ui.say.addEventListener('click', () => { Sfx.tap(); sayCall(); });
    board.forEach((w, i) => {
      const cell = Mini.h('button', 'bingo-cell', '<span class="bingo-ch"></span><span class="bingo-stamp">✅</span>');
      cell.type = 'button';
      cell.querySelector('.bingo-ch').textContent = w.ch;
      cell.addEventListener('click', () => tap(i));
      ui.board.appendChild(cell);
    });
    Mini.later(call, 700);
  }

  function cur() { return calls[ci]; }
  function sayCall() { Sfx.stopSpeak(); Sfx.speakZh(cur().ch); }

  function call() {
    if (ci >= calls.length) return finish();
    locked = false;
    const w = cur();
    // picture hints on levels 1–2; level 3 is ears only
    ui.pic.textContent = level < 3 ? w.pic : '👂';
    ui.txt.textContent = level < 3 ? w.en : '…';
    ui.pic.classList.remove('pop'); void ui.pic.offsetWidth; ui.pic.classList.add('pop');
    sayCall();
  }

  function tap(i) {
    if (locked || stamped[i]) return;
    const cell = ui.board.children[i];
    if (board[i].ch !== cur().ch) {
      wrongs++;
      Sfx.wrong();
      cell.classList.add('shake');
      Mini.later(() => cell.classList.remove('shake'), 400);
      Store.noteChar(cur().ch, false);
      ui.msg.textContent = 'That one is ' + board[i].ch + '. Listen again! 再聽一次';
      Mini.later(sayCall, 400);
      return;
    }
    locked = true;
    stamped[i] = true;
    right++;
    score += 100;
    cell.classList.add('stamped');
    Sfx.pop();
    Store.noteChar(cur().ch, true);
    ui.msg.textContent = '✅ ' + cur().ch + '  ' + cur().en;
    Sfx.stopSpeak(); Sfx.speakZhEn(cur().ch, cur().en);
    const newLines = countLines();
    if (newLines > lines) {
      lines = newLines;
      ui.lines.textContent = lines;
      score += 500;
      ui.banner.classList.remove('hidden');
      ui.banner.classList.remove('pop'); void ui.banner.offsetWidth; ui.banner.classList.add('pop');
      Sfx.fanfare();
      Confetti.rain(100);
      Confetti.emojiBurst(['🎱', '⭐'], 12);
      Mini.later(() => ui.banner.classList.add('hidden'), 1500);
      if (lines >= need) { ui.score.textContent = score; return Mini.later(finish, 2000); }
    }
    ui.score.textContent = score;
    ci++;
    Mini.later(call, 1700);
  }

  // rows, columns and both diagonals
  function countLines() {
    let n = 0;
    const at = (r, c) => stamped[r * size + c];
    for (let r = 0; r < size; r++) if ([...Array(size).keys()].every(c => at(r, c))) n++;
    for (let c = 0; c < size; c++) if ([...Array(size).keys()].every(r => at(r, c))) n++;
    if ([...Array(size).keys()].every(i => at(i, i))) n++;
    if ([...Array(size).keys()].every(i => at(i, size - 1 - i))) n++;
    return n;
  }

  function finish() {
    const total = right + wrongs;
    Mini.finish({
      packId: 'zh-bingo', correct: right, total: Math.max(total, 1), score,
      line: `${lines} line${lines === 1 ? '' : 's'} of Bingo · ${right} stamps, ${wrongs} slips`,
      stars: wrongs === 0 ? 3 : wrongs <= 2 ? 2 : 1,
      replay: () => open(level)
    });
  }

  const api = { open, stop() { locked = true; } };
  return api;
})();
