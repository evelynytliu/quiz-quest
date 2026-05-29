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
  let timerTotal = 0;     // ms for the current question
  let timerRemaining = 0; // ms left, banked whenever the timer is paused
  let timerRunStart = 0;  // Date.now() when the current running segment began
  let locked = false;
  let countdownTimer = null;
  let advanceTimer = null;

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
    listenBtn: document.getElementById('q-listen'),
    listenStatus: document.getElementById('q-listen-status'),
    answers: document.getElementById('answer-grid'),
    feedback: document.getElementById('feedback'),
    fbIcon: document.getElementById('feedback-icon'),
    fbText: document.getElementById('feedback-text'),
    fbPoints: document.getElementById('feedback-points'),
    fbNext: document.getElementById('feedback-next'),
    rStars: document.getElementById('result-stars'),
    rTitle: document.getElementById('result-title'),
    rLine: document.getElementById('result-line'),
    rScore: document.getElementById('result-score'),
    rBest: document.getElementById('result-best')
  };

  el.speakBtn.addEventListener('click', () => {
    const q = queue[idx];
    if (q) { Sfx.tap(); clearSpeaking(); Sfx.speakList(q.speak || q.text, q.options, setSpeaking); }
  });

  /* ---------- voice answering ---------- */
  let listenToken = 0;   // bumped to invalidate stale recognition callbacks

  function setListenState(state, msg) {
    // state: 'idle' | 'listening'
    if (!el.listenBtn) return;
    el.listenBtn.classList.toggle('listening', state === 'listening');
    el.listenBtn.textContent = state === 'listening' ? '🎤 Listening…' : '🎤 Say your answer';
    if (el.listenStatus) el.listenStatus.textContent = msg || '';
  }

  function cancelListening() {
    listenToken++;        // any in-flight session's callbacks become no-ops
    Voice.stop();
    if (el.listenBtn) el.listenBtn.classList.remove('listening');
  }

  function startListening() {
    if (locked || !Voice.supported()) return;
    const q = queue[idx];
    if (!q) return;
    Sfx.stopSpeak();
    clearSpeaking();
    pauseTimer();                 // stop the clock — give them time to speak
    const my = ++listenToken;

    // no answer was chosen: show a message and start the clock again
    function done(msg, speak) {
      if (my !== listenToken) return;
      listenToken++;              // ensure only one termination path runs
      setListenState('idle', msg || '');
      resumeTimer();
      if (speak) Sfx.speak(speak);
    }
    const TRY = "Didn't catch that — try again, or tap your answer.";

    Voice.start({
      onStart: () => { if (my !== listenToken) return; setListenState('listening', 'Listening… say your answer!'); },
      onResult: (alts) => {
        if (my !== listenToken || locked) return;
        const i = spokenToIndex(alts, q.options);
        if (i >= 0) {
          listenToken++;                        // handled — keep timer paused, we're answering
          setListenState('idle', '');
          setSpeaking(i, true);                 // briefly show what was picked
          Voice.stop();
          setTimeout(() => { if (locked) return; setSpeaking(i, false); answer(i, el.answers.children[i]); }, 350);
        }
        // no confident match: let onEnd call done() and resume the clock
      },
      onError: (code) => {
        if (code === 'not-allowed' || code === 'service-not-allowed')
          done('🎤 Microphone is off — allow it in Settings, or just tap.');
        else if (code === 'network')
          done('🌐 Need internet for voice — tap your answer instead.');
        else if (code !== 'aborted')
          done(TRY, "I didn't catch that. Try again, or tap your answer.");
        // 'aborted' = we stopped on purpose; ignore
      },
      onEnd: () => { done(TRY, "I didn't catch that. Try again, or tap your answer."); }
    });
  }

  if (el.listenBtn) el.listenBtn.addEventListener('click', () => { Sfx.tap(); startListening(); });

  // ----- match spoken words to one of the on-screen options -----
  const NUMWORDS = { zero:'0', one:'1', two:'2', three:'3', four:'4', five:'5', six:'6',
    seven:'7', eight:'8', nine:'9', ten:'10', eleven:'11', twelve:'12', thirteen:'13',
    fourteen:'14', fifteen:'15', sixteen:'16', seventeen:'17', eighteen:'18',
    nineteen:'19', twenty:'20' };
  const TRUE_WORDS = ['true', 'yes', 'right', 'correct', 'yeah', 'yep', 'yup'];
  const FALSE_WORDS = ['false', 'no', 'wrong', 'nope', 'nah'];

  function normalize(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function toDigits(s) { return s.split(' ').map(w => NUMWORDS[w] || w).join(' '); }
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const d = Array.from({ length: m + 1 }, (_, i) => [i].concat(new Array(n).fill(0)));
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[m][n];
  }

  function spokenToIndex(alts, options) {
    const opts = options.map(o => toDigits(normalize(o)));
    let best = -1, bestScore = 0;

    for (const raw of alts || []) {
      const t = toDigits(normalize(raw));
      if (!t) continue;
      const tokens = t.split(' ');

      // True / False questions: accept friendly synonyms
      if (options.length === 2 && (opts[0] === 'true' || opts[1] === 'false')) {
        const ti = opts[0] === 'true' ? 0 : 1;
        const fi = opts[1] === 'false' ? 1 : 0;
        for (const tok of tokens) {
          if (TRUE_WORDS.indexOf(tok) >= 0) return ti;
          if (FALSE_WORDS.indexOf(tok) >= 0) return fi;
        }
      }

      for (let i = 0; i < opts.length; i++) {
        const o = opts[i];
        let score = 0;
        if (t === o) score = 100;
        else if (tokens.indexOf(o) >= 0) score = 92;            // option is one spoken word
        else if (o.length >= 3 && t.indexOf(o) >= 0) score = 82; // option phrase inside speech
        else if (t.length >= 3 && o.indexOf(t) >= 0) score = 72;
        else if (o.indexOf(' ') < 0) {                           // single-word option: fuzzy
          for (const tok of tokens) {
            if (tok === o) { score = Math.max(score, 92); }
            else if (o.length >= 4 && lev(tok, o) <= 1) { score = Math.max(score, 76); }
          }
        } else {                                                 // multi-word option: token overlap
          const oset = o.split(' ');
          let shared = 0;
          tokens.forEach(tok => { if (oset.indexOf(tok) >= 0) shared++; });
          if (shared) score = 45 + shared * 16;
        }
        if (score > bestScore) { bestScore = score; best = i; }
      }
    }
    return bestScore >= 72 ? best : -1;   // need a fairly confident match
  }

  el.fbNext.addEventListener('click', () => { Sfx.tap(); clearTimeout(advanceTimer); next(); });

  function start(pId, questions) {
    packId = pId;
    queue = questions;
    idx = 0; score = 0; streak = 0; bestStreak = 0; correctCount = 0;
    Sfx.resume();
    runCountdown();
  }

  function runCountdown() {
    const pack = Store.getPack(packId);
    const who = Store.getCurrentPlayer();
    el.cdPack.textContent = (pack ? pack.emoji + ' ' + pack.name : '')
      + (who ? ' — ' + who + ', Get Ready!' : ' — Get Ready!');
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

  // gently enlarge the answer button the voice is currently reading
  function setSpeaking(i, on) {
    const b = el.answers.children[i];
    if (b) b.classList.toggle('speaking', on);
  }
  function clearSpeaking() {
    [...el.answers.children].forEach(b => b.classList.remove('speaking'));
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

    // ----- answers -----
    el.answers.innerHTML = '';
    if (q.type === 'tf') {
      // big O (True) / X (False) buttons
      el.answers.className = 'answer-grid tf-grid';
      const defs = [
        { cls: 'tf-o', sym: '◯', label: q.options[0] || 'True' },
        { cls: 'tf-x', sym: '✕', label: q.options[1] || 'False' }
      ];
      defs.forEach((d, i) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn tf-btn ' + d.cls;
        btn.innerHTML = '<span class="tf-sym">' + d.sym + '</span>'
          + '<span class="tf-label">' + escapeHtml(d.label) + '</span>';
        btn.addEventListener('click', () => answer(i, btn));
        el.answers.appendChild(btn);
      });
    } else {
      // multiple choice — each with a 🔊 chip so Miles can hear that one option
      el.answers.className = 'answer-grid';
      q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn a' + i;
        btn.innerHTML = '<span class="shape">' + SHAPES[i] + '</span>'
          + '<span class="label">' + escapeHtml(opt) + '</span>'
          + '<span class="opt-speak" title="Hear it">🔊</span>';
        btn.addEventListener('click', () => answer(i, btn));
        btn.querySelector('.opt-speak').addEventListener('click', e => {
          e.stopPropagation();
          if (!locked) { Sfx.stopSpeak(); clearSpeaking(); Sfx.speak(String(opt), on => setSpeaking(i, on)); }
        });
        el.answers.appendChild(btn);
      });
    }

    // voice answering: offer the mic only when the browser supports it
    cancelListening();
    if (el.listenBtn) {
      if (Voice.supported()) { el.listenBtn.classList.remove('hidden'); el.listenBtn.disabled = false; }
      else { el.listenBtn.classList.add('hidden'); }
    }
    setListenState('idle', '');

    // auto-read the question AND every option aloud (kids decode by sound)
    setTimeout(() => Sfx.speakList(q.speak || q.text, q.options, setSpeaking), 300);

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
    timerTotal = seconds * 1000;
    timerRemaining = timerTotal;
    el.timerBar.classList.remove('warn');
    el.timerBar.style.width = '100%';
    el.timerNum.textContent = seconds;
    runTimer();
  }

  function runTimer() {
    clearInterval(timer);
    timerRunStart = Date.now();
    timer = setInterval(() => {
      const left = Math.max(0, timerRemaining - (Date.now() - timerRunStart));
      const pct = (left / timerTotal) * 100;
      el.timerBar.style.width = pct + '%';
      const secLeft = Math.ceil(left / 1000);
      el.timerNum.textContent = secLeft;
      if (pct < 35) el.timerBar.classList.add('warn');
      if (secLeft <= 5 && secLeft > 0 && !locked) Sfx.tick();
      if (left <= 0) { clearInterval(timer); timer = null; if (!locked) timeUp(); }
    }, 100);
  }

  // pause the countdown (e.g. while listening to a spoken answer)
  function pauseTimer() {
    if (!timer) return;
    timerRemaining = Math.max(0, timerRemaining - (Date.now() - timerRunStart));
    clearInterval(timer); timer = null;
  }
  function resumeTimer() {
    if (timer || locked || timerRemaining <= 0) return;
    runTimer();
  }
  // seconds actually consumed so far (excludes any paused/talking time)
  function timerUsedSeconds() {
    let left = timerRemaining;
    if (timer) left = Math.max(0, timerRemaining - (Date.now() - timerRunStart));
    return (timerTotal - left) / 1000;
  }

  function answer(choice, btn) {
    if (locked) return;
    locked = true;
    clearInterval(timer);
    Sfx.stopSpeak();
    cancelListening();
    if (el.listenBtn) el.listenBtn.disabled = true;
    setListenState('idle', '');
    const q = queue[idx];
    const right = choice === q.correct;
    const used = timerUsedSeconds();   // excludes time spent talking/listening
    const limit = q.time || 20;

    // disable buttons & reveal
    [...el.answers.children].forEach((b, i) => {
      b.style.pointerEvents = 'none';
      b.classList.remove('speaking');
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
    showFeedback(right, gained, q.options[q.correct]);
  }

  function timeUp() {
    locked = true;
    Sfx.stopSpeak();
    cancelListening();
    if (el.listenBtn) el.listenBtn.disabled = true;
    setListenState('idle', '');
    const q = queue[idx];
    [...el.answers.children].forEach((b, i) => {
      b.style.pointerEvents = 'none';
      b.classList.remove('speaking');
      if (i === q.correct) b.classList.add('right'); else b.classList.add('dimmed');
    });
    streak = 0;
    Sfx.wrong();
    showFeedback(null, 0, q.options[q.correct]);
  }

  const PRAISE = ['Correct!', 'Yes! 🎉', 'Awesome!', 'You got it!', 'Super!', 'Nice one!'];
  const TRYAGAIN = ['Good try!', 'Almost!', 'Keep going!', 'Nice try!'];

  function showFeedback(right, gained, correctText) {
    clearTimeout(advanceTimer);
    el.feedback.classList.remove('hidden');
    el.feedback.classList.toggle('correct', right === true);
    el.feedback.classList.toggle('wrong', right !== true);

    if (right === true) {
      el.fbIcon.textContent = ['🎉', '🌟', '🚀', '💪', '🏆'][Math.floor(Math.random() * 5)];
      el.fbText.textContent = PRAISE[Math.floor(Math.random() * PRAISE.length)];
      el.fbPoints.textContent = '+' + gained + (streak >= 2 ? '   🔥' + streak : '');
      el.fbNext.textContent = 'Next ▶';
      // got it right — keep the pace, but Next can skip ahead
      advanceTimer = setTimeout(next, 1700);
    } else {
      el.fbIcon.textContent = right === false ? '🙈' : '⏰';
      el.fbText.textContent = right === false
        ? TRYAGAIN[Math.floor(Math.random() * TRYAGAIN.length)]
        : "Time's up!";
      el.fbPoints.innerHTML = 'The answer is: <span class="ans">' + escapeHtml(correctText) + '</span>';
      el.fbNext.textContent = 'Got it ▶';
      // wrong / timed out — wait for Miles to look, read the answer aloud
      setTimeout(() => Sfx.speak('The answer is ' + correctText), 450);
    }
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
    const who = Store.getCurrentPlayer();
    el.rLine.textContent = `${who ? who + ', you' : 'You'} got ${correctCount} / ${total} right` + (bestStreak >= 3 ? `  •  best streak 🔥${bestStreak}` : '');
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

  function stop() { clearInterval(timer); clearInterval(countdownTimer); Sfx.stopSpeak(); cancelListening(); }

  function currentPack() { return packId; }

  return { start, stop, currentPack };
})();
