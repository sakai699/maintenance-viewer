// admin-module.js - project, master and backup management without altering existing feature logic.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY_PROJECT = 'infra-admin-project-v1';
  const KEY_MASTER = 'infra-admin-master-v1';
  const defaults = {
    categories: ['建築','構造','電気設備','空調設備','給排水設備'],
    damages: ['ひび割れ','漏水','腐食','剥離','変形'],
    judgements: ['健全','経過観察','要補修','緊急対応','未点検'],
    actions: ['未対応','詳細調査中','補修計画中','対応中','対応済']
  };
  const getJson = (k,d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function create() {
    if ($('adminWorkspace')) return;
    const node = document.createElement('div');
    node.id = 'adminWorkspace';
    node.className = 'admin-workspace';
    node.innerHTML = `
      <div class="admin-hero">
        <div><span class="admin-eyebrow">SYSTEM MANAGEMENT</span><h2>運用管理センター</h2><p>プロジェクト情報、入力マスター、バックアップを一か所で管理します。</p></div>
        <div class="admin-health"><span class="admin-pulse"></span><div><b>ローカル環境</b><small>ブラウザー保存を使用中</small></div></div>
      </div>
      <section id="admin-project" class="admin-view">
        <div class="admin-section-head"><div><span>PROJECT PROFILE</span><h3>プロジェクト情報</h3></div><button id="adminSaveProject" type="button">変更を保存</button></div>
        <div class="admin-card-grid project-grid">
          <label class="admin-field wide"><span>プロジェクト名</span><input id="apName" placeholder="例：A施設 維持管理プロジェクト"></label>
          <label class="admin-field"><span>施設ID</span><input id="apFacilityId" placeholder="FAC-001"></label>
          <label class="admin-field"><span>対象年度</span><input id="apYear" type="number" min="2000" max="2100"></label>
          <label class="admin-field wide"><span>施設名</span><input id="apFacilityName" placeholder="施設名称"></label>
          <label class="admin-field wide"><span>所在地</span><input id="apAddress" placeholder="所在地"></label>
          <label class="admin-field"><span>管理担当</span><input id="apManager" placeholder="担当部署・担当者"></label>
          <label class="admin-field"><span>点検基準日</span><input id="apInspectionDate" type="date"></label>
          <label class="admin-field wide"><span>備考</span><textarea id="apNote" rows="4" placeholder="運用上の注意事項"></textarea></label>
        </div>
      </section>
      <section id="admin-master" class="admin-view">
        <div class="admin-section-head"><div><span>DATA STANDARDIZATION</span><h3>マスター管理</h3></div><button id="adminResetMaster" type="button" class="admin-secondary">標準値へ戻す</button></div>
        <div id="adminMasterCards" class="master-grid"></div>
      </section>
      <section id="admin-backup" class="admin-view">
        <div class="admin-section-head"><div><span>DATA PROTECTION</span><h3>バックアップ</h3></div><span id="adminBackupStatus" class="admin-status-pill">準備完了</span></div>
        <div class="backup-grid">
          <article class="backup-card export"><div class="backup-icon">↓</div><h3>全設定を書き出す</h3><p>このビューワーのブラウザー保存データをJSONとして保存します。</p><button id="adminExport" type="button">バックアップを作成</button></article>
          <article class="backup-card import"><div class="backup-icon">↑</div><h3>バックアップを復元</h3><p>以前に書き出したJSONを読み込み、保存データを復元します。</p><button id="adminImport" type="button">バックアップを選択</button><input id="adminImportFile" type="file" accept="application/json,.json" hidden></article>
          <article class="backup-card danger"><div class="backup-icon">×</div><h3>保存データを初期化</h3><p>このサイトがブラウザーに保存した情報を削除します。</p><button id="adminClear" type="button">初期化する</button></article>
        </div>
      </section>`;
    document.body.appendChild(node);
  }

  function loadProject() {
    const d=getJson(KEY_PROJECT,{}); const map={apName:'name',apFacilityId:'facilityId',apYear:'year',apFacilityName:'facilityName',apAddress:'address',apManager:'manager',apInspectionDate:'inspectionDate',apNote:'note'};
    Object.entries(map).forEach(([id,key])=>{if($(id)) $(id).value=d[key]||'';});
  }
  function saveProject() {
    const map={apName:'name',apFacilityId:'facilityId',apYear:'year',apFacilityName:'facilityName',apAddress:'address',apManager:'manager',apInspectionDate:'inspectionDate',apNote:'note'}; const d={};
    Object.entries(map).forEach(([id,key])=>d[key]=$(id)?.value||''); localStorage.setItem(KEY_PROJECT,JSON.stringify(d)); toast('プロジェクト情報を保存しました');
  }
  function renderMasters() {
    const data=getJson(KEY_MASTER,defaults); const defs=[['categories','対象区分'],['damages','損傷種別'],['judgements','判定'],['actions','対応状況']];
    $('adminMasterCards').innerHTML=defs.map(([key,label])=>`<article class="master-card"><div class="master-card-head"><div><small>MASTER</small><h4>${label}</h4></div><span>${data[key].length}項目</span></div><div class="master-tags">${data[key].map((v,i)=>`<button type="button" data-remove="${key}:${i}" title="クリックで削除">${esc(v)} <b>×</b></button>`).join('')}</div><div class="master-add"><input data-master-input="${key}" placeholder="項目を追加"><button type="button" data-master-add="${key}">追加</button></div></article>`).join('');
    $('adminMasterCards').querySelectorAll('[data-master-add]').forEach(b=>b.onclick=()=>{const key=b.dataset.masterAdd,input=document.querySelector(`[data-master-input="${key}"]`),v=input.value.trim();if(!v)return;const d=getJson(KEY_MASTER,structuredClone(defaults));if(!d[key].includes(v))d[key].push(v);localStorage.setItem(KEY_MASTER,JSON.stringify(d));renderMasters();toast(`${v} を追加しました`);});
    $('adminMasterCards').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const [key,index]=b.dataset.remove.split(':');const d=getJson(KEY_MASTER,structuredClone(defaults));d[key].splice(Number(index),1);localStorage.setItem(KEY_MASTER,JSON.stringify(d));renderMasters();});
  }
  function show(view) { document.querySelectorAll('.admin-view').forEach(n=>n.classList.toggle('active',n.id===view)); }
  function toast(text){let n=$('adminToast');if(!n){n=document.createElement('div');n.id='adminToast';n.className='admin-toast';document.body.appendChild(n);}n.textContent=text;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),2200);}
  function exportAll(){const data={exportedAt:new Date().toISOString(),origin:location.origin,localStorage:{}};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('infra-'))data.localStorage[k]=localStorage.getItem(k);}const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='infra_viewer_backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);$('adminBackupStatus').textContent='書き出し完了';toast('バックアップを作成しました');}
  async function importAll(file){const data=JSON.parse(await file.text());if(!data.localStorage)throw new Error('対応するバックアップ形式ではありません');Object.entries(data.localStorage).forEach(([k,v])=>localStorage.setItem(k,v));$('adminBackupStatus').textContent='復元完了';toast('バックアップを復元しました');loadProject();renderMasters();}
  function bind(){window.addEventListener('admin-view-change',e=>{if(!e.detail?.view)return;show(e.detail.view);});$('adminSaveProject').onclick=saveProject;$('adminResetMaster').onclick=()=>{localStorage.setItem(KEY_MASTER,JSON.stringify(defaults));renderMasters();toast('標準値へ戻しました');};$('adminExport').onclick=exportAll;$('adminImport').onclick=()=>$('adminImportFile').click();$('adminImportFile').onchange=async e=>{try{if(e.target.files[0])await importAll(e.target.files[0]);}catch(err){alert('読込に失敗しました。\n'+err.message);}e.target.value='';};$('adminClear').onclick=()=>{if(!confirm('ブラウザーに保存された infra- データを削除しますか？'))return;const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('infra-'))keys.push(k);}keys.forEach(k=>localStorage.removeItem(k));loadProject();renderMasters();toast('保存データを初期化しました');};}
  create();loadProject();renderMasters();bind();show('admin-project');
})();
