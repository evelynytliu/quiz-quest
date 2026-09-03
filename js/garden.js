/* Character Garden 字的花園: every character met in any game is a plant.
   Water it (answer it right) on the right days and it grows — seed,
   sprout, leaves, flower, tree. Spaced repetition in a flowerpot:
   the game that ties all the others together. */
window.Garden = (function () {
  const STAGE = ['🌰', '🌱', '🌿', '🌸', '🌳'];
  const STAGE_NAME = ['seed 種子', 'sprout 發芽', 'leaves 長葉', 'flower 開花', 'tree 大樹'];
  let ui = {};

  function open() {
    const stage = Mini.open(api, '🌱 Character Garden 字的花園');
    const st = Store.getCharStats();
    const chars = Object.keys(st);
    const due = Store.dueChars();
    const trees = chars.filter(c => st[c].stage >= 4).length;
    stage.innerHTML = `
      <div class="garden-top">
        <div class="garden-stats">
          <span>🌱 <b>${chars.length}</b> plants</span>
          <span>💧 <b>${due.length}</b> thirsty</span>
          <span>🌳 <b>${trees}</b> trees</span>
        </div>
        <button class="big-btn green garden-water" type="button">💧 Water the garden 澆水</button>
        <p class="garden-hint">${chars.length
          ? (due.length ? 'Thirsty plants grow when you answer them right today! 答對就會長大'
            : 'Everything is watered — come back tomorrow for more growing! 明天再來澆水')
          : 'Play any Chinese game to plant your first seeds! 玩任何中文遊戲就會種下種子'}</p>
      </div>
      <div class="garden-bed"></div>
      <div class="garden-legend">${STAGE.map((e, i) => '<span>' + e + ' ' + STAGE_NAME[i] + '</span>').join('')}</div>`;
    ui = { bed: stage.querySelector('.garden-bed'), water: stage.querySelector('.garden-water') };
    ui.water.disabled = !chars.length;
    ui.water.addEventListener('click', () => { Sfx.tap(); water(); });

    // thirsty plants first, then the biggest — pride of place for the trees
    chars.sort((a, b) => {
      const da = Store.charDue(st[a]) ? 1 : 0, db = Store.charDue(st[b]) ? 1 : 0;
      return db - da || st[b].stage - st[a].stage || a.localeCompare(b);
    });
    chars.forEach(ch => {
      const c = st[ch];
      const w = window.ZH.word(ch) || { en: '', pic: '' };
      const thirsty = Store.charDue(c);
      const p = Mini.h('button', 'plant stage-' + c.stage + (thirsty ? ' thirsty' : ''), '');
      p.type = 'button';
      p.innerHTML = '<span class="plant-emoji">' + STAGE[c.stage] + '</span>'
        + '<span class="plant-char"></span>'
        + (thirsty ? '<span class="plant-drop">💧</span>' : '')
        + '<span class="plant-en"></span>';
      p.querySelector('.plant-char').textContent = ch;
      p.querySelector('.plant-en').textContent = (w.pic ? w.pic + ' ' : '') + w.en;
      p.title = STAGE_NAME[c.stage] + ' · seen ' + c.seen + ' times';
      p.addEventListener('click', () => {
        Sfx.pop();
        p.classList.remove('wiggle'); void p.offsetWidth; p.classList.add('wiggle');
        Sfx.stopSpeak(); Sfx.speakZhEn(ch, w.en);
      });
      ui.bed.appendChild(p);
    });
    if (!chars.length) {
      ui.bed.innerHTML = '<div class="garden-empty">🪴<br>No plants yet!<br><small>Characters you meet in other games are planted here.</small></div>';
    }
  }

  // a watering round is a Character Quest about the thirsty characters
  function water() {
    const qs = Store.generateGarden(10);
    if (!qs.length) return;
    Mini.stop();
    Game.stop();
    Game.start('zh-garden', qs);
  }

  const api = { open, stop() {}, STAGE };
  return api;
})();
