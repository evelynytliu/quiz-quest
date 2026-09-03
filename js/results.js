/* The shared results screen: stars, score, high score, coins and daily
   quests. The quiz engine and every mini-game finish here, so a round of
   Bingo pays out exactly like a round of Character Quest. */
window.Results = (function () {
  const el = {
    stars: document.getElementById('result-stars'),
    title: document.getElementById('result-title'),
    line: document.getElementById('result-line'),
    score: document.getElementById('result-score'),
    best: document.getElementById('result-best'),
    coins: document.getElementById('result-coins'),
    quests: document.getElementById('result-quests'),
    buddy: document.getElementById('result-buddy'),
    prizes: document.getElementById('go-prizes')
  };
  let replayFn = null;
  let lastPack = '';

  /* opts: { packId, correct, total, score, bestStreak, line, replay }
       line   — optional custom summary ("You matched 8 pairs in 21 flips")
       replay — optional function that starts the same game again */
  function show(opts) {
    const total = opts.total || 1;
    const correct = opts.correct || 0;
    const ratio = correct / total;
    let stars = 1;
    if (ratio >= 0.9) stars = 3; else if (ratio >= 0.6) stars = 2;
    if (opts.stars) stars = opts.stars;
    el.stars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

    const titles = stars === 3 ? ['Quiz Champion! 🏆', 'Incredible! 🤩', 'Perfect Brain! 🧠']
      : stars === 2 ? ['Great job! 🎉', 'Well done! 👏', 'So good! 🌟']
      : ['Good try! 💪', 'Keep practising! 🚀', 'Nice effort! 😊'];
    el.title.textContent = titles[Math.floor(Math.random() * titles.length)];
    const who = Store.getCurrentPlayer();
    el.line.textContent = opts.line
      || `${who ? who + ', you' : 'You'} got ${correct} / ${total} right`
        + (opts.bestStreak >= 3 ? `  •  best streak 🔥${opts.bestStreak}` : '');
    el.score.textContent = opts.score || 0;

    lastPack = opts.packId;
    replayFn = opts.replay || null;
    const isBest = Store.setBest(opts.packId, opts.score || 0);
    const best = Store.getBest(opts.packId);
    el.best.textContent = isBest ? '🏅 New high score!' : (best ? 'High score: ' + best : '');

    // prize-machine coins: one per correct answer, plus a star bonus.
    // Chinese games pay double — a little nudge towards learning characters.
    const pack = Store.getPack(opts.packId);
    const zh = !!(pack && pack.lang === 'zh');
    let coinsEarned = correct + (stars === 3 ? 5 : stars === 2 ? 2 : 0);
    if (zh) coinsEarned *= 2;
    if (coinsEarned) { Store.addCoins(coinsEarned); Sfx.coin(); }
    el.coins.textContent = coinsEarned
      ? '💰 +' + coinsEarned + ' coins earned!' + (zh ? ' 🀄 ×2 bonus!' : '')
      : '';

    // daily quests + the parent's learning log
    Store.logRound(opts.packId, correct, total);
    const questsDone = []
      .concat(zh ? Store.bumpQuest('zhround', 1) : [])
      .concat(Store.bumpQuest('correct', correct))
      .concat(Store.noteGamePlayed(opts.packId));
    if (el.quests) {
      el.quests.innerHTML = questsDone
        .map(q => '🎯 Daily quest done! ' + q.icon + ' +💰' + q.reward)
        .join('<br>');
      el.quests.classList.toggle('hidden', !questsDone.length);
      if (questsDone.length) { Sfx.coin(); Confetti.emojiBurst(['🎯', '⭐'], 10); }
    }
    if (el.prizes) el.prizes.textContent = '🎁 Prizes · 💰' + Store.getCoins();

    const buddy = Store.getBuddy();
    el.buddy.textContent = buddy;
    el.buddy.classList.toggle('hidden', !buddy);

    showScreen('results');
    Sfx.fanfare();
    if (stars >= 2) { Confetti.rain(120); setTimeout(() => Confetti.rain(80), 600); }
    if (stars === 3) Confetti.emojiBurst(['⭐', '🌟'], 16);
  }

  // called by the "Play again" button
  function replay() { return replayFn; }
  function currentPack() { return lastPack; }

  return { show, replay, currentPack };
})();
