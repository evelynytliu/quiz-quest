/* Quiz engine: countdown -> questions (timer + speed scoring + streaks) ->
   results. Relies on window.showScreen (main.js), window.Sfx, window.Confetti. */
window.Game = (function () {
  const SHAPES = ['▲', '◆', '●', '■'];

  let queue = [];
  let idx = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let correctCount = 0;
  let packId = '';
  let timer = null;
  let qStart = 0;
  let locked = false;
  let countdownTimer = null;

  // DOM
  const el = {
    cdPack: document.getElementById('countdown-pack'),
    cdNum: document.getElementById('countdown-number'),
    progress: document.getElementById('q-progress'),
    timerBar: document.getElementById('timer-bar'),
    timerNum: document.getElementById('timer-num'),
    score: document.getElementById('q-score'),
    streakFlag: document.getElementById('q-streak'),
    streakCount: document.getElementById('streak-count'),
    qEmoji: document.getElementById('q-emoji'),
    qText: document.getElementById('q-text'),
    speakBtn: document.getElementById('q-speak'),
    answers: document.getElementById('answer-grid'),
    feedback: document.getElementById('feedback'),
    fbIcon: document.getElementById('feedback-icon'),
    fbText: document.getElementById('feedback-text'),
    fbPoints: document.getElementById('feedback-points'),
    rStars: document.getElementById('result-stars'),
    rTitle: document.getElementById('result-title'),
    rLine: document.getElementById('result-line'),
    rScore: document.getElementById('result-score'),
    rBest: document.getElementById('result-best')
  };

  el.speakBtn.addEventListener('click', () => {
    const q = queue[idx];
    if (q) { Sfx.tap(); Sfx.speakList(q.speak || q.text, q.options); }
  });

  function start(pId, questions) {
    packId = pId;
    queue = questions;
    idx = 0; score = 0; streak = 0; bestStreak = 0; correctCount = 0;
    Sfx.resume();
    runCountdown();
  }

  function runCountdown() {
    const pack = Store.getPack(packId);
    el.cdPack.textContent = (pack ? pack.emoji + ' ' + pack.name : '') + ' — Get Ready!';
    showScreen('countdown');
    let n = 3;
    el.cdNum.textContent = n;
    Sfx.beep();
    countdownTimer = setInterval(() => {
      n--;
      if (n > 0) {
        el.cdNum.textContent = n;
        el.cdNum.style.animation = 'none'; void el.cdNum.offsetWidth; el.cdNum.style.animation = 'pop .6s ease';
        Sfx.beep();
      } else {
        el.cdNum.textContent = 'GO!';
        el.cdNum.style.animation = 'none'; void el.cdNum.offsetWidth; el.cdNum.style.animation = 'pop .6s ease';
        Sfx.go();
        clearInterval(countdownTimer);
        setTimeout(showQuestion, 650);
      }
    }, 800);
  }

  function showQuestion() {
    locked = false;
    const q = queue[idx];
    showScreen('quiz');
    el.progress.textContent = (idx + 1) + ' / ' + queue.length;
    el.score.textContent = score;
    el.feedback.classList.add('hidden');

    // ----- question visual -----
    const isCJK = q.emoji && /[㐀-鿿぀-ヿ가-힯]/.test(q.emoji);
    el.qEmoji.className = 'q-emoji' + (isCJK ? ' cjk-char' : '');
    if (q.math) {
      el.qEmoji.textContent = ['🚀', '🌟', '🧠', '🤖', '🎯', '🦖', '🍩', '⚡'][Math.floor(Math.random() * 8)];
      el.qText.innerHTML = renderMath(q.math, q.level);
    } else {
      el.qEmoji.textContent = q.emoji || '❓';
      el.qText.textContent = q.text;
    }

    // streak flag
    if (streak >= 2) { el.streakFlag.classList.remove('hidden'); el.streakCount.textContent = streak; }
    else { el.streakFlag.classList.add('hidden'); }

    // ----- answers (each with a 🔊 chip so Miles can hear that one option) -----
    el.answers.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn a' + i;
      btn.innerHTML = '<span class="shape">' + SHAPES[i] + '</span>'
        + '<span class="label">' + escapeHtml(opt) + '</span>'
        + '<span class="opt-speak" title="Hear it">🔊</span>';
      btn.addEventListener('click', () => answer(i, btn));
      btn.querySelector('.opt-speak').addEventListener('click', e => {
        e.stopPropagation();
        if (!locked) { Sfx.stopSpeak(); Sfx.speak(String(opt)); }
      });
      el.answers.appendChild(btn);
    });

    // auto-read the question AND every option aloud (Miles decodes by sound)
    setTimeout(() => Sfx.speakList(q.speak || q.text, q.options), 300);

    startTimer(q.time || 20);
    qStart = Date.now();
  }

  const MATH_OBJ = ['🍎', '🍪', '⭐', '🚀', '🏀', '🐢', '🎈', '⚽', '🦖', '🍓', '🐠', '🧁'];
  function renderMath(m, level) {
    const eq = '<div class="m-eq">'
      + '<span class="m-tile">' + m.a + '</span>'
      + '<span class="m-opb">' + m.op + '</span>'
      + '<span class="m-tile t2">' + m.b + '</span>'
      + '<span class="m-eqs">=</span>'
      + '<span class="m-qm">?</span></div>';
    if (level === 1) {
      const e = MATH_OBJ[Math.floor(Math.random() * MATH_OBJ.length)];
      if (m.op === '+') {
        return '<div class="m-objects">' + group(m.a, e) + '<span class="m-op2">＋</span>' + group(m.b, e) + '</div>' + eq;
      }
      return '<div class="m-objects">' + group(m.a, e, m.a - m.b) + '</div>'
        + '<div class="m-take">take away ' + m.b + '</div>' + eq;
    }
    return eq;
  }
  function group(n, e, fadeFrom) {
    let s = '<span class="m-grp">';
    for (let i = 0; i < n; i++) s += '<span class="ob' + (fadeFrom != null && i >= fadeFrom ? ' gone' : '') + '">' + e + '</span>';
    return s + '</span>';
  }

  function startTimer(seconds) {
    clearInterval(timer);
    const total = seconds * 1000;
    el.timerBar.classList.remove('warn');
    el.timerBar.style.width = '100%';
    el.timerNum.textContent = seconds;
    const t0 = Date.now();
    timer = setInterval(() => {
      const elapsed = Date.now() - t0;
      const left = Math.max(0, total - elapsed);
      const pct = (left / total) * 100;
      el.timerBar.style.width = pct + '%';
      const secLeft = Math.ceil(left / 1000);
      el.timerNum.textContent = secLeft;
      if (pct < 35) el.timerBar.classList.add('warn');
      if (secLeft <= 5 && secLeft > 0 && !locked) Sfx.tick();
      if (left <= 0) { clearInterval(timer); if (!locked) timeUp(); }
    }, 100);
  }

  function answer(choice, btn) {
    if (locked) return;
    locked = true;
    clearInterval(timer);
    Sfx.stopSpeak();
    const q = queue[idx];
    const right = choice === q.correct;
    const used = (Date.now() - qStart) / 1000;
    const limit = q.time || 20;

    // disable buttons & reveal
    [...el.answers.children].forEach((b, i) => {
      b.style.pointerEvents = 'none';
      if (i === q.correct) b.classList.add('right');
      else if (i === choice) b.classList.add('wrong');
      else b.classList.add('dimmed');
    });

    let gained = 0;
    if (right) {
      const factor = Math.max(0, 1 - (used / limit) * 0.5); // speed bonus, min ~half
      gained = Math.round(500 + 500 * factor);              // 500..1000
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      if (streak >= 2) gained += Math.min(streak, 8) * 50;  // streak bonus
      score += gained;
      correctCount++;
      Sfx.correct();
      Confetti.burst(40);
    } else {
      streak = 0;
      Sfx.wrong();
    }

    el.score.textContent = score;
    showFeedback(right, gained);
  }

  function timeUp() {
    locked = true;
    Sfx.stopSpeak();
    const q = queue[idx];
    [...el.answers.children].forEach((b, i) => {
      b.style.pointerEvents = 'none';
      if (i === q.correct) b.classList.add('right'); else b.classList.add('dimmed');
    });
    streak = 0;
    Sfx.wrong();
    showFeedback(null, 0);
  }

  const PRAISE = ['Correct!', 'Yes! 🎉', 'Awesome!', 'You got it!', 'Super!', 'Nice one!'];
  const TRYAGAIN = ['Good try!', 'Almost!', 'Keep going!', 'Nice try!'];

  function showFeedback(right, gained) {
    el.feedback.classList.remove('hidden');
    if (right === true) {
      el.fbIcon.textContent = ['🎉', '🌟', '🚀', '💪', '🏆'][Math.floor(Math.random() * 5)];
      el.fbText.textContent = PRAISE[Math.floor(Math.random() * PRAISE.length)];
      el.fbPoints.textContent = '+' + gained + (streak >= 2 ? '   🔥' + streak : '');
    } else if (right === false) {
      el.fbIcon.textContent = '🙈';
      el.fbText.textContent = TRYAGAIN[Math.floor(Math.random() * TRYAGAIN.length)];
      el.fbPoints.textContent = 'The right answer is shown above';
    } else {
      el.fbIcon.textContent = '⏰';
      el.fbText.textContent = "Time's up!";
      el.fbPoints.textContent = 'The right answer is shown above';
    }
    setTimeout(next, right ? 1500 : 2100);
  }

  function next() {
    idx++;
    if (idx < queue.length) showQuestion();
    else finish();
  }

  function finish() {
    el.feedback.classList.add('hidden');
    const total = queue.length;
    const ratio = correctCount / total;
    let stars = 1;
    if (ratio >= 0.9) stars = 3; else if (ratio >= 0.6) stars = 2;
    el.rStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

    const titles = stars === 3 ? ['Quiz Champion! 🏆', 'Incredible! 🤩', 'Perfect Brain! 🧠']
      : stars === 2 ? ['Great job! 🎉', 'Well done! 👏', 'So good! 🌟']
      : ['Good try! 💪', 'Keep practising! 🚀', 'Nice effort! 😊'];
    el.rTitle.textContent = titles[Math.floor(Math.random() * titles.length)];
    el.rLine.textContent = `You got ${correctCount} / ${total} right` + (bestStreak >= 3 ? `  •  best streak 🔥${bestStreak}` : '');
    el.rScore.textContent = score;

    const isBest = Store.setBest(packId, score);
    const best = Store.getBest(packId);
    el.rBest.textContent = isBest ? '🏅 New high score!' : (best ? 'High score: ' + best : '');

    showScreen('results');
    Sfx.fanfare();
    if (stars >= 2) { Confetti.rain(120); setTimeout(() => Confetti.rain(80), 600); }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function stop() { clearInterval(timer); clearInterval(countdownTimer); Sfx.stopSpeak(); }

  function currentPack() { return packId; }

  return { start, stop, currentPack };
})();
