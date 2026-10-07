// navigation-module.js
// Non-destructive navigation layer. Existing feature tabs and their handlers remain intact.
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const legacyTabs = $('featureTabs');
  if (!legacyTabs || $('mainCategoryTabs')) return;

  const groups = [
    {
      id: 'facility',
      label: '施設',
      icon: '◆',
      items: [
        { label: '3Dモデル', tab: 'model' },
        { label: '点群', tab: 'pointcloud' },
        { label: '表示設定', tab: 'display' },
        { label: '切断', tab: 'clip' },
        { label: '測定', tab: 'measurement' }
      ]
    },
    {
      id: 'maintenance',
      label: '点検・保全',
      icon: '●',
      items: [
        { label: '点検一覧', tab: 'inspection' },
        { label: '保全管理', tab: 'maintenance' }
      ]
    },
    {
      id: 'materials',
      label: '資料',
      icon: '▤',
      items: [
        { label: '図面', tab: 'drawing' },
        { label: '写真・画像', tab: 'image' }
      ]
    },
    {
      id: 'analysis',
      label: '分析',
      icon: '▦',
      items: [
        { label: 'ダッシュボード', tab: 'bi' },
        { label: '時系列', tab: 'timeline' }
      ]
    },
    {
      id: 'management',
      label: '管理',
      icon: '⚙',
      items: [
        { label: 'プロジェクト', tab: 'admin-project', custom: true },
        { label: 'マスター', tab: 'admin-master', custom: true },
        { label: 'バックアップ', tab: 'admin-backup', custom: true }
      ]
    }
  ];

  const nav = document.createElement('div');
  nav.id = 'mainCategoryTabs';
  nav.className = 'main-category-tabs';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', '主要機能');

  const sub = document.createElement('div');
  sub.id = 'categorySubnav';
  sub.className = 'category-subnav';

  const subItems = document.createElement('div');
  subItems.className = 'category-subnav-items';
  const actions = document.createElement('div');
  actions.className = 'category-context-actions';
  sub.append(subItems, actions);

  // Keep the original tab list in the DOM so every existing click handler remains available.
  legacyTabs.classList.add('legacy-feature-tabs');

  // Place the main categories beside the application title, not in the left panel.
  const header = document.querySelector('header');
  const headerActionsSlot = header?.querySelector('.header-actions');
  if (header) {
    header.insertBefore(nav, headerActionsSlot || null);
    header.insertAdjacentElement('afterend', sub);
  }

  nav.innerHTML = groups.map(group => `
    <button type="button" class="main-category-tab" data-category="${group.id}">
      <span class="main-category-icon">${group.icon}</span>
      <span>${group.label}</span>
    </button>`).join('');

  const csvImport = $('csvImportBtn');
  const csvExport = $('csvBtn');
  const csvInput = $('csvImportFile');
  const bpo = $('bpoBtn');
  const originalActions = document.querySelector('.header-actions');

  function moveContextActions(categoryId) {
    actions.innerHTML = '';
    if (categoryId === 'maintenance') {
      if (csvImport) {
        csvImport.textContent = '点検データ読込';
        actions.appendChild(csvImport);
      }
      if (csvExport) {
        csvExport.textContent = '点検データ出力';
        actions.appendChild(csvExport);
      }
      if (csvInput) actions.appendChild(csvInput);
      if (bpo) actions.appendChild(bpo);
    } else if (originalActions && bpo && !originalActions.contains(bpo)) {
      // BPO is also inspection-related, so keep it with inspection actions only.
    }
  }

  function clickLegacy(tabName) {
    const target = legacyTabs.querySelector(`[data-tab="${tabName}"]`);
    if (target) {
      target.click();
      return true;
    }
    return false;
  }

  function renderSubnav(group, preferredTab) {
    subItems.innerHTML = group.items.map(item => `
      <button type="button" class="category-subnav-button" data-target-tab="${item.tab}">${item.label}</button>`
    ).join('');

    subItems.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        subItems.querySelectorAll('button').forEach(node => node.classList.toggle('active', node === button));
        const item = group.items.find(row => row.tab === button.dataset.targetTab);
        if (item?.custom) {
          window.dispatchEvent(new CustomEvent('admin-view-change', { detail: { view: item.tab } }));
        } else {
          window.dispatchEvent(new CustomEvent('admin-view-change', { detail: { view: null } }));
          clickLegacy(button.dataset.targetTab);
        }
        localStorage.setItem('infra-active-category', group.id);
        localStorage.setItem(`infra-active-subtab-${group.id}`, button.dataset.targetTab);
      });
    });

    const selected = subItems.querySelector(`[data-target-tab="${preferredTab}"]`) || subItems.querySelector('button');
    if (selected) selected.click();
    moveContextActions(group.id);
  }

  function activateCategory(groupId, clickFirst = true) {
    const group = groups.find(item => item.id === groupId) || groups[0];
    nav.querySelectorAll('.main-category-tab').forEach(button => {
      button.classList.toggle('active', button.dataset.category === group.id);
      button.setAttribute('aria-current', button.dataset.category === group.id ? 'page' : 'false');
    });
    document.body.dataset.mainCategory = group.id;
    document.body.classList.toggle('admin-mode', group.id === 'management');
    if (group.id !== 'management') window.dispatchEvent(new CustomEvent('admin-view-change', { detail: { view: null } }));
    localStorage.setItem('infra-active-category', group.id);
    const preferred = localStorage.getItem(`infra-active-subtab-${group.id}`) || group.items[0]?.tab;
    if (clickFirst) renderSubnav(group, preferred);
  }

  nav.querySelectorAll('.main-category-tab').forEach(button => {
    button.addEventListener('click', () => activateCategory(button.dataset.category));
  });

  // If an existing screen changes its active legacy tab, update only the subnav highlight.
  const observer = new MutationObserver(() => {
    const activeLegacy = legacyTabs.querySelector('.feature-tab.active');
    if (!activeLegacy) return;
    const currentGroup = groups.find(group => group.id === document.body.dataset.mainCategory);
    const match = currentGroup?.items.find(item => item.tab === activeLegacy.dataset.tab);
    if (!match) return;
    subItems.querySelectorAll('button').forEach(button => {
      button.classList.toggle('active', button.dataset.targetTab === activeLegacy.dataset.tab);
    });
  });
  observer.observe(legacyTabs, { subtree: true, attributes: true, attributeFilter: ['class'] });

  const initialCategory = localStorage.getItem('infra-active-category') || 'facility';
  activateCategory(initialCategory);
})();
