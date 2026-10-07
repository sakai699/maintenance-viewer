// maintenance-module.js
// Phase 1: Maintenance dashboard shell + reuse PDFs registered in the Drawing tab.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let activeDrawingId = '';

  function createTab() {
    const tabs = $('featureTabs');
    if (!tabs || tabs.querySelector('[data-tab="maintenance"]')) return;
    const drawingTab = tabs.querySelector('[data-tab="drawing"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'feature-tab';
    button.dataset.tab = 'maintenance';
    button.title = '施設点検・維持管理';
    button.innerHTML = '<span class="tab-icon">▣</span><span>保全</span>';
    drawingTab?.after(button);
  }

  function createPanels() {
    const left = document.querySelector('.left-panel');
    const center = document.querySelector('.viewer-wrap');
    const right = document.querySelector('.right-panel');
    if (!left || !center || !right) return;

    const leftPanel = document.createElement('section');
    leftPanel.id = 'maintenancePanel';
    leftPanel.innerHTML = `
      <h2>施設点検・保全</h2>
      <div class="mt-filter-block">
        <b>状態</b>
        <label><input type="checkbox" checked> 健全</label>
        <label><input type="checkbox" checked> 経過観察</label>
        <label><input type="checkbox" checked> 要補修</label>
        <label><input type="checkbox" checked> 緊急対応</label>
        <label><input type="checkbox" checked> 未点検</label>
      </div>
      <div class="mt-filter-block">
        <b>対象区分</b>
        <select id="mtCategory">
          <option>すべて</option><option>建築</option><option>構造</option>
          <option>電気設備</option><option>空調設備</option><option>給排水設備</option>
        </select>
      </div>
      <h3>登録図面</h3>
      <div id="mtDrawingList" class="mt-drawing-list"></div>
      <p class="mt-note">図面の追加は「図面」タブで行います。</p>`;
    left.appendChild(leftPanel);

    const central = document.createElement('div');
    central.id = 'maintenanceView';
    central.className = 'maintenance-view';
    central.innerHTML = `
      <div class="mt-kpis">
        <div><small>点検対象</small><strong id="mtTotal">0</strong></div>
        <div class="ok"><small>健全</small><strong>0</strong></div>
        <div class="watch"><small>経過観察</small><strong>0</strong></div>
        <div class="repair"><small>要補修</small><strong>0</strong></div>
        <div class="urgent"><small>緊急対応</small><strong>0</strong></div>
      </div>
      <div class="mt-view-head">
        <div class="mt-view-tabs">
          <button type="button" class="active" data-mt-view="drawing">図面</button>
          <button type="button" data-mt-view="3d">3D</button>
          <button type="button" data-mt-view="photo">写真</button>
        </div>
        <b id="mtViewTitle">図面を選択してください</b>
      </div>
      <div id="mtDrawingArea" class="mt-drawing-area">
        <div id="mtEmpty" class="mt-empty">図面タブでPDFを登録し、左側の登録図面から選択してください。</div>
        <iframe id="mtPdfFrame" title="保全図面表示"></iframe>
        <div id="mtMarkerLayer" class="mt-marker-layer"></div>
      </div>
      <div id="mtPlaceholder" class="mt-placeholder"></div>`;
    center.appendChild(central);

    const detail = document.createElement('div');
    detail.id = 'maintenanceDetail';
    detail.className = 'maintenance-detail';
    detail.innerHTML = `
      <h2>点検・損傷情報</h2>
      <div class="mt-detail-empty">図面上の点検ポイントを選択してください。</div>
      <div class="mt-detail-grid">
        <label>管理番号<input value="P-001" disabled></label>
        <label>対象部位<input placeholder="例：基礎梁"></label>
        <label>損傷種別<select><option>ひび割れ</option><option>漏水</option><option>腐食</option><option>剥離</option><option>変形</option></select></label>
        <label>判定<select><option>健全</option><option>経過観察</option><option>要補修</option><option>緊急対応</option><option>未点検</option></select></label>
        <label>対応状況<select><option>未対応</option><option>詳細調査中</option><option>補修計画中</option><option>対応中</option><option>対応済</option></select></label>
        <label>コメント<textarea placeholder="点検所見を入力"></textarea></label>
      </div>
      <button type="button" disabled>フェーズ2で点検ポイント登録を実装</button>`;
    right.appendChild(detail);
  }

  function drawings() {
    return window.DrawingBridge?.getDrawings?.() || [];
  }

  function renderDrawings() {
    const host = $('mtDrawingList');
    if (!host) return;
    const items = drawings();
    if (!items.length) {
      host.innerHTML = '<div class="mt-no-drawing">登録図面はありません</div>';
      return;
    }
    host.innerHTML = items.map(item => `
      <button type="button" class="${item.id === activeDrawingId ? 'active' : ''}" data-id="${item.id}">
        <span>${item.name}</span><small>${(item.size / 1024).toFixed(1)} KB</small>
      </button>`).join('');
    host.querySelectorAll('button').forEach(button => {
      button.onclick = () => showDrawing(button.dataset.id);
    });
  }

  function showDrawing(id) {
    const item = drawings().find(row => row.id === id);
    if (!item) return;
    activeDrawingId = id;
    $('mtViewTitle').textContent = item.name;
    $('mtPdfFrame').src = item.url + '#view=FitH';
    $('mtPdfFrame').classList.add('active');
    $('mtEmpty').style.display = 'none';
    renderDrawings();
  }

  function setCenterView(name) {
    document.querySelectorAll('[data-mt-view]').forEach(button => button.classList.toggle('active', button.dataset.mtView === name));
    const drawing = name === 'drawing';
    $('mtDrawingArea').style.display = drawing ? 'block' : 'none';
    $('mtPlaceholder').style.display = drawing ? 'none' : 'grid';
    if (!drawing) $('mtPlaceholder').textContent = name === '3d' ? '3D連携はフェーズ3で実装します。' : '写真連携はフェーズ2で実装します。';
  }

  function activateMaintenance(enabled) {
    document.body.classList.toggle('maintenance-mode', enabled);
    if (enabled) {
      document.body.classList.remove('drawing-simple-mode');
      document.querySelectorAll('#featureTabs .feature-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === 'maintenance'));
      const title = $('tabTitle');
      if (title) title.innerHTML = '<b>保全</b><small>施設点検・損傷・補修情報</small>';
      renderDrawings();
      if (!activeDrawingId && drawings()[0]) showDrawing(drawings()[0].id);
    }
  }

  function bind() {
    document.querySelector('[data-tab="maintenance"]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      activateMaintenance(true);
    }, true);
    document.querySelectorAll('#featureTabs .feature-tab:not([data-tab="maintenance"])').forEach(button => {
      button.addEventListener('click', () => activateMaintenance(false), true);
    });
    document.querySelectorAll('[data-mt-view]').forEach(button => button.onclick = () => setCenterView(button.dataset.mtView));
    window.addEventListener('drawing-list-change', renderDrawings);
  }

  createTab();
  createPanels();
  bind();
  renderDrawings();
})();
