/* Parent-facing question editor (Chinese UI). Add / edit / delete questions &
   packs, plus backup (export / import) and reset. */
window.Editor = (function () {
  const $ = id => document.getElementById(id);
  const form = $('question-form');

  const els = {
    packManager: $('pack-manager'),
    fPack: $('f-pack'),
    fType: $('f-type'),
    fText: $('f-text'),
    fEmoji: $('f-emoji'),
    fTime: $('f-time'),
    fLevel: $('f-level'),
    fId: $('f-id'),
    mcOptions: $('mc-options'),
    tfOptions: $('tf-options'),
    editorTitle: $('editor-title'),
    formCancel: $('form-cancel'),
    list: $('question-list'),
    filterPack: $('filter-pack'),
    qCount: $('q-count')
  };

  let filter = 'all';

  function init() {
    els.fType.addEventListener('change', syncType);
    form.addEventListener('submit', onSubmit);
    els.formCancel.addEventListener('click', resetForm);
    els.filterPack.addEventListener('change', () => { filter = els.filterPack.value; renderList(); });

    $('add-pack').addEventListener('click', onAddPack);
    $('export-btn').addEventListener('click', onExport);
    $('import-file').addEventListener('change', onImport);
    $('reset-btn').addEventListener('click', onReset);
  }

  function refresh() {
    renderPackManager();
    fillPackSelects();
    renderList();
    syncType();
  }

  /* ---------- pack manager ---------- */
  function renderPackManager() {
    els.packManager.innerHTML = '';
    Store.getPacks().forEach(p => {
      const row = document.createElement('div');
      row.className = 'pm-row';
      const cnt = p.generated ? '自動出題' : (Store.questionsFor(p.id).length + ' 題');
      row.innerHTML = `<span class="pm-emoji">${p.emoji}</span>
        <span class="pm-name">${escapeHtml(p.name)}</span>
        <span class="pm-count">${cnt}</span>`;
      if (!p.generated) {
        const del = document.createElement('button');
        del.className = 'pm-del'; del.textContent = '🗑️'; del.title = '刪除主題';
        del.addEventListener('click', () => {
          if (confirm(`刪除主題「${p.name}」與它的所有題目？`)) { Store.deletePack(p.id); refresh(); }
        });
        row.appendChild(del);
      }
      els.packManager.appendChild(row);
    });
  }

  function onAddPack() {
    const name = prompt('新主題名稱 (給小朋友看的，建議英文)：');
    if (!name) return;
    const emoji = prompt('這個主題的 emoji 圖示 (例如 🐊)：', '⭐') || '⭐';
    Store.addPack(name.trim(), emoji.trim());
    refresh();
  }

  /* ---------- selects ---------- */
  function fillPackSelects() {
    const packs = Store.getPacks().filter(p => !p.generated);
    els.fPack.innerHTML = packs.map(p => `<option value="${p.id}">${p.emoji} ${escapeHtml(p.name)}</option>`).join('');
    els.filterPack.innerHTML = '<option value="all">全部主題</option>' +
      Store.getPacks().filter(p => !p.generated).map(p => `<option value="${p.id}">${p.emoji} ${escapeHtml(p.name)}</option>`).join('');
    els.filterPack.value = filter;
  }

  /* ---------- type toggle ---------- */
  function syncType() {
    const tf = els.fType.value === 'tf';
    els.tfOptions.classList.toggle('hidden', !tf);
    els.mcOptions.classList.toggle('hidden', tf);
  }

  /* ---------- submit ---------- */
  function onSubmit(e) {
    e.preventDefault();
    const type = els.fType.value;
    const text = els.fText.value.trim();
    if (!text) { alert('請輸入題目文字'); return; }

    let options, correct;
    if (type === 'tf') {
      const v = form.querySelector('input[name="tfcorrect"]:checked').value;
      options = ['True', 'False'];
      correct = v === 'true' ? 0 : 1;
    } else {
      const inputs = [...form.querySelectorAll('.f-opt')];
      const raw = inputs.map(i => i.value.trim());
      const checked = form.querySelector('input[name="correct"]:checked');
      if (!checked) { alert('請點選哪一個是正確答案'); return; }
      const correctRaw = parseInt(checked.value, 10);
      if (!raw[correctRaw]) { alert('你標示的正確答案那一格是空的'); return; }
      options = []; correct = 0;
      raw.forEach((o, i) => { if (o) { if (i === correctRaw) correct = options.length; options.push(o); } });
      if (options.length < 2) { alert('至少要有 2 個選項'); return; }
    }

    const q = {
      id: els.fId.value || '',
      packId: els.fPack.value,
      type,
      emoji: els.fEmoji.value.trim(),
      text,
      options,
      correct,
      time: Math.max(5, Math.min(60, parseInt(els.fTime.value, 10) || 20)),
      level: parseInt(els.fLevel.value, 10) || 2
    };
    Store.upsertQuestion(q);
    resetForm();
    refresh();
    flash('✅ 已儲存！');
  }

  function resetForm() {
    form.reset();
    els.fId.value = '';
    els.editorTitle.textContent = '新增題目';
    els.formCancel.classList.add('hidden');
    syncType();
  }

  function editQuestion(id) {
    const q = Store.allQuestions().find(x => x.id === id);
    if (!q) return;
    if (q.type === 'zh') { alert('聽力題（中文發音）目前不支援在這裡編輯，可以直接刪除。'); return; }
    els.fId.value = q.id;
    els.fPack.value = q.packId;
    els.fType.value = q.type;
    els.fText.value = q.text;
    els.fEmoji.value = q.emoji || '';
    els.fTime.value = q.time || 20;
    els.fLevel.value = q.level || 2;
    syncType();
    if (q.type === 'tf') {
      form.querySelector(`input[name="tfcorrect"][value="${q.correct === 0 ? 'true' : 'false'}"]`).checked = true;
    } else {
      const inputs = [...form.querySelectorAll('.f-opt')];
      inputs.forEach((inp, i) => { inp.value = q.options[i] || ''; });
      const radio = form.querySelector(`input[name="correct"][value="${q.correct}"]`);
      if (radio) radio.checked = true;
    }
    els.editorTitle.textContent = '✏️ 編輯題目';
    els.formCancel.classList.remove('hidden');
    document.querySelector('.parent-main').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- list ---------- */
  function renderList() {
    const LEVELS = { 1: '🐣簡單', 2: '🦊中等', 3: '🐉挑戰' };
    let qs = Store.allQuestions();
    if (filter !== 'all') qs = qs.filter(q => q.packId === filter);
    els.qCount.textContent = '(' + qs.length + ' 題)';
    if (!qs.length) { els.list.innerHTML = '<p class="empty-note">這個主題還沒有題目，從上方表單新增吧！</p>'; return; }
    els.list.innerHTML = '';
    qs.forEach(q => {
      const pack = Store.getPack(q.packId);
      const item = document.createElement('div');
      item.className = 'q-item';
      item.innerHTML = `
        <span class="qi-emoji">${q.emoji || '❓'}</span>
        <div class="qi-body">
          <div class="qi-text">${escapeHtml(q.text)}</div>
          <div class="qi-meta">${pack ? pack.emoji + ' ' + escapeHtml(pack.name) : '?'} · ${q.type === 'tf' ? '是非題' : q.type === 'zh' ? '🔊 聽力題' : '選擇題'} · ${LEVELS[q.level] || ''}</div>
          <div class="qi-ans">✔ ${escapeHtml(q.options[q.correct])}</div>
        </div>
        <div class="qi-actions">
          <button class="qi-edit">編輯</button>
          <button class="qi-del">刪除</button>
        </div>`;
      item.querySelector('.qi-edit').addEventListener('click', () => editQuestion(q.id));
      item.querySelector('.qi-del').addEventListener('click', () => {
        if (confirm('刪除這一題？')) { Store.deleteQuestion(q.id); refresh(); }
      });
      els.list.appendChild(item);
    });
  }

  /* ---------- backup ---------- */
  function onExport() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `quiz-quest-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('⬇️ 已匯出備份檔');
  }

  function onImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!confirm('匯入會「覆蓋」目前的題庫，確定嗎？(建議先匯出備份)')) return;
        Store.importJSON(reader.result);
        refresh();
        flash('⬆️ 匯入成功！');
      } catch (err) { alert('匯入失敗：' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function onReset() {
    if (!confirm('還原成預設題庫？你自己新增的題目會被清除 (建議先匯出備份)。')) return;
    Store.resetDefaults();
    refresh();
    flash('♻️ 已還原預設題庫');
  }

  /* ---------- helpers ---------- */
  let flashTimer = null;
  function flash(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#26890c;color:#fff;padding:12px 22px;border-radius:999px;font-weight:700;z-index:500;box-shadow:0 6px 18px rgba(0,0,0,.3)';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 1600);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { init, refresh };
})();
