// drawing-module.js
// GitHub Pages compatible: drag-and-drop PDF viewer, session storage only.
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const drawings = [];
  let activeId = '';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function isPdf(file) {
    return !!file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  }

  function createUi() {
    // Remove any stale UI left by an older/cached module before rebuilding.
    $('drawingFeaturePanel')?.remove();
    $('dwSimpleView')?.remove();
    const left = document.querySelector('.left-panel');
    const viewerWrap = document.querySelector('.viewer-wrap');
    if (!left || !viewerWrap) throw new Error('図面表示領域を作成できません。');

    const panel = document.createElement('section');
    panel.id = 'drawingFeaturePanel';
    panel.dataset.featureTab = 'drawing';
    panel.innerHTML = `
      <h2>PDF図面台帳</h2>
      <p class="dw-help">PDFを下の枠、または中央の表示領域へドラッグ＆ドロップしてください。</p>
      <div id="dwDropZone" class="dw-drop-zone" tabindex="0" role="button">
        <b>PDFをここにドロップ</b>
        <span>またはクリックして選択</span>
      </div>
      <input id="dwFile" class="dw-hidden" type="file" accept="application/pdf,.pdf" multiple>
      <div class="drawing-actions">
        <button id="dwSelect" type="button">ファイルを選択</button>
        <button id="dwClearAll" type="button" class="secondary">全解除</button>
      </div>
      <div id="dwMessage" class="dw-message">PDFはまだ登録されていません。</div>
      <div id="dwList" class="dw-list"></div>
      <p class="dw-help">一時表示方式です。ページを再読み込みすると一覧は解除されます。</p>`;
    left.appendChild(panel);

    const view = document.createElement('div');
    view.id = 'dwSimpleView';
    view.className = 'dw-simple-view';
    view.innerHTML = `
      <div class="dw-simple-head">
        <b id="dwSimpleTitle">PDF図面をドロップしてください</b>
        <div>
          <button id="dwAddMore" type="button">PDFを追加</button>
          <button id="dwOpenNew" type="button" disabled>別タブで開く</button>
          <button id="dwRemove" type="button" class="danger" disabled>この図面を解除</button>
        </div>
      </div>
      <div id="dwAddDrop" class="dw-add-drop">ここへ別のPDFをドロップして追加</div>
      <div id="dwCenterDrop" class="dw-center-drop">
        <div class="dw-center-drop-inner">
          <strong>PDF図面をここへドラッグ＆ドロップ</strong>
          <span>複数ファイルにも対応しています</span>
          <button id="dwCenterSelect" type="button">ファイルを選択</button>
        </div>
      </div>
      <iframe id="dwSimpleFrame" title="PDF図面表示"></iframe>`;
    viewerWrap.appendChild(view);
  }

  function setMessage(text, error = false) {
    const node = $('dwMessage');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('error', error);
  }

  function renderList() {
    window.dispatchEvent(new CustomEvent('drawing-list-change', {
      detail: drawings.map(item => ({ id: item.id, name: item.name, size: item.size, url: item.url }))
    }));
    const list = $('dwList');
    if (!list) return;
    if (!drawings.length) {
      list.innerHTML = '<div class="dw-empty">登録図面はありません</div>';
      return;
    }
    list.innerHTML = drawings.map(d => `
      <button type="button" class="dw-card${d.id === activeId ? ' active' : ''}" data-id="${d.id}">
        <span class="dw-name">${esc(d.name)}</span>
        <span class="dw-meta">${(d.size / 1024).toFixed(1)} KB</span>
        <span class="dw-badge">PDF</span>
      </button>`).join('');
    list.querySelectorAll('.dw-card').forEach(card => {
      card.onclick = () => showDrawing(card.dataset.id);
    });
  }

  function showDrawing(id) {
    const item = drawings.find(d => d.id === id);
    if (!item) return;
    activeId = id;
    $('dwSimpleTitle').textContent = item.name;
    $('dwSimpleFrame').src = item.url + '#view=FitH';
    $('dwSimpleFrame').classList.add('active');
    $('dwCenterDrop').classList.add('has-pdf');
    $('dwOpenNew').disabled = false;
    $('dwRemove').disabled = false;
    setMessage('表示中: ' + item.name);
    renderList();
  }

  function addFiles(fileList) {
    const files = [...(fileList || [])];
    const pdfFiles = files.filter(isPdf);
    if (!pdfFiles.length) {
      setMessage('PDFファイルをドロップしてください。', true);
      return;
    }

    let last = null;
    for (const file of pdfFiles) {
      const duplicate = drawings.find(d => d.name === file.name && d.size === file.size);
      if (duplicate) {
        last = duplicate;
        continue;
      }
      last = {
        id: 'DW-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file)
      };
      drawings.push(last);
    }
    renderList();
    if (last) showDrawing(last.id);
  }

  function removeDrawing(id) {
    const index = drawings.findIndex(d => d.id === id);
    if (index < 0) return;
    URL.revokeObjectURL(drawings[index].url);
    drawings.splice(index, 1);
    activeId = '';
    $('dwSimpleFrame').src = 'about:blank';
    $('dwSimpleFrame').classList.remove('active');
    $('dwCenterDrop').classList.remove('has-pdf');
    $('dwSimpleTitle').textContent = 'PDF図面をドロップしてください';
    $('dwOpenNew').disabled = true;
    $('dwRemove').disabled = true;
    renderList();
    if (drawings[0]) showDrawing(drawings[0].id);
    else setMessage('PDFはまだ登録されていません。');
  }

  function clearAll() {
    drawings.forEach(d => URL.revokeObjectURL(d.url));
    drawings.length = 0;
    activeId = '';
    $('dwSimpleFrame').src = 'about:blank';
    $('dwSimpleFrame').classList.remove('active');
    $('dwCenterDrop').classList.remove('has-pdf');
    $('dwSimpleTitle').textContent = 'PDF図面をドロップしてください';
    $('dwOpenNew').disabled = true;
    $('dwRemove').disabled = true;
    setMessage('PDFはまだ登録されていません。');
    renderList();
  }

  function bindDropZone(element) {
    if (!element) return;
    ['dragenter', 'dragover'].forEach(type => element.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      element.classList.add('dragging');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }));
    ['dragleave', 'drop'].forEach(type => element.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      element.classList.remove('dragging');
    }));
    element.addEventListener('drop', event => addFiles(event.dataTransfer?.files));
  }

  function setDrawingMode(enabled) {
    document.body.classList.toggle('drawing-simple-mode', enabled);
  }

  function bind() {
    // Create a fresh native file input every time. This avoids stale input/change
    // handlers and allows the same PDF to be selected again.
    const openPicker = () => {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = '.pdf,application/pdf';
      picker.multiple = true;
      picker.style.position = 'fixed';
      picker.style.left = '-9999px';
      picker.style.top = '-9999px';
      document.body.appendChild(picker);

      let handled = false;
      const receive = () => {
        if (handled) return;
        handled = true;
        addFiles(picker.files);
        setTimeout(() => picker.remove(), 0);
      };
      picker.addEventListener('change', receive, { once: true });
      picker.addEventListener('input', receive, { once: true });
      picker.click();

      // Remove the temporary input when the picker is cancelled.
      window.addEventListener('focus', () => {
        setTimeout(() => {
          if (!handled) picker.remove();
        }, 500);
      }, { once: true });
    };

    $('dwSelect').onclick = openPicker;
    $('dwAddMore').onclick = openPicker;
    $('dwCenterSelect').onclick = openPicker;
    $('dwDropZone').onclick = openPicker;
    $('dwDropZone').onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    };
    $('dwClearAll').onclick = clearAll;
    $('dwRemove').onclick = () => activeId && removeDrawing(activeId);
    $('dwOpenNew').onclick = () => {
      const item = drawings.find(d => d.id === activeId);
      if (item) window.open(item.url, '_blank', 'noopener');
    };

    bindDropZone($('dwDropZone'));
    bindDropZone($('dwAddDrop'));
    bindDropZone($('dwCenterDrop'));

    // Robust left-panel drop handling. Some surrounding UI handlers intercept
    // bubbling drop events, so handle these in the capture phase.
    const leftDrawingPanel = $('drawingFeaturePanel');
    if (leftDrawingPanel) {
      ['dragenter', 'dragover'].forEach(type => {
        leftDrawingPanel.addEventListener(type, event => {
          const hasFiles = Array.from(event.dataTransfer?.types || []).includes('Files');
          if (!hasFiles) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          $('dwDropZone')?.classList.add('dragging');
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        }, true);
      });
      leftDrawingPanel.addEventListener('dragleave', event => {
        if (!leftDrawingPanel.contains(event.relatedTarget)) {
          $('dwDropZone')?.classList.remove('dragging');
        }
      }, true);
      leftDrawingPanel.addEventListener('drop', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        $('dwDropZone')?.classList.remove('dragging');
        addFiles(event.dataTransfer?.files);
      }, true);
    }

    // Prevent the browser from navigating to a dropped PDF outside the designated zones.
    document.addEventListener('dragover', event => event.preventDefault(), true);
    document.addEventListener('drop', event => {
      if (!event.target.closest('#dwDropZone, #dwAddDrop, #dwCenterDrop')) event.preventDefault();
    }, true);

    const syncMode = () => {
      const active = document.querySelector('#featureTabs .feature-tab.active');
      setDrawingMode(active?.dataset.tab === 'drawing');
    };
    document.querySelectorAll('#featureTabs .feature-tab').forEach(button => {
      button.addEventListener('click', () => {
        setDrawingMode(button.dataset.tab === 'drawing');
        setTimeout(syncMode, 0);
      });
    });
    const tabsRoot = $('featureTabs');
    if (tabsRoot) new MutationObserver(syncMode).observe(tabsRoot, {subtree:true, attributes:true, attributeFilter:['class']});
    syncMode();
    window.addEventListener('beforeunload', () => drawings.forEach(d => URL.revokeObjectURL(d.url)));
  }

  window.DrawingBridge = {
    getDrawings: () => drawings.map(item => ({ id: item.id, name: item.name, size: item.size, url: item.url })),
    showDrawing: id => showDrawing(id),
    addFiles: files => addFiles(files),
    getActiveId: () => activeId
  };

  try {
    createUi();
    bind();
    renderList();
  } catch (error) {
    console.error('Drawing module failed', error);
  }
})();
