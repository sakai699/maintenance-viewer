(() => {
'use strict';
const cfg=window.APP_CONFIG||{}, $=id=>document.getElementById(id);
const COLORS={"緊急確認":"#dc2626","早期対応":"#f97316","経過観察":"#eab308","BPO処理中":"#2563eb","対応完了":"#16a34a"};
let ionSourceMatrix=null;
let additionalTilesets=new Map();
let viewer,mainTileset=null,selectedId=null,addingPin=false,records=loadRecords();
let axisBaseMatrix=null,axisPivot=null;
let originalModelMatrix=null;
let clip={baseWorldMatrix:null,rotHeading:0,rotPitch:0,rotRoll:0,enabled:false,visible:true,labelsVisible:true,hidePins:true,center:null,half:null,modelMatrix:null,worldMatrix:null,inverse:null,collection:null,entities:[],drag:null};
let pdfPreviewObjectUrl=null;
function pdfDbOpen(){
  return new Promise((resolve,reject)=>{const req=indexedDB.open('infra-bpo-pdf-db',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('pdfs'))db.createObjectStore('pdfs',{keyPath:'damageId'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
async function pdfDbPut(damageId,file){const db=await pdfDbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('pdfs','readwrite');tx.objectStore('pdfs').put({damageId,name:file.name,type:'application/pdf',size:file.size,updatedAt:new Date().toISOString(),blob:file});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function pdfDbGet(damageId){const db=await pdfDbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('pdfs','readonly'),req=tx.objectStore('pdfs').get(damageId);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});}
async function pdfDbDelete(damageId){const db=await pdfDbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('pdfs','readwrite');tx.objectStore('pdfs').delete(damageId);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
function formatPdfSize(bytes){if(!Number.isFinite(bytes))return '';if(bytes<1024)return bytes+' B';if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';return (bytes/1048576).toFixed(1)+' MB';}
async function refreshPdfAttachmentUi(){
  const state=$('pdfAttachmentState'),preview=$('pdfPreviewBtn'),remove=$('pdfRemoveBtn');if(!state||!preview||!remove)return;
  if(!selectedId){state.textContent='先に点検情報を選択してください';state.classList.remove('has-pdf');preview.disabled=true;remove.disabled=true;return;}
  try{const item=await pdfDbGet(selectedId);if(item){state.textContent='PDF登録済み：'+item.name+'（'+formatPdfSize(item.size)+'）';state.title=item.name;state.classList.add('has-pdf');preview.disabled=false;remove.disabled=false;}else{state.textContent='PDF未登録';state.title='';state.classList.remove('has-pdf');preview.disabled=true;remove.disabled=true;}}catch(e){console.error(e);state.textContent='PDF情報の取得に失敗しました';}
}
async function attachSelectedPdf(file){
  if(!selectedId){alert('先に点検情報を選択してください。');return;}
  if(!file||file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){alert('PDFファイルを選択してください。');return;}
  try{await pdfDbPut(selectedId,file);const r=records.find(x=>x.id===selectedId);if(r){r.pdfName=file.name;r.pdfSize=file.size;saveRecords();renderList();}await refreshPdfAttachmentUi();status('PDFを損傷ID '+selectedId+' に登録しました。');}catch(e){console.error(e);alert('PDFの保存に失敗しました。');}
}
async function previewSelectedPdf(){
  if(!selectedId)return;try{const item=await pdfDbGet(selectedId);if(!item){alert('PDFが登録されていません。');return;}if(pdfPreviewObjectUrl)URL.revokeObjectURL(pdfPreviewObjectUrl);pdfPreviewObjectUrl=URL.createObjectURL(item.blob);$('pdfPreviewFrame').src=pdfPreviewObjectUrl+'#view=FitH';$('pdfPreviewTitle').textContent=selectedId+'｜'+item.name;$('pdfPreviewMeta').textContent=formatPdfSize(item.size)+' / '+(item.updatedAt?new Date(item.updatedAt).toLocaleString('ja-JP'):'');$('pdfPreviewDialog').showModal();}catch(e){console.error(e);alert('PDFプレビューを開けませんでした。');}
}
function closePdfPreview(){const d=$('pdfPreviewDialog');if(d?.open)d.close();$('pdfPreviewFrame').src='about:blank';if(pdfPreviewObjectUrl){URL.revokeObjectURL(pdfPreviewObjectUrl);pdfPreviewObjectUrl=null;}}
async function removeSelectedPdf(){if(!selectedId||!confirm('選択中の点検情報からPDFを解除しますか？'))return;await pdfDbDelete(selectedId);const r=records.find(x=>x.id===selectedId);if(r){delete r.pdfName;delete r.pdfSize;saveRecords();renderList();}await refreshPdfAttachmentUi();}
function enhancePdfListBadges(){document.querySelectorAll('#resultList .result-item').forEach(item=>{const id=(item.querySelector('b')?.textContent||'').split('｜')[0].split('|')[0].trim(),r=records.find(x=>String(x.id)===id);if(r?.pdfName&&!item.querySelector('.pdf-list-badge')){const badge=document.createElement('span');badge.className='pdf-list-badge';badge.textContent='PDF';item.querySelector('b')?.appendChild(badge);}});}
function loadRecords(){try{const x=JSON.parse(localStorage.getItem('infra-bpo-records')||'[]');if(x.length)return x}catch(e){}return [{id:'D-001',facilityId:'BRG-001',facilityName:'サンプル橋梁',memberName:'橋脚 P3',defectType:'ひび割れ',severity:'早期対応',inspectionDate:'2026-09-10',workStatus:'技術者確認待ち',note:'過年度写真との比較が必要です。',referenceUrl:'',lon:135.5,lat:34.69,height:20},{id:'D-002',facilityId:'BRG-001',facilityName:'サンプル橋梁',memberName:'主桁 G2',defectType:'腐食',severity:'BPO処理中',inspectionDate:'2026-09-11',workStatus:'BPO処理中',note:'写真番号と損傷図を照合中です。',referenceUrl:'',lon:135.5005,lat:34.6902,height:24}]}
function saveRecords(){localStorage.setItem('infra-bpo-records',JSON.stringify(records))}function ready(){return cfg.CESIUM_ACCESS_TOKEN&&!String(cfg.CESIUM_ACCESS_TOKEN).includes('YOUR_');/* bi-auto-refresh-after-save */if(typeof refreshBiDashboardAutomatically==='function')refreshBiDashboardAutomatically();}

/* TERRAIN_SWITCHER_BEGIN */
const TERRAIN_MODE_KEY='infra-terrain-mode-v1';
const TERRAIN_VISIBLE_KEY='infra-terrain-visible-v1';
let terrainProviderCache={
  plateau:typeof plateauTerrainProvider!=='undefined'?plateauTerrainProvider:null,
  ellipsoid:new Cesium.EllipsoidTerrainProvider(),
  world:null
};
async function getTerrainProviderByMode(mode){
  if(mode==='ellipsoid')return terrainProviderCache.ellipsoid;
  if(mode==='world'){
    if(!terrainProviderCache.world){
      terrainProviderCache.world=await Cesium.CesiumTerrainProvider.fromIonAssetId(1,{requestVertexNormals:true,requestWaterMask:true});
    }
    return terrainProviderCache.world;
  }
  if(!terrainProviderCache.plateau){
    terrainProviderCache.plateau=await Cesium.CesiumTerrainProvider.fromUrl(
      'https://tile.plateauview.mlit.go.jp/terrain/',
      {requestVertexNormals:true}
    );
  }
  return terrainProviderCache.plateau;
}
async function applyTerrainMode(showMessage=true){
  const select=$('terrainModeSelect');
  const toggle=$('terrainVisibleToggle');
  const mode=select?.value||localStorage.getItem(TERRAIN_MODE_KEY)||'plateau';
  const visible=toggle?toggle.checked:localStorage.getItem(TERRAIN_VISIBLE_KEY)!=='false';
  localStorage.setItem(TERRAIN_MODE_KEY,mode);
  localStorage.setItem(TERRAIN_VISIBLE_KEY,String(visible));
  viewer.scene.globe.show=visible;
  if(!visible){
    viewer.scene.requestRender();
    if(showMessage)status('地表を非表示にしました。');
    return;
  }
  try{
    const provider=await getTerrainProviderByMode(mode);
    viewer.terrainProvider=provider;
    viewer.scene.globe.depthTestAgainstTerrain=mode!=='ellipsoid';
    viewer.scene.requestRender();
    if(showMessage){
      const name=mode==='plateau'?'PLATEAU-Terrain':mode==='world'?'Cesium World Terrain':'地形なし（WGS84平坦面）';
      status(name+'へ切り替えました。');
    }
  }catch(error){
    console.error('Terrain switch failed',error);
    if(select)select.value='ellipsoid';
    viewer.terrainProvider=terrainProviderCache.ellipsoid;
    viewer.scene.globe.depthTestAgainstTerrain=false;
    viewer.scene.requestRender();
    if(showMessage)status('地形の読込に失敗したため、平坦面へ切り替えました。');
  }
}
function setupTerrainSwitcher(){
  const panel=document.querySelector('.left-panel');
  if(!panel||$('terrainSwitcherPanel'))return;
  const section=document.createElement('section');
  section.id='terrainSwitcherPanel';
  section.dataset.featureTab='model';
  section.innerHTML=`<h2>地形表示設定</h2>
    <div class="terrain-switcher-card">
      <label for="terrainModeSelect">使用する地形</label>
      <select id="terrainModeSelect">
        <option value="plateau">PLATEAU-Terrain（既定）</option>
        <option value="world">Cesium World Terrain</option>
        <option value="ellipsoid">地形なし（WGS84平坦面）</option>
      </select>
      <label class="terrain-visible-row"><input id="terrainVisibleToggle" type="checkbox" checked><span>地表・航空写真を表示</span></label>
      <button id="terrainApplyButton" type="button" class="full">地形設定を反映</button>
      <p class="terrain-switcher-note">点群が地形に埋まる場合は「地形なし（WGS84平坦面）」で確認できます。</p>
    </div>`;
  panel.appendChild(section);
  $('terrainModeSelect').value=localStorage.getItem(TERRAIN_MODE_KEY)||'plateau';
  $('terrainVisibleToggle').checked=localStorage.getItem(TERRAIN_VISIBLE_KEY)!=='false';
  $('terrainApplyButton').onclick=()=>applyTerrainMode(true);
  $('terrainVisibleToggle').onchange=()=>applyTerrainMode(true);
  applyTerrainMode(false);
}
/* TERRAIN_SWITCHER_END */

/* POINTCLOUD_INTEGRATED_BEGIN */
const POINT_CLOUD_PERF_KEY='infra-point-cloud-performance-v3';
const detectedPointCloudTilesets=new Set();
const watchedPointCloudTilesets=new WeakSet();
let pointCloudAutoTimer=0;
function loadPointCloudPerformance(){
  const defaults={quality:'light',attenuation:false,dynamicSSE:true,edl:false};
  try{return {...defaults,...JSON.parse(localStorage.getItem(POINT_CLOUD_PERF_KEY)||'{}')}}catch(_){return defaults}
}
function pointCloudPerformanceFromUi(){
  const saved=loadPointCloudPerformance();
  return {quality:$('pointCloudQuality')?.value||saved.quality,attenuation:$('pointCloudAttenuation')?.checked??saved.attenuation,dynamicSSE:$('pointCloudDynamicSse')?.checked??saved.dynamicSSE,edl:$('pointCloudEdl')?.checked??saved.edl};
}
function pointCloudQualityValues(mode){
  if(mode==='light')return {sse:48,cache:128,maxAttenuation:3};
  if(mode==='quality')return {sse:8,cache:512,maxAttenuation:8};
  return {sse:24,cache:256,maxAttenuation:5};
}
function allLoadedTilesetCandidates(){
  const result=[];const add=t=>{if(t&&!result.includes(t))result.push(t)};
  add(mainTileset);
  if(additionalTilesets?.forEach)additionalTilesets.forEach(add);
  return result;
}
function isPointCloudTileContent(content,depth=0){
  if(!content||depth>4)return false;
  const name=String(content.constructor?.name||'').toLowerCase();
  if(name.includes('pointcloud')||name.includes('pnts')||Number.isFinite(content.pointsLength)||Number.isFinite(content._pointsLength)||content._pointCloud!==undefined)return true;
  const nested=[content.innerContents,content._innerContents,content.contents,content._contents,content._content];
  return nested.some(value=>Array.isArray(value)?value.some(item=>isPointCloudTileContent(item,depth+1)):isPointCloudTileContent(value,depth+1));
}
function registerPointCloudTileset(tileset){
  if(!tileset||watchedPointCloudTilesets.has(tileset))return;
  watchedPointCloudTilesets.add(tileset);
  const inspect=tile=>{
    if(!isPointCloudTileContent(tile?.content))return;
    detectedPointCloudTilesets.add(tileset);
    schedulePointCloudAutoApply();
  };
  tileset.tileLoad?.addEventListener(inspect);
  tileset.tileVisible?.addEventListener(inspect);
  try{(tileset._selectedTiles||[]).forEach(inspect)}catch(_){ }
}
function pointCloudOnlyTilesetsAuto(){
  allLoadedTilesetCandidates().forEach(registerPointCloudTileset);
  return [...detectedPointCloudTilesets].filter(t=>{try{return !t.isDestroyed()}catch(_){return true}});
}
function applyPointCloudPerformance(showMessage=false){
  const settings=pointCloudPerformanceFromUi();localStorage.setItem(POINT_CLOUD_PERF_KEY,JSON.stringify(settings));
  const values=pointCloudQualityValues(settings.quality),targets=pointCloudOnlyTilesetsAuto();
  targets.forEach(ts=>{ts.maximumScreenSpaceError=values.sse;ts.cacheBytes=values.cache*1024*1024;ts.maximumCacheOverflowBytes=64*1024*1024;ts.dynamicScreenSpaceError=settings.dynamicSSE;ts.cullRequestsWhileMoving=true;ts.foveatedScreenSpaceError=true;ts.foveatedTimeDelay=.2;ts.preloadWhenHidden=false;ts.preloadFlightDestinations=false;ts.pointCloudShading=new Cesium.PointCloudShading({attenuation:settings.attenuation,maximumAttenuation:values.maxAttenuation,eyeDomeLighting:settings.edl,eyeDomeLightingStrength:1,eyeDomeLightingRadius:1});});
  viewer?.scene?.requestRender();
  if(showMessage)status(targets.length?'点群軽量化設定を自動反映しました。':'点群の読込完了後に自動反映します。');
  return targets.length;
}
function scanLoadedPointCloudTilesets(){
  allLoadedTilesetCandidates().forEach(ts=>{
    registerPointCloudTileset(ts);
    const tiles=[];
    try{tiles.push(...(ts._selectedTiles||[]))}catch(_){ }
    try{tiles.push(...(ts._requestedTiles||[]))}catch(_){ }
    try{tiles.push(...(ts._processingQueue||[]))}catch(_){ }
    if(tiles.some(tile=>isPointCloudTileContent(tile?.content)))detectedPointCloudTilesets.add(ts);
  });
}
function applyAllPointCloudSettings(){
  scanLoadedPointCloudTilesets();
  // Main Asset is the normal point-cloud display target in this viewer. Use it as a manual fallback
  // only when Cesium has not exposed tile-content type information yet.
  if(detectedPointCloudTilesets.size===0&&mainTileset)detectedPointCloudTilesets.add(mainTileset);
  const targets=pointCloudOnlyTilesetsAuto();
  if(!targets.length){status('反映対象の点群が読み込まれていません。');return;}
  applyPointCloudVisualStyle();
  applyPointCloudPerformance(false);
  viewer?.scene?.requestRender();
  status('点サイズ・カラー・軽量化設定を '+targets.length+' 件の点群へ反映しました。');
}
function schedulePointCloudAutoApply(){
  clearTimeout(pointCloudAutoTimer);pointCloudAutoTimer=setTimeout(()=>{applyPointCloudVisualStyle();applyPointCloudPerformance(false);},80);
}
function setupPointCloudPerformance(){
  const colorPanel=$('pointCloudColorPanel');if(!colorPanel||$('pointCloudPerformanceCard'))return;
  const settings=loadPointCloudPerformance(),card=document.createElement('div');card.id='pointCloudPerformanceCard';card.className='point-cloud-performance-card';
  card.innerHTML='<h3>点群軽量化</h3><label for="pointCloudQuality">表示品質・間引きレベル</label><select id="pointCloudQuality"><option value="light">軽量（遠景を大きく間引く）</option><option value="balanced">標準</option><option value="quality">高品質</option></select><label class="point-cloud-perf-check"><input id="pointCloudAttenuation" type="checkbox"><span>距離に応じて点サイズを自動調整</span></label><label class="point-cloud-perf-check"><input id="pointCloudDynamicSse" type="checkbox"><span>遠方タイルを粗く表示</span></label><label class="point-cloud-perf-check"><input id="pointCloudEdl" type="checkbox"><span>輪郭強調 EDL（重い場合はオフ）</span></label><button id="pointCloudApplyAll" type="button" class="full point-cloud-apply-all">点群設定をすべて反映</button><p class="point-cloud-perf-note">点サイズ・カラー・高さ範囲・軽量化を一括反映します。</p>';
  colorPanel.appendChild(card);$('pointCloudQuality').value=settings.quality;$('pointCloudAttenuation').checked=settings.attenuation;$('pointCloudDynamicSse').checked=settings.dynamicSSE;$('pointCloudEdl').checked=settings.edl;
  ['pointCloudQuality','pointCloudAttenuation','pointCloudDynamicSse','pointCloudEdl'].forEach(id=>$(id).addEventListener('change',schedulePointCloudAutoApply));
  $('pointCloudApplyAll').addEventListener('click',applyAllPointCloudSettings);
}
function setupPointCloudAutoAll(){allLoadedTilesetCandidates().forEach(registerPointCloudTileset);schedulePointCloudAutoApply();}
/* POINTCLOUD_INTEGRATED_END */

function setupFeatureTabs(){
  const panel=document.querySelector('.left-panel');const tabs=document.querySelectorAll('#featureTabs .feature-tab');if(!panel||!tabs.length)return;
  const sections=[...panel.querySelectorAll(':scope > section')];
  sections.forEach(section=>{
    const text=(section.textContent||'').replace(/\s+/g,' ');
    let group=section.dataset.featureTab||'model';if(section.id==='drawingFeaturePanel')group='drawing';if(section.id==='imageFeaturePanel')group='image';if(section.id==='timelineCalendarPanel')group='timeline';if(group!=='image'&&group!=='timeline'&&section.id==='biTabPanel')group='bi';if(group!=='bi'&&section.id==='measurementToolsPanel')group='measurement';if(group!=='measurement'&&(section.id==='pointSizeOnlyPanel'||section.id==='pointCloudColorPanel'))group='pointcloud';
    if(group!=='pointcloud'&&section.id==='viewpointManager'||section.querySelector('#viewpointList,#saveViewpointBtn'))group='display';
    else if(group!=='pointcloud'&&/検索|損傷ピンを追加/.test(text)||section.querySelector('#searchBox,#addPinBtn'))group='inspection';
    else if(group!=='pointcloud'&&/切断ボックス|切断を/.test(text)||section.querySelector('#clipEnabled,#fitClipBtn'))group='clip';
    else if(group!=='pointcloud'&&/レイヤー|ビューポイント/.test(text)||section.querySelector('#assetVisible,#pinsVisible'))group='display';
    section.dataset.featureTab=group;
  });
  const meta={model:['モデル','データ読込・座標設定'],inspection:['点検','検索・損傷情報登録'],clip:['切断','切断ボックス操作'],display:['表示','レイヤー表示設定'],pointcloud:['点群','点群機能'],measurement:['測定','測定機能'],image:['画像','通常画像・全天球画像'],drawing:['図面','PDF図面台帳・マーカー管理'],bi:['BI','点検・損傷ダッシュボード'],timeline:['時系列','モデル日時・カレンダー']};
  function activate(name){
    tabs.forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
    sections.forEach(s=>s.classList.toggle('tab-visible',s.dataset.featureTab===name));
    const title=$('tabTitle');if(title){title.innerHTML='<b>'+meta[name][0]+'</b><small>'+meta[name][1]+'</small>';}
    localStorage.setItem('infra-active-tab',name);
  }
  tabs.forEach(b=>b.addEventListener('click',()=>activate(b.dataset.tab)));
  activate(localStorage.getItem('infra-active-tab')||'model');
}
function viewpointStorageKey(){return 'infra-viewpoints-'+(String($('assetId')?.value||'default').trim()||'default');}
function loadViewpoints(){try{return JSON.parse(localStorage.getItem(viewpointStorageKey())||'[]');}catch(_){return [];}}
function saveViewpoints(items){localStorage.setItem(viewpointStorageKey(),JSON.stringify(items));}
function captureCameraView(name){
  const c=viewer.camera;
  return {id:'VP-'+Date.now(),name,createdAt:new Date().toISOString(),position:[c.positionWC.x,c.positionWC.y,c.positionWC.z],direction:[c.directionWC.x,c.directionWC.y,c.directionWC.z],up:[c.upWC.x,c.upWC.y,c.upWC.z]};
}
function restoreCameraView(view){
  if(!view||!Array.isArray(view.position)||!Array.isArray(view.direction)||!Array.isArray(view.up))return;
  viewer.camera.cancelFlight();
  viewer.camera.setView({destination:new Cesium.Cartesian3(...view.position),orientation:{direction:new Cesium.Cartesian3(...view.direction),up:new Cesium.Cartesian3(...view.up)},endTransform:Cesium.Matrix4.IDENTITY});
  viewer.scene.requestRender();
}
let viewpointRenameIndex=-1;
function openViewpointRenameDialog(index){
  const items=loadViewpoints();
  if(!items[index])return;
  viewpointRenameIndex=index;
  const input=$('viewpointRenameInput');
  input.value=items[index].name||'';
  const dialog=$('viewpointRenameDialog');
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  setTimeout(()=>{input.focus();input.select();},0);
}
function closeViewpointRenameDialog(){
  viewpointRenameIndex=-1;
  const dialog=$('viewpointRenameDialog');
  if(dialog?.open)dialog.close();else dialog?.removeAttribute('open');
}
function applyViewpointRename(){
  const name=$('viewpointRenameInput').value.trim();
  if(!name){alert('名称を入力してください。');return false;}
  const items=loadViewpoints();
  if(viewpointRenameIndex<0||!items[viewpointRenameIndex])return false;
  items[viewpointRenameIndex].name=name;
  saveViewpoints(items);
  renderViewpointList();
  closeViewpointRenameDialog();
  return true;
}
function renderViewpointList(){
  const list=$('viewpointList');if(!list)return;const items=loadViewpoints();list.innerHTML='';
  if(!items.length){list.innerHTML='<div class="viewpoint-empty">保存済みの視点はありません</div>';return;}
  items.forEach((view,index)=>{
    const row=document.createElement('div');row.className='viewpoint-item';
    const main=document.createElement('button');main.type='button';main.className='viewpoint-open';main.innerHTML='<span class="viewpoint-icon">◈</span><span><b></b><small></small></span>';main.querySelector('b').textContent=view.name;main.querySelector('small').textContent=new Date(view.createdAt).toLocaleString('ja-JP');main.onclick=()=>restoreCameraView(view);
    const actions=document.createElement('div');actions.className='viewpoint-actions';
    const update=document.createElement('button');update.type='button';update.title='現在の視点で更新';update.textContent='更新';update.onclick=()=>{const items=loadViewpoints();items[index]={...captureCameraView(view.name),id:view.id,createdAt:new Date().toISOString()};saveViewpoints(items);renderViewpointList();status('ビューポイントを現在の視点で更新しました。');};
    const rename=document.createElement('button');rename.type='button';rename.title='名前変更';rename.textContent='名称';rename.onclick=()=>openViewpointRenameDialog(index);
    const del=document.createElement('button');del.type='button';del.className='viewpoint-delete';del.title='削除';del.textContent='削除';del.onclick=()=>{if(!confirm('ビューポイント「'+view.name+'」を削除しますか？'))return;const items=loadViewpoints();items.splice(index,1);saveViewpoints(items);renderViewpointList();};
    actions.append(update,rename,del);row.append(main,actions);list.appendChild(row);
  });
}
function setupViewpointManager(){
  const panel=document.querySelector('.left-panel');if(!panel||$('viewpointManager'))return;
  const section=document.createElement('section');section.id='viewpointManager';section.dataset.featureTab='display';section.setAttribute('data-feature-tab','display');section.innerHTML='<h2>ビューポイント</h2><p class="viewpoint-help">現在のカメラ位置と向きを保存します。</p><div class="viewpoint-create"><input id="viewpointName" placeholder="例：橋脚P3 正面" maxlength="40"><button id="saveViewpointBtn" type="button">現在視点を保存</button></div><div id="viewpointList" class="viewpoint-list"></div>';
  panel.appendChild(section);
  $('saveViewpointBtn').onclick=()=>{const input=$('viewpointName'),name=input.value.trim()||'視点 '+(loadViewpoints().length+1);const items=loadViewpoints();items.push(captureCameraView(name));saveViewpoints(items);input.value='';renderViewpointList();status('現在のカメラ視点を保存しました。');};
  renderViewpointList();
  $('assetId')?.addEventListener('change',renderViewpointList);
}
function moveStatusToViewer(){
  const statusEl=$('assetStatus');
  const viewerWrap=document.querySelector('.viewer-wrap');
  if(!statusEl||!viewerWrap)return;
  statusEl.classList.add('viewer-work-status');
  viewerWrap.appendChild(statusEl);
}
function pointSizeOnlyValue(){return Math.max(1,Math.min(10,Number($('pointSizeOnlyRange')?.value)||2));}
function allPointSizeTilesets(){
  const result=[];
  if(mainTileset)result.push(mainTileset);
  if(typeof additionalTilesets!=='undefined'&&additionalTilesets&&additionalTilesets.forEach){additionalTilesets.forEach(t=>{if(t)result.push(t);});}
  return result;
}
function applyPointSizeOnly(showMessage=true){
  const size=pointSizeOnlyValue();
  localStorage.setItem('infra-point-size-only',String(size));
  const count=applyPointCloudVisualStyle();
  if(showMessage)status(count?'点サイズ '+size+' を反映しました。':'Asset読込後に点サイズを反映します。');
}
function setupPointSizeOnly(){
  const panel=document.querySelector('.left-panel');if(!panel||$('pointSizeOnlyPanel'))return;
  const section=document.createElement('section');section.id='pointSizeOnlyPanel';section.dataset.featureTab='pointcloud';
  section.innerHTML='<h2>点群表示設定</h2><div class="point-size-only-card"><div class="point-size-only-row"><label for="pointSizeOnlyRange">点サイズ</label><input id="pointSizeOnlyRange" type="range" min="1" max="10" step="1"><output id="pointSizeOnlyValue"></output></div><p class="point-cloud-auto-note">設定後、下の「点群設定をすべて反映」を押してください。</p></div>';
  panel.appendChild(section);const saved=Math.max(1,Math.min(10,Number(localStorage.getItem('infra-point-size-only'))||2));$('pointSizeOnlyRange').value=saved;$('pointSizeOnlyValue').textContent=saved;
  $('pointSizeOnlyRange').addEventListener('input',e=>{$('pointSizeOnlyValue').textContent=e.target.value;schedulePointCloudAutoApply();});
}

const POINT_CLOUD_COLOR_KEY='infra-point-cloud-color';
function loadPointCloudColorSettings(){
  const defaults={mode:'original',singleColor:'#39c7b5',minHeight:0,maxHeight:50};
  try{return {...defaults,...JSON.parse(localStorage.getItem(POINT_CLOUD_COLOR_KEY)||'{}')}}catch(_){return defaults}
}
function pointCloudColorSettingsFromUi(){
  const saved=loadPointCloudColorSettings();
  const mode=$('pointCloudColorMode')?.value||saved.mode;
  const singleColor=$('pointCloudSingleColor')?.value||saved.singleColor;
  let minHeight=Number($('pointCloudMinHeight')?.value??saved.minHeight);
  let maxHeight=Number($('pointCloudMaxHeight')?.value??saved.maxHeight);
  if(!Number.isFinite(minHeight))minHeight=0;
  if(!Number.isFinite(maxHeight)||maxHeight<=minHeight)maxHeight=minHeight+1;
  return {mode,singleColor,minHeight,maxHeight};
}
function applyPointCloudVisualStyle(){
  const settings=pointCloudColorSettingsFromUi();
  const size=pointSizeOnlyValue();
  localStorage.setItem(POINT_CLOUD_COLOR_KEY,JSON.stringify(settings));
  const pointSize=String(size);
  const z='${POSITION}.z';
  const span=settings.maxHeight-settings.minHeight;
  const q1=settings.minHeight+span*.25;
  const q2=settings.minHeight+span*.50;
  const q3=settings.minHeight+span*.75;
  const styleOptions=settings.mode==='single'
    ? {pointSize,color:"color('"+settings.singleColor+"')"}
    : settings.mode==='height'
      ? {pointSize,color:{conditions:[
          [z+' <= '+q1,"color('#2457ff')"],
          [z+' <= '+q2,"color('#20c8ea')"],
          [z+' <= '+q3,"color('#42cf72')"],
          [z+' <= '+settings.maxHeight,"color('#ffd447')"],
          ['true',"color('#ed514c')"]
        ]}}
      : {pointSize};
  const tilesets=pointCloudOnlyTilesetsAuto();
  tilesets.forEach(tileset=>{
    try{tileset.style=new Cesium.Cesium3DTileStyle(styleOptions)}catch(e){console.warn('Point cloud style could not be applied',e)}
  });
  viewer?.scene.requestRender();
  return tilesets.length;
}
function updatePointCloudColorFields(){
  const mode=$('pointCloudColorMode')?.value||'original';
  if($('pointCloudSingleColorRow'))$('pointCloudSingleColorRow').hidden=mode!=='single';
  if($('pointCloudHeightRange'))$('pointCloudHeightRange').hidden=mode!=='height';
}
function setupPointCloudColor(){
  const panel=document.querySelector('.left-panel');if(!panel||$('pointCloudColorPanel'))return;
  const settings=loadPointCloudColorSettings(),section=document.createElement('section');section.id='pointCloudColorPanel';section.dataset.featureTab='pointcloud';
  section.innerHTML=`<h2>点群カラー表示</h2><div class="point-cloud-color-card"><label for="pointCloudColorMode">表示モード</label><select id="pointCloudColorMode"><option value="original">元の色</option><option value="height">高さ色</option><option value="single">単色</option></select><label id="pointCloudSingleColorRow" class="point-cloud-color-row"><span>単色カラー</span><input id="pointCloudSingleColor" type="color" value="#39c7b5"></label><div id="pointCloudHeightRange" class="point-cloud-height-grid"><label>最低高さ<input id="pointCloudMinHeight" type="number" step="0.1"></label><label>最高高さ<input id="pointCloudMaxHeight" type="number" step="0.1"></label></div><div class="point-cloud-height-legend" aria-hidden="true"><span></span><small>低</small><small>高</small></div><p id="pointCloudColorStatus" class="point-cloud-color-status">設定後、下の「点群設定をすべて反映」を押してください。</p></div>`;
  panel.appendChild(section);$('pointCloudColorMode').value=settings.mode;$('pointCloudSingleColor').value=settings.singleColor;$('pointCloudMinHeight').value=settings.minHeight;$('pointCloudMaxHeight').value=settings.maxHeight;
  $('pointCloudColorMode').addEventListener('change',()=>{updatePointCloudColorFields();schedulePointCloudAutoApply();});
  $('pointCloudSingleColor').addEventListener('input',schedulePointCloudAutoApply);
  ['pointCloudMinHeight','pointCloudMaxHeight'].forEach(id=>{$(id).addEventListener('input',schedulePointCloudAutoApply);$(id).addEventListener('change',schedulePointCloudAutoApply);});
  updatePointCloudColorFields();
}
let measurementHandler=null,measurementMode=null,measurementPoints=[],measurementEntities=[];
async function measurementPick(screenPosition){
  const scene=viewer.scene;
  const ray=viewer.camera.getPickRay(screenPosition);

  // Prefer ray intersection with rendered 3D Tiles/model content.
  // This prevents a fallback globe position from being plotted away from the model.
  if(ray&&typeof scene.pickFromRayMostDetailed==='function'){
    try{
      const hit=await scene.pickFromRayMostDetailed(ray);
      if(hit&&Cesium.defined(hit.position))return hit.position;
    }catch(e){console.warn('pickFromRayMostDetailed fallback',e);}
  }

  // Fallback to the depth buffer only when an object is actually under the cursor.
  const picked=scene.pick(screenPosition);
  if(!Cesium.defined(picked))return undefined;
  const pickedId=picked.id?.id;
  if(pickedId&&(String(pickedId).startsWith('clip-')||records.some(r=>String(r.id)===String(pickedId))))return undefined;
  if(scene.pickPositionSupported){
    const p=scene.pickPosition(screenPosition);
    if(Cesium.defined(p))return p;
  }
  return undefined;
}
function measurementLocalPoint(world){
  if(mainTileset&&mainTileset.modelMatrix){try{const inverse=Cesium.Matrix4.inverse(mainTileset.modelMatrix,new Cesium.Matrix4());return Cesium.Matrix4.multiplyByPoint(inverse,world,new Cesium.Cartesian3());}catch(e){console.warn(e)}}
  return Cesium.Cartesian3.clone(world);
}
function measurementAddPoint(world,color){
  const cameraDirection=Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(viewer.camera.positionWC,world,new Cesium.Cartesian3()),new Cesium.Cartesian3());
  const markerPosition=Cesium.Cartesian3.add(world,Cesium.Cartesian3.multiplyByScalar(cameraDirection,0.01,new Cesium.Cartesian3()),new Cesium.Cartesian3());
  const e=viewer.entities.add({position:markerPosition,point:{pixelSize:9,color:color||Cesium.Color.YELLOW,outlineColor:Cesium.Color.WHITE,outlineWidth:2,disableDepthTestDistance:0}});
  measurementEntities.push(e);return e;
}
function measurementAddLabel(world,text){const e=viewer.entities.add({position:world,label:{text,font:'12px sans-serif',fillColor:Cesium.Color.WHITE,showBackground:true,backgroundColor:Cesium.Color.BLACK.withAlpha(.78),pixelOffset:new Cesium.Cartesian2(0,-17),disableDepthTestDistance:Number.POSITIVE_INFINITY}});measurementEntities.push(e);return e;}
function measurementResult(text){const el=$('measurementResult');if(el)el.textContent=text;}
function measurementStart(mode){
  measurementClear(false);measurementMode=mode;viewer.scene.canvas.style.cursor='crosshair';
  measurementResult(mode==='coordinate'?'モデル面または点群上の位置を1点クリックしてください。':mode==='distance'?'モデル面または点群上で始点と終点を順にクリックしてください。':'モデル面または点群上で頂点を3点以上クリックし、「面積確定」を押してください。');
  $('measurementFinishArea').disabled=mode!=='area';
}
function measurementRefreshAreaLine(){
  const old=measurementEntities.filter(e=>e._measurementAreaLine);old.forEach(e=>viewer.entities.remove(e));measurementEntities=measurementEntities.filter(e=>!e._measurementAreaLine);
  if(measurementPoints.length<2)return;const positions=measurementPoints.length>=3?[...measurementPoints,measurementPoints[0]]:[...measurementPoints];const e=viewer.entities.add({polyline:{positions,width:2,material:Cesium.Color.CYAN,depthFailMaterial:Cesium.Color.CYAN}});e._measurementAreaLine=true;measurementEntities.push(e);
}
function measurementPolygonArea(points){
  if(points.length<3)return 0;const origin=points[0],normal=new Cesium.Cartesian3(0,0,0);
  for(let i=0;i<points.length;i++){const a=Cesium.Cartesian3.subtract(points[i],origin,new Cesium.Cartesian3()),b=Cesium.Cartesian3.subtract(points[(i+1)%points.length],origin,new Cesium.Cartesian3());Cesium.Cartesian3.add(normal,Cesium.Cartesian3.cross(a,b,new Cesium.Cartesian3()),normal)}
  return Cesium.Cartesian3.magnitude(normal)*0.5;
}
async function measurementHandleClick(movement){
  if(!measurementMode)return;const world=await measurementPick(movement.position);if(!Cesium.defined(world)){measurementResult('モデル面または点群上をクリックしてください。');return;}
  viewer.selectedEntity=undefined;measurementAddPoint(world,measurementMode==='coordinate'?Cesium.Color.CYAN:Cesium.Color.YELLOW);
  if(measurementMode==='coordinate'){
    const p=measurementLocalPoint(world),text='X: '+p.x.toFixed(3)+' m / Y: '+p.y.toFixed(3)+' m / Z: '+p.z.toFixed(3)+' m';measurementAddLabel(world,text);measurementResult(text);measurementMode=null;viewer.scene.canvas.style.cursor='default';return;
  }
  measurementPoints.push(world);
  if(measurementMode==='distance'&&measurementPoints.length===2){
    const a=measurementPoints[0],b=measurementPoints[1],d=Cesium.Cartesian3.distance(a,b),mid=Cesium.Cartesian3.midpoint(a,b,new Cesium.Cartesian3());measurementEntities.push(viewer.entities.add({polyline:{positions:[a,b],width:3,material:Cesium.Color.YELLOW,depthFailMaterial:Cesium.Color.ORANGE}}));measurementAddLabel(mid,d.toFixed(3)+' m');measurementResult('距離: '+d.toFixed(3)+' m');measurementMode=null;measurementPoints=[];viewer.scene.canvas.style.cursor='default';return;
  }
  if(measurementMode==='area'){measurementRefreshAreaLine();measurementResult('選択点: '+measurementPoints.length+'点');}
}
function measurementFinishArea(){
  if(measurementMode!=='area'||measurementPoints.length<3){measurementResult('面積測定には3点以上必要です。');return;}
  const area=measurementPolygonArea(measurementPoints),center=measurementPoints.reduce((s,p)=>Cesium.Cartesian3.add(s,p,s),new Cesium.Cartesian3());Cesium.Cartesian3.divideByScalar(center,measurementPoints.length,center);
  measurementEntities.push(viewer.entities.add({polygon:{hierarchy:new Cesium.PolygonHierarchy([...measurementPoints]),material:Cesium.Color.CYAN.withAlpha(.24),outline:true,outlineColor:Cesium.Color.CYAN,perPositionHeight:true}}));measurementAddLabel(center,area.toFixed(3)+' m²');measurementResult('面積: '+area.toFixed(3)+' m²');measurementMode=null;measurementPoints=[];viewer.scene.canvas.style.cursor='default';$('measurementFinishArea').disabled=true;
}
function measurementClear(update=true){measurementEntities.forEach(e=>viewer.entities.remove(e));measurementEntities=[];measurementPoints=[];measurementMode=null;if(viewer)viewer.scene.canvas.style.cursor='default';if(update)measurementResult('測定結果はありません。');const f=$('measurementFinishArea');if(f)f.disabled=true;}
function setupMeasurementTools(){
  const panel=document.querySelector('.left-panel');if(!panel||$('measurementToolsPanel'))return;
  const section=document.createElement('section');section.id='measurementToolsPanel';section.dataset.featureTab='measurement';section.innerHTML='<h2>測定</h2><div class="measurement-card"><button id="measurementCoordinate" type="button">座標取得</button><button id="measurementDistance" type="button">距離測定</button><button id="measurementArea" type="button">面積測定</button><button id="measurementFinishArea" type="button" class="secondary" disabled>面積確定</button><button id="measurementClear" type="button" class="danger measurement-clear">測定クリア</button><div id="measurementResult" class="measurement-result">測定結果はありません。</div><p class="measurement-note">座標値はメインAssetのモデル座標系を基準にX・Y・Zで表示します。</p></div>';
  panel.appendChild(section);$('measurementCoordinate').onclick=()=>measurementStart('coordinate');$('measurementDistance').onclick=()=>measurementStart('distance');$('measurementArea').onclick=()=>measurementStart('area');$('measurementFinishArea').onclick=measurementFinishArea;$('measurementClear').onclick=()=>measurementClear(true);
  measurementHandler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);measurementHandler.setInputAction(measurementHandleClick,Cesium.ScreenSpaceEventType.LEFT_CLICK);
  document.querySelectorAll('#featureTabs .feature-tab').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tab!=='measurement'&&measurementMode){measurementMode=null;measurementPoints=[];viewer.scene.canvas.style.cursor='default';}}));
}
function updateLocalAxisSettingsVisibility(){hideAxisSettingsForAllModes();}
function hideAxisSettingsForAllModes(){
  const ids=['axisPreset','rotX','rotY','rotZ','applyAxisBtn','japanDefaultBtn','levelPresetBtn'];
  const elements=ids.map(id=>$(id)).filter(Boolean);
  if(!elements.length)return;
  let container=elements[0];
  while(container&&container.parentElement&&!elements.every(el=>container.contains(el)))container=container.parentElement;
  if(container){container.classList.add('axis-settings-always-hidden');container.style.display='none';}
}
function biText(value){const v=String(value??'').trim();return v||'未設定';}
function biCounts(rows,key){const m=new Map();rows.forEach(r=>{const v=biText(r[key]);m.set(v,(m.get(v)||0)+1)});return [...m.entries()].sort((a,b)=>b[1]-a[1]);}
function biEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
let biActiveFilter=null;
function biRecordPosition(record){
  const entity=viewer.entities.getById(String(record.id));
  if(entity?.position){const p=entity.position.getValue(viewer.clock.currentTime);if(Cesium.defined(p))return p;}
  if(Number.isFinite(Number(record.lon))&&Number.isFinite(Number(record.lat)))return Cesium.Cartesian3.fromDegrees(Number(record.lon),Number(record.lat),Number(record.height)||0);
  return undefined;
}
function biRestoreAllPins(){
  records.forEach(r=>{const e=viewer.entities.getById(String(r.id));if(e)e.show=true;});
  biActiveFilter=null;
  const label=$('biModelFilterLabel');if(label)label.textContent='全ての損傷ピンを表示中';
  document.querySelectorAll('.bi-bar-row.active').forEach(el=>el.classList.remove('active'));
  viewer.scene.requestRender();
}
function biApplyModelFilter(key,value,sourceElement){
  const matched=records.filter(r=>biText(r[key])===value);
  records.forEach(r=>{const e=viewer.entities.getById(String(r.id));if(e)e.show=matched.some(m=>String(m.id)===String(r.id));});
  document.querySelectorAll('.bi-bar-row.active').forEach(el=>el.classList.remove('active'));sourceElement?.classList.add('active');
  biActiveFilter={key,value};
  const label=$('biModelFilterLabel');if(label)label.textContent=value+'：'+matched.length+'件のピンを表示';
  const positions=matched.map(biRecordPosition).filter(Cesium.defined);
  if(positions.length){
    const sphere=Cesium.BoundingSphere.fromPoints(positions);
    const radius=Math.max(sphere.radius*3.2,mainTileset?.boundingSphere?.radius*.45||20);
    viewer.camera.flyToBoundingSphere(sphere,{duration:.8,offset:new Cesium.HeadingPitchRange(Cesium.Math.toRadians(30),Cesium.Math.toRadians(-28),radius)});
  }
  viewer.scene.requestRender();
}
function biBars(title,data,total,key){
  if(!data.length)return '<section class="bi-panel"><h3>'+title+'</h3><div class="bi-empty">データなし</div></section>';
  return '<section class="bi-panel"><h3>'+title+'</h3><div class="bi-bars">'+data.slice(0,8).map(([label,count],i)=>{const pct=total?count/total*100:0;return '<button type="button" class="bi-bar-row" data-bi-key="'+biEscape(key)+'" data-bi-value="'+biEscape(label)+'"><div class="bi-bar-label" title="'+biEscape(label)+'">'+biEscape(label)+'</div><div class="bi-bar-track"><span style="width:'+pct.toFixed(1)+'%"></span></div><b>'+count+'</b></button>'}).join('')+'</div></section>';
}
function biDateValue(value){const t=Date.parse(value);return Number.isFinite(t)?t:0;}
function refreshBiDashboardAutomatically(){
  if(typeof renderBiDashboard!=='function')return;
  renderBiDashboard();
  if(typeof biActiveFilter!=='undefined'&&biActiveFilter){
    const rows=[...document.querySelectorAll('.bi-bar-row[data-bi-key]')];
    const active=rows.find(row=>row.dataset.biKey===biActiveFilter.key&&row.dataset.biValue===biActiveFilter.value);
    if(active&&typeof biApplyModelFilter==='function')biApplyModelFilter(biActiveFilter.key,biActiveFilter.value,active);
    else if(typeof biRestoreAllPins==='function')biRestoreAllPins();
  }
}
function renderBiDashboard(){
  const root=$('biDashboard');if(!root)return;const rows=biFacilityFilteredRecords(),total=rows.length;
  const withPdf=rows.filter(r=>r.pdfName).length,withUrl=rows.filter(r=>r.referenceUrl).length;
  const completed=rows.filter(r=>/完了|対応済|済/.test(String(r.workStatus||''))).length;
  if($('biSideTotal'))$('biSideTotal').textContent=total;
  if($('biSideCompleted'))$('biSideCompleted').textContent=completed;
  if($('biSidePdf'))$('biSidePdf').textContent=withPdf;
  if($('biSideUrl'))$('biSideUrl').textContent=withUrl;
  const latest=[...rows].sort((a,b)=>biDateValue(b.inspectionDate)-biDateValue(a.inspectionDate)).slice(0,7);
  root.innerHTML='<div class="bi-dashboard-head"><div><h2>点検・損傷ダッシュボード</h2><p>集計項目をクリックすると、右側の3Dモデルで該当ピンを表示します。</p></div></div><div class="bi-model-toolbar"><span id="biModelFilterLabel">全ての損傷ピンを表示中</span><button id="biClearFilter" type="button">絞り込み解除</button></div>'+
  '<div class="bi-kpis"><article><small>登録件数</small><strong>'+total+'</strong><span>件</span></article><article><small>対応済み</small><strong>'+completed+'</strong><span>件</span></article><article><small>PDF登録</small><strong>'+withPdf+'</strong><span>件</span></article><article><small>URL登録</small><strong>'+withUrl+'</strong><span>件</span></article></div>'+
  '<div class="bi-grid">'+biBars('損傷種別',biCounts(rows,'defectType'),total,'defectType')+biBars('重要度',biCounts(rows,'severity'),total,'severity')+biBars('作業ステータス',biCounts(rows,'workStatus'),total,'workStatus')+biBars('施設別',biCounts(rows,'facilityName'),total,'facilityName')+'</div>'+
  '<section class="bi-panel bi-recent"><h3>点検情報一覧</h3><div class="bi-table"><div class="bi-table-head"><span>損傷ID</span><span>施設・部材</span><span>損傷種別</span><span>重要度</span><span>点検日</span><span>ステータス</span></div>'+latest.map(r=>'<button type="button" class="bi-table-row" data-record-id="'+biEscape(r.id)+'"><span>'+biEscape(r.id)+'</span><span>'+biEscape(biText(r.facilityName))+' / '+biEscape(biText(r.memberName))+'</span><span>'+biEscape(biText(r.defectType))+'</span><span>'+biEscape(biText(r.severity))+'</span><span>'+biEscape(biText(r.inspectionDate))+'</span><span>'+biEscape(biText(r.workStatus))+'</span></button>').join('')+(latest.length?'':'<div class="bi-empty">点検情報がありません</div>')+'</div></section>';
  $('biClearFilter').onclick=biRestoreAllPins;
  root.querySelectorAll('.bi-bar-row[data-bi-key]').forEach(row=>row.onclick=()=>biApplyModelFilter(row.dataset.biKey,row.dataset.biValue,row));
  root.querySelectorAll('[data-record-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.recordId;if(typeof selectRecord==='function')selectRecord(id);document.querySelector('#featureTabs [data-tab="inspection"]')?.click();});
  renderBiFacilityControls();
  syncBiFacilityPins();
}
function showBiDashboard(active){
  const bi=$('biDashboard'),viewerWrap=document.querySelector('.viewer-wrap'),right=document.querySelector('.right-panel');if(!bi||!viewerWrap)return;
  bi.classList.toggle('active',active);viewerWrap.classList.toggle('bi-mode',active);right?.classList.toggle('bi-right-hidden',active);document.querySelector('main')?.classList.toggle('bi-layout-active',active);if(active){refreshBiDashboardAutomatically();if(mainTileset&&!biActiveFilter)focusAsset();}else{biRestoreAllPins();}
}
function setupBiDashboard(){
  const panel=document.querySelector('.left-panel'),viewerWrap=document.querySelector('.viewer-wrap');if(!panel||!viewerWrap||$('biDashboard'))return;
  const section=document.createElement('section');section.id='biTabPanel';section.dataset.featureTab='bi';section.innerHTML='<h2>点検BI</h2><div id="biSideSummary" class="bi-side-summary"><div><small>登録</small><b id="biSideTotal">0</b><span>件</span></div><div><small>対応済み</small><b id="biSideCompleted">0</b><span>件</span></div><div><small>PDF</small><b id="biSidePdf">0</b><span>件</span></div><div><small>URL</small><b id="biSideUrl">0</b><span>件</span></div></div><p class="bi-side-guide">中央の集計項目をクリックすると、右側の3Dモデルに該当する損傷ピンを表示します。</p>';panel.appendChild(section);
  const dashboard=document.createElement('div');dashboard.id='biDashboard';dashboard.className='bi-dashboard';viewerWrap.appendChild(dashboard);
  document.querySelectorAll('#featureTabs .feature-tab').forEach(btn=>btn.addEventListener('click',()=>showBiDashboard(btn.dataset.tab==='bi')));
  const originalSave=window.saveRecords;renderBiDashboard();
}
function moveFeatureTabsToHeader(){
  const header=document.querySelector('header');
  const tabs=$('featureTabs');
  const left=document.querySelector('.left-panel');
  if(!header||!tabs||!left)return;
  let slot=$('headerFeatureTabs');
  if(!slot){
    slot=document.createElement('div');
    slot.id='headerFeatureTabs';
    slot.className='header-feature-tabs';
    const actions=header.querySelector('.header-actions');
    if(actions)header.insertBefore(slot,actions);else header.appendChild(slot);
  }
  slot.appendChild(tabs);
  left.classList.add('tabs-moved-to-header');
}
let timelineCalendarDate=new Date();
function mainAssetTimelineStore(){try{return JSON.parse(localStorage.getItem('infra-main-asset-timeline')||'{}')}catch(_){return {}}}
function mainAssetTimelineInfo(){
  const assetId=String($('assetId')?.value||'').trim();
  const store=mainAssetTimelineStore();
  return {id:'__main__',assetId,name:'メインAsset',observedAt:store[assetId]||'',isMain:true};
}
function saveMainAssetObservedAt(value){
  const assetId=String($('assetId')?.value||'').trim();if(!assetId)return;
  const store=mainAssetTimelineStore();store[assetId]=value;localStorage.setItem('infra-main-asset-timeline',JSON.stringify(store));
  renderTimelineCalendar();if(typeof populateTimelineCompareSelects==='function')populateTimelineCompareSelects();
}
function enhanceMainAssetDateInput(){
  if($('mainAssetObservedAt'))return;
  const assetInput=$('assetId');if(!assetInput)return;
  let anchor=assetInput.parentElement;
  const focusBtn=$('focusAssetBtn');if(focusBtn)anchor=focusBtn;
  const wrap=document.createElement('label');wrap.className='main-asset-datetime';wrap.innerHTML='<span>取得日時</span><input id="mainAssetObservedAt" type="datetime-local">';
  const input=wrap.querySelector('input');input.value=mainAssetTimelineInfo().observedAt;input.onchange=()=>saveMainAssetObservedAt(input.value);
  anchor.insertAdjacentElement('afterend',wrap);
  assetInput.addEventListener('change',()=>{input.value=mainAssetTimelineInfo().observedAt;renderTimelineCalendar()});
}

function timelineDefs(){const defs=typeof loadAdditionalModelDefs==='function'?loadAdditionalModelDefs():[];const main=mainAssetTimelineInfo();return main.assetId?[main,...defs]:defs}
function timelineSaveDefs(items){const defs=items.filter(x=>!x.isMain&&x.id!=='__main__');if(typeof saveAdditionalModelDefs==='function')saveAdditionalModelDefs(defs);else localStorage.setItem('infra-additional-models',JSON.stringify(defs))}
function timelineDateText(value){if(!value)return '日時未設定';const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}
function timelineModelById(id){if(String(id)==='__main__')return mainTileset;return typeof additionalTilesets!=='undefined'?additionalTilesets.get(String(id)):null}
function timelineShowModel(id){
 const target=timelineModelById(id);if(!target){alert('対象モデルが未読込です。モデルタブで「読込」を押してください。');return}
 if(mainTileset)mainTileset.show=String(id)==='__main__';
 if(typeof additionalTilesets!=='undefined')additionalTilesets.forEach((t,key)=>{t.show=String(key)===String(id)});
 target.show=true;
 const s=target.boundingSphere;if(s){viewer.camera.flyToBoundingSphere(s,{duration:.7,offset:new Cesium.HeadingPitchRange(Cesium.Math.toRadians(32),Cesium.Math.toRadians(-27),Math.max(s.radius*3,10))})}
 const def=timelineDefs().find(d=>String(d.id)===String(id));$('timelineSelectedModel').textContent=(def?.name||('Asset '+id))+' / '+timelineDateText(def?.observedAt);
 viewer.scene.requestRender();
}
function timelineShowAllModels(){if(mainTileset)mainTileset.show=true;if(typeof additionalTilesets!=='undefined')additionalTilesets.forEach(t=>t.show=true);$('timelineSelectedModel').textContent='全モデル表示';viewer.scene.requestRender()}
function updateAdditionalModelDate(id,value){if(String(id)==='__main__'){saveMainAssetObservedAt(value);return}const defs=timelineDefs(),d=defs.find(x=>String(x.id)===String(id));if(!d)return;d.observedAt=value;timelineSaveDefs(defs);renderAdditionalModels();renderTimelineCalendar()}
function enhanceAdditionalModelDateInputs(){
 const list=$('additionalModelList');if(!list)return;const defs=timelineDefs();
 list.querySelectorAll('.additional-model-item').forEach(row=>{if(row.querySelector('.additional-model-datetime'))return;const id=row.dataset.assetId,def=defs.find(d=>String(d.id)===String(id));const wrap=document.createElement('label');wrap.className='additional-model-datetime';wrap.innerHTML='<span>取得日時</span><input type="datetime-local">';const input=wrap.querySelector('input');input.value=def?.observedAt||'';input.onchange=()=>updateAdditionalModelDate(id,input.value);const actions=row.querySelector('.additional-model-actions');row.insertBefore(wrap,actions)});
}
function timelineDayKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function renderTimelineCalendar(){
 const grid=$('timelineCalendarGrid'),title=$('timelineCalendarTitle'),list=$('timelineDateModels');if(!grid||!title||!list)return;
 const y=timelineCalendarDate.getFullYear(),m=timelineCalendarDate.getMonth();title.textContent=y+'年 '+(m+1)+'月';grid.innerHTML='';
 ['日','月','火','水','木','金','土'].forEach((w,i)=>{const e=document.createElement('div');e.className='timeline-week '+(i===0?'sun':i===6?'sat':'');e.textContent=w;grid.appendChild(e)});
 const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());const defs=timelineDefs();
 for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=timelineDayKey(d);const matches=defs.filter(x=>x.observedAt&&x.observedAt.slice(0,10)===key);const b=document.createElement('button');b.type='button';b.className='timeline-day';if(d.getMonth()!==m)b.classList.add('other');if(i%7===0)b.classList.add('sun');if(i%7===6)b.classList.add('sat');if(matches.length)b.classList.add('has-model');b.innerHTML='<span>'+d.getDate()+'</span>'+(matches.length?'<b>'+matches.length+'</b>':'');b.onclick=()=>renderTimelineDateModels(key);grid.appendChild(b)}
 renderTimelineDateModels(null);
}
function renderTimelineDateModels(dateKey){
 const list=$('timelineDateModels');if(!list)return;const defs=timelineDefs().filter(x=>x.observedAt&&(!dateKey||x.observedAt.slice(0,10)===dateKey)).sort((a,b)=>String(a.observedAt).localeCompare(String(b.observedAt)));list.innerHTML='';
 if(!defs.length){list.innerHTML='<div class="timeline-calendar-empty">'+(dateKey?'この日に登録されたモデルはありません':'カレンダーの日付を選択してください')+'</div>';return}
 defs.forEach(d=>{const b=document.createElement('button');b.type='button';b.className='timeline-model-card';b.innerHTML='<b>'+String(d.name||('Asset '+d.id)).replace(/[<>]/g,'')+'</b><small>'+timelineDateText(d.observedAt)+' / Asset '+d.id+'</small>';b.onclick=()=>timelineShowModel(d.id);list.appendChild(b)})
}
function setupTimelineCalendar(){
 enhanceMainAssetDateInput();
 const panel=document.querySelector('.left-panel');if(!panel||$('timelineCalendarPanel'))return;const sec=document.createElement('section');sec.id='timelineCalendarPanel';sec.dataset.featureTab='timeline';sec.innerHTML='<h2>モデル時系列</h2><p class="timeline-calendar-help">モデルタブで追加モデルに取得日時を設定し、下のカレンダーから閲覧します。</p><div class="timeline-selected"><small>表示中</small><b id="timelineSelectedModel">全モデル表示</b></div><button id="timelineShowAll" type="button" class="secondary full">全モデルを表示</button><div class="timeline-calendar"><div class="timeline-calendar-head"><button id="timelinePrevMonth" type="button">‹</button><b id="timelineCalendarTitle"></b><button id="timelineNextMonth" type="button">›</button></div><div id="timelineCalendarGrid" class="timeline-calendar-grid"></div><div id="timelineDateModels" class="timeline-date-models"></div></div>';panel.appendChild(sec);
 $('timelinePrevMonth').onclick=()=>{timelineCalendarDate=new Date(timelineCalendarDate.getFullYear(),timelineCalendarDate.getMonth()-1,1);renderTimelineCalendar()};$('timelineNextMonth').onclick=()=>{timelineCalendarDate=new Date(timelineCalendarDate.getFullYear(),timelineCalendarDate.getMonth()+1,1);renderTimelineCalendar()};$('timelineShowAll').onclick=timelineShowAllModels;renderTimelineCalendar();if(typeof populateTimelineCompareSelects==='function')populateTimelineCompareSelects();
 document.querySelectorAll('#featureTabs .feature-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='timeline'){enhanceAdditionalModelDateInputs();renderTimelineCalendar()}}));
}
let timelineSecondViewer=null,timelineSecondTileset=null,timelineCameraGuard=false,timelineRemoveLeftSync=null,timelineRemoveRightSync=null;
function timelineResolvedAssetId(item){const raw=item?.assetId??item?.id;const n=Number(raw);return Number.isInteger(n)&&n>0?n:null}
function timelineDatedModels(){return timelineDefs().filter(x=>x.observedAt).sort((a,b)=>String(a.observedAt).localeCompare(String(b.observedAt)))}
function populateTimelineCompareSelects(){
  const a=$('timelineCompareDateA'),b=$('timelineCompareDateB');if(!a||!b)return;const oldA=a.value,oldB=b.value,items=timelineDatedModels();
  a.innerHTML='<option value="">比較元の日付・モデル</option>';b.innerHTML='<option value="">比較先の日付・モデル</option>';
  items.forEach(x=>{for(const s of [a,b]){const o=document.createElement('option');o.value=String(x.id);{const aid=timelineResolvedAssetId(x);o.textContent=timelineDateText(x.observedAt)+' / '+(x.name||('Asset '+aid));}s.appendChild(o)}});
  if([...a.options].some(o=>o.value===oldA))a.value=oldA;if([...b.options].some(o=>o.value===oldB))b.value=oldB;
}
function timelineCopyCamera(from,to){
  if(!from||!to||timelineCameraGuard||!$('timelineSyncCamera')?.checked)return;timelineCameraGuard=true;
  try{to.setView({destination:Cesium.Cartesian3.clone(from.positionWC),orientation:{direction:Cesium.Cartesian3.clone(from.directionWC),up:Cesium.Cartesian3.clone(from.upWC)}})}finally{timelineCameraGuard=false}
}
function timelineInstallCameraSync(){
  timelineRemoveLeftSync?.();timelineRemoveRightSync?.();
  viewer.camera.percentageChanged=.01;timelineSecondViewer.camera.percentageChanged=.01;
  timelineRemoveLeftSync=viewer.camera.changed.addEventListener(()=>timelineCopyCamera(viewer.camera,timelineSecondViewer.camera));
  timelineRemoveRightSync=timelineSecondViewer.camera.changed.addEventListener(()=>timelineCopyCamera(timelineSecondViewer.camera,viewer.camera));
}
function timelineOnlyShow(id){
  if(mainTileset)mainTileset.show=String(id)==='__main__';
  if(typeof additionalTilesets!=='undefined')additionalTilesets.forEach((t,key)=>{t.show=String(key)===String(id)});
}
function timelineSourceTileset(id){return String(id)==='__main__'?mainTileset:timelineModelById(id)}
async function timelineStartDualView(){
  const idA=$('timelineCompareDateA').value,idB=$('timelineCompareDateB').value;if(!idA||!idB){alert('比較元と比較先の2つを選択してください。');return}if(idA===idB){alert('異なる日時・モデルを選択してください。');return}
  const items=timelineDefs(),a=items.find(x=>String(x.id)===idA),b=items.find(x=>String(x.id)===idB),sourceA=timelineSourceTileset(idA),sourceB=timelineSourceTileset(idB);
  if(!a||!b){alert('時系列モデル情報を取得できません。');return}if(!sourceA||!sourceB){alert('比較する2モデルをモデルタブで読み込んでください。');return}
  timelineCloseDualView(false);timelineOnlyShow(idA);
  const wrap=document.querySelector('.viewer-wrap'),main=document.querySelector('main'),right=document.querySelector('.right-panel');if(!wrap)return;
  main?.classList.add('timeline-split-active');wrap.classList.add('timeline-dual-mode');right?.classList.add('timeline-right-hidden');
  const host=document.createElement('div');host.id='timelineSecondViewer';host.className='timeline-second-viewer';wrap.appendChild(host);
  const labelA=document.createElement('div');labelA.id='timelineLabelA';labelA.className='timeline-view-label timeline-view-label-a';labelA.textContent='A｜'+timelineDateText(a.observedAt)+'｜'+a.name;wrap.appendChild(labelA);
  const labelB=document.createElement('div');labelB.id='timelineLabelB';labelB.className='timeline-view-label timeline-view-label-b';labelB.textContent='B｜'+timelineDateText(b.observedAt)+'｜'+b.name;wrap.appendChild(labelB);
  try{
    timelineSecondViewer=new Cesium.Viewer('timelineSecondViewer',{animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,scene3DOnly:true});
window.cesiumViewer = timelineSecondViewer;

    timelineSecondViewer.scene.globe.show=false;timelineSecondViewer.scene.skyAtmosphere.show=false;timelineSecondViewer.scene.backgroundColor=Cesium.Color.fromCssColorString('#00111d');
    const comparisonAssetId=timelineResolvedAssetId(b);if(!comparisonAssetId)throw new Error('比較先のAsset IDを取得できません');timelineSecondTileset=await Cesium.Cesium3DTileset.fromIonAssetId(comparisonAssetId);timelineSecondViewer.scene.primitives.add(timelineSecondTileset);
    if(timelineSecondTileset.readyPromise)await timelineSecondTileset.readyPromise;
    if(sourceB.modelMatrix)timelineSecondTileset.modelMatrix=Cesium.Matrix4.clone(sourceB.modelMatrix,new Cesium.Matrix4());
    if(sourceB.style)timelineSecondTileset.style=sourceB.style;
    const sphereA=sourceA.boundingSphere,sphereB=timelineSecondTileset.boundingSphere;
    if(sphereA)viewer.camera.viewBoundingSphere(sphereA,new Cesium.HeadingPitchRange(Cesium.Math.toRadians(32),Cesium.Math.toRadians(-27),Math.max(sphereA.radius*3,10)));
    if(sphereB)timelineSecondViewer.camera.viewBoundingSphere(sphereB,new Cesium.HeadingPitchRange(Cesium.Math.toRadians(32),Cesium.Math.toRadians(-27),Math.max(sphereB.radius*3,10)));
    timelineInstallCameraSync();setTimeout(()=>{timelineCopyCamera(viewer.camera,timelineSecondViewer.camera);viewer.resize();timelineSecondViewer.resize()},100);
    $('timelineDualState').textContent='2画面比較中：A '+timelineDateText(a.observedAt)+' / B '+timelineDateText(b.observedAt);
  }catch(e){console.error(e);alert('2画面比較の開始に失敗しました。\n'+(e?.message||e));timelineCloseDualView(true)}
}
function timelineCloseDualView(restore=true){
  timelineRemoveLeftSync?.();timelineRemoveRightSync?.();timelineRemoveLeftSync=null;timelineRemoveRightSync=null;
  if(timelineSecondViewer&&!timelineSecondViewer.isDestroyed())timelineSecondViewer.destroy();timelineSecondViewer=null;timelineSecondTileset=null;
  $('timelineSecondViewer')?.remove();$('timelineLabelA')?.remove();$('timelineLabelB')?.remove();
  document.querySelector('main')?.classList.remove('timeline-split-active');document.querySelector('.viewer-wrap')?.classList.remove('timeline-dual-mode');document.querySelector('.right-panel')?.classList.remove('timeline-right-hidden');
  if(restore)timelineShowAllModels();if($('timelineDualState'))$('timelineDualState').textContent='比較する2つの日付・モデルを選択してください。';setTimeout(()=>viewer?.resize(),50);
}
function setupTimelineDualView(){
  const panel=$('timelineCalendarPanel');if(!panel||$('timelineCompareDateA'))return;const box=document.createElement('fieldset');box.className='timeline-dual-field';box.innerHTML='<legend>2画面比較</legend><label>A：比較元<select id="timelineCompareDateA"></select></label><label>B：比較先<select id="timelineCompareDateB"></select></label><label class="timeline-sync-check"><input id="timelineSyncCamera" type="checkbox" checked>左右の視点を同期</label><div class="timeline-dual-actions"><button id="timelineStartDual" type="button">2画面で比較</button><button id="timelineCloseDual" type="button" class="secondary">比較終了</button></div><div id="timelineDualState" class="timeline-state">比較する2つの日付・モデルを選択してください。</div>';panel.insertBefore(box,panel.querySelector('.timeline-calendar'));
  $('timelineStartDual').onclick=timelineStartDualView;$('timelineCloseDual').onclick=()=>timelineCloseDualView(true);populateTimelineCompareSelects();
  document.querySelectorAll('#featureTabs .feature-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='timeline')populateTimelineCompareSelects();else if(timelineSecondViewer)timelineCloseDualView(true)}));
}

// =====================================================
// BI facility filter: single implementation
// Source of truth is records[].facilityName.
// =====================================================
let biFacilityFilterValue='';
let biFacilitySortDirection='asc';
function biFacilityName(record){
  const value=String(record?.facilityName??'').trim();
  return value||'未設定';
}
function biFacilityFilteredRecords(){
  const direction=biFacilitySortDirection==='desc'?-1:1;
  return records
    .filter(record=>!biFacilityFilterValue||biFacilityName(record)===biFacilityFilterValue)
    .slice()
    .sort((a,b)=>direction*(biFacilityName(a).localeCompare(biFacilityName(b),'ja')||String(a.id||'').localeCompare(String(b.id||''),'ja')));
}
function renderBiFacilityControls(){
  const root=$('biDashboard');
  if(!root)return;
  let bar=$('biFacilitySortBar');
  if(!bar){
    const head=root.querySelector('.bi-dashboard-head')||root.firstElementChild;
    bar=document.createElement('div');
    bar.id='biFacilitySortBar';
    bar.className='bi-facility-sort-bar';
    bar.innerHTML='<label>施設名<select id="biFacilitySelect"></select></label><label>並び順<select id="biFacilityOrder"><option value="asc">昇順</option><option value="desc">降順</option></select></label><span id="biFacilitySortState"></span>';
    head?.insertAdjacentElement('afterend',bar);
  }
  const select=$('biFacilitySelect');
  const order=$('biFacilityOrder');
  const names=[...new Set(records.map(biFacilityName))].sort((a,b)=>a.localeCompare(b,'ja'));
  select.innerHTML='';
  const all=document.createElement('option');all.value='';all.textContent='すべての施設';select.appendChild(all);
  names.forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;select.appendChild(option)});
  if(names.includes(biFacilityFilterValue))select.value=biFacilityFilterValue;else{biFacilityFilterValue='';select.value='';}
  order.value=biFacilitySortDirection;
  select.onchange=()=>{biFacilityFilterValue=select.value;renderBiDashboard();syncBiFacilityPins();};
  order.onchange=()=>{biFacilitySortDirection=order.value==='desc'?'desc':'asc';renderBiDashboard();syncBiFacilityPins();};
  const state=$('biFacilitySortState');if(state)state.textContent=(biFacilityFilterValue||'全施設')+'：'+biFacilityFilteredRecords().length+'件';
}
function syncBiFacilityPins(){
  const visible=biFacilityFilteredRecords();
  const visibleIds=new Set(visible.map(record=>String(record.id)));
  records.forEach(record=>{
    const entity=viewer?.entities?.getById(String(record.id));
    if(entity)entity.show=!biFacilityFilterValue||visibleIds.has(String(record.id));
  });
  const state=$('biFacilitySortState');
  if(state)state.textContent=(biFacilityFilterValue||'全施設')+'：'+visible.length+'件';
  viewer?.scene?.requestRender();
}
function setupBiFacilityFilter(){
  document.querySelectorAll('#featureTabs .feature-tab').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.tab==='bi')setTimeout(renderBiFacilityControls,0)}));
}

/* OBJECT_PROPERTIES_V2_BEGIN */
function objectPropEsc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function objectPropNames(feature){
  try{if(typeof feature.getPropertyIds==='function')return feature.getPropertyIds([])||[]}catch(_){ }
  try{if(typeof feature.getPropertyNames==='function')return feature.getPropertyNames()||[]}catch(_){ }
  return [];
}
function objectPropValue(feature,name){
  try{const value=feature.getProperty(name);if(value===undefined||value===null||value==='')return '－';return typeof value==='object'?JSON.stringify(value):String(value)}catch(_){return '－'}
}
function pickedInspectionPin(picked){
  const entity=picked?.id;
  return !!(entity&&(entity.billboard||entity.point||entity.label)&&String(entity.id??entity._id??'').length);
}
function restoreInspectionRightPanel(){
  const title=document.getElementById('rightPanelTitle');if(title)title.textContent='点検・損傷情報';
  document.getElementById('objectPropertiesPanel')?.classList.add('hidden');document.getElementById('imageInfoPanel')?.classList.add('hidden');
}
function showObjectPropertiesRight(feature){
  const title=document.getElementById('rightPanelTitle'),panel=document.getElementById('objectPropertiesPanel'),body=document.getElementById('objectPropertiesBody');
  if(!panel||!body)return;
  document.getElementById('detailEmpty')?.classList.add('hidden');
  document.getElementById('detailForm')?.classList.add('hidden');
  panel.classList.remove('hidden');if(title)title.textContent='オブジェクト属性情報';
  const names=objectPropNames(feature);
  if(!names.length){body.innerHTML='<div class="object-properties-empty">選択したオブジェクトに表示可能な属性情報がありません。</div>';return;}
  const first=['name','id','gml_id','doitt_id','facilityName','facilityId','class','type'];
  names.sort((a,b)=>{const ai=first.indexOf(a),bi=first.indexOf(b);if(ai>=0||bi>=0)return(ai<0?999:ai)-(bi<0?999:bi);return String(a).localeCompare(String(b),'ja')});
  body.innerHTML=names.map(name=>'<div class="object-property-row"><div class="object-property-name">'+objectPropEsc(name)+'</div><div class="object-property-value">'+objectPropEsc(objectPropValue(feature,name))+'</div></div>').join('');
}
function setupObjectPropertiesPickerV2(){
  if(!viewer||viewer.__objectPropertiesV2)return;viewer.__objectPropertiesV2=true;
  const objectHandler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  objectHandler.setInputAction(movement=>{
    const picked=viewer.scene.pick(movement.position);
    if(!picked)return;
    if(picked?.id?.__imageRecordId)return;if(pickedInspectionPin(picked)){restoreInspectionRightPanel();return;}
    const feature=typeof picked.getProperty==='function'?picked:(typeof picked.primitive?.getProperty==='function'?picked.primitive:null);
    if(feature)showObjectPropertiesRight(feature);
  },Cesium.ScreenSpaceEventType.LEFT_CLICK);
  viewer.__objectPropertiesHandler=objectHandler;
}
/* OBJECT_PROPERTIES_V2_END */


/* IMAGE_FEATURE_BEGIN */
const IMAGE_DB_NAME='infra-viewer-image-db-v1',IMAGE_DB_STORE='images';
let imageRecords=[],imageEntities=new Map(),imageObjectUrl='',imagePanoramaX=50,imageSphereViewer=null,imageCompareSync=null;
function imageDbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open(IMAGE_DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(IMAGE_DB_STORE))req.result.createObjectStore(IMAGE_DB_STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function imageDbAll(){const db=await imageDbOpen();return new Promise((resolve,reject)=>{const req=db.transaction(IMAGE_DB_STORE).objectStore(IMAGE_DB_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
async function imageDbPut(value){const db=await imageDbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_DB_STORE,'readwrite');tx.objectStore(IMAGE_DB_STORE).put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function imageDbDelete(id){const db=await imageDbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_DB_STORE,'readwrite');tx.objectStore(IMAGE_DB_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function imageBlobUrl(record){return URL.createObjectURL(record.blob);}
function setupImageFeature(){
  const left=document.querySelector('.left-panel'),right=document.querySelector('.right-panel'),wrap=document.querySelector('.viewer-wrap');
  if(!left||!right||!wrap||$('imageFeaturePanel'))return;
  const panel=document.createElement('section');panel.id='imageFeaturePanel';panel.dataset.featureTab='image';panel.innerHTML=`<h2>画像</h2><div class="image-feature-card">
    <label>画像種別<select id="imageKind"><option value="panorama">全天球画像</option><option value="normal">通常画像</option></select></label>
    <label>画像名<input id="imageName" placeholder="例：橋脚P3 現況"></label>
    <label>撮影日時<input id="imageDate" type="datetime-local"></label>
    <div class="image-input-grid"><label>緯度<input id="imageLat" type="number" step="0.0000001"></label><label>経度<input id="imageLon" type="number" step="0.0000001"></label></div>
    <div class="image-input-grid"><label>標高（m）<input id="imageHeight" type="number" step="0.1" value="0"></label><label>方位角（°）<input id="imageHeading" type="number" step="0.1" value="0"></label></div>
    <label>画像ファイル<input id="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label><div id="imageExifStatus" class="image-exif-status">JPEGに位置情報があれば自動入力します。</div>
    <button id="imageUseCamera" type="button" class="full secondary">現在のカメラ位置を取得</button>
    <button id="imageRegister" type="button" class="full">画像を登録</button>
    <p class="image-note">全天球画像は横：縦が2：1のJPEG・PNGを推奨します。</p></div>
    <h2 class="image-list-title">登録画像</h2><div id="imageRecordList" class="image-record-list"></div>`;
  left.appendChild(panel);
  const info=document.createElement('section');info.id='imageInfoPanel';info.className='image-info-panel hidden';right.querySelector('section')?.appendChild(info);
  const overlay=document.createElement('div');overlay.id='imageViewerOverlay';overlay.className='image-viewer-overlay hidden';overlay.innerHTML='<div class="image-viewer-head"><b id="imageViewerTitle">画像</b><button id="imageViewerClose" type="button">3Dへ戻る</button></div><div id="imageViewerStage" class="image-viewer-stage"></div>';wrap.appendChild(overlay);
  const compare=document.createElement('div');compare.id='imageComparePanel';compare.className='image-compare-panel hidden';compare.innerHTML='<div class="image-viewer-head"><b>3Dと画像を比較</b><div class="image-compare-head-actions"><button id="imageCompareInfoToggle" type="button" class="secondary">情報欄を隠す</button><button id="imageCompareClose" type="button">比較終了</button></div></div><div id="imageCompareStage" class="image-viewer-stage"></div>';wrap.appendChild(compare);
  $('imageUseCamera').onclick=imageUseCurrentCamera;$('imageRegister').onclick=imageRegisterRecord;$('imageFile').addEventListener('change',imageHandleSelectedFile);$('imageViewerClose').onclick=()=>imageCloseViewer(false);$('imageCompareClose').onclick=()=>imageCloseViewer(true);$('imageCompareInfoToggle').onclick=imageToggleCompareInfo;
  imageDbAll().then(items=>{imageRecords=items;imageRecords.forEach(imageAddPin);imageRenderList();}).catch(console.error);
  const handler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);handler.setInputAction(movement=>{const picked=viewer.scene.pick(movement.position);const imageId=picked?.id?.__imageRecordId;if(!imageId)return;const record=imageRecords.find(x=>x.id===imageId);if(record)imageShowInfo(record);},Cesium.ScreenSpaceEventType.LEFT_CLICK);viewer.__imageFeatureHandler=handler;
}
function imageUseCurrentCamera(){const c=Cesium.Cartographic.fromCartesian(viewer.camera.positionWC);$('imageLat').value=Cesium.Math.toDegrees(c.latitude).toFixed(7);$('imageLon').value=Cesium.Math.toDegrees(c.longitude).toFixed(7);$('imageHeight').value=c.height.toFixed(2);$('imageHeading').value=Cesium.Math.toDegrees(viewer.camera.heading).toFixed(1);}

function imageExifReadValue(view,tiffStart,entryOffset,littleEndian){
  const type=view.getUint16(entryOffset+2,littleEndian),count=view.getUint32(entryOffset+4,littleEndian);
  const size={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8}[type]||1;
  const bytes=size*count,valueOffset=bytes<=4?entryOffset+8:tiffStart+view.getUint32(entryOffset+8,littleEndian);
  const rational=(offset,signed=false)=>{const a=signed?view.getInt32(offset,littleEndian):view.getUint32(offset,littleEndian),b=signed?view.getInt32(offset+4,littleEndian):view.getUint32(offset+4,littleEndian);return b?a/b:0};
  if(type===2){let text='';for(let i=0;i<count&&view.getUint8(valueOffset+i);i++)text+=String.fromCharCode(view.getUint8(valueOffset+i));return text;}
  if(type===3)return count===1?view.getUint16(valueOffset,littleEndian):Array.from({length:count},(_,i)=>view.getUint16(valueOffset+i*2,littleEndian));
  if(type===4)return count===1?view.getUint32(valueOffset,littleEndian):Array.from({length:count},(_,i)=>view.getUint32(valueOffset+i*4,littleEndian));
  if(type===5)return count===1?rational(valueOffset):Array.from({length:count},(_,i)=>rational(valueOffset+i*8));
  if(type===9)return count===1?view.getInt32(valueOffset,littleEndian):Array.from({length:count},(_,i)=>view.getInt32(valueOffset+i*4,littleEndian));
  if(type===10)return count===1?rational(valueOffset,true):Array.from({length:count},(_,i)=>rational(valueOffset+i*8,true));
  if(type===1||type===7)return count===1?view.getUint8(valueOffset):Array.from({length:count},(_,i)=>view.getUint8(valueOffset+i));
  return undefined;
}
function imageExifReadIfd(view,tiffStart,offset,littleEndian){
  const result={};if(!offset||tiffStart+offset+2>view.byteLength)return result;
  const start=tiffStart+offset,count=view.getUint16(start,littleEndian);
  for(let i=0;i<count;i++){const entry=start+2+i*12;if(entry+12>view.byteLength)break;const tag=view.getUint16(entry,littleEndian);try{result[tag]=imageExifReadValue(view,tiffStart,entry,littleEndian)}catch(_){}}
  return result;
}
function imageExifDms(value,ref){if(!Array.isArray(value)||value.length<3)return null;let decimal=Number(value[0])+Number(value[1])/60+Number(value[2])/3600;if(ref==='S'||ref==='W')decimal*=-1;return Number.isFinite(decimal)?decimal:null;}
function imageExifLocalDate(value){if(!value)return '';const m=String(value).match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})(?::\d{2})?/);return m?`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`:'';}
async function imageReadExif(file){
  if(!file||!/(jpe?g)$/i.test(file.name||'')&&!/image\/jpeg/i.test(file.type||''))return {};
  const buffer=await file.arrayBuffer(),view=new DataView(buffer);if(view.byteLength<4||view.getUint16(0,false)!==0xffd8)return {};
  let offset=2;
  while(offset+4<view.byteLength){if(view.getUint8(offset)!==0xff){offset++;continue;}const marker=view.getUint8(offset+1),length=view.getUint16(offset+2,false);if(marker===0xe1&&length>=8){const exif=String.fromCharCode(...new Uint8Array(buffer,offset+4,6));if(exif==='Exif\0\0'){
      const tiffStart=offset+10,order=view.getUint16(tiffStart,false),littleEndian=order===0x4949;if(!littleEndian&&order!==0x4d4d)return {};
      const ifd0=imageExifReadIfd(view,tiffStart,view.getUint32(tiffStart+4,littleEndian),littleEndian);
      const gps=imageExifReadIfd(view,tiffStart,Number(ifd0[0x8825]||0),littleEndian),exifIfd=imageExifReadIfd(view,tiffStart,Number(ifd0[0x8769]||0),littleEndian);
      const lat=imageExifDms(gps[0x0002],gps[0x0001]),lon=imageExifDms(gps[0x0004],gps[0x0003]);
      let altitude=Number(gps[0x0006]);if(Number(gps[0x0005])===1)altitude*=-1;
      return {lat,lon,height:Number.isFinite(altitude)?altitude:null,heading:Number.isFinite(Number(gps[0x0011]))?Number(gps[0x0011]):null,date:imageExifLocalDate(exifIfd[0x9003]||exifIfd[0x9004]||ifd0[0x0132])};
    }}
    if(marker===0xda||marker===0xd9)break;offset+=2+length;
  }
  return {};
}
async function imageHandleSelectedFile(event){
  const file=event.target.files?.[0],state=$('imageExifStatus');if(!file)return;
  if(state)state.textContent='画像の位置情報を確認しています。';
  try{const exif=await imageReadExif(file);const hasGps=Number.isFinite(exif.lat)&&Number.isFinite(exif.lon);
    if(hasGps){$('imageLat').value=exif.lat.toFixed(7);$('imageLon').value=exif.lon.toFixed(7);if(Number.isFinite(exif.height))$('imageHeight').value=exif.height.toFixed(2);if(Number.isFinite(exif.heading))$('imageHeading').value=exif.heading.toFixed(1);if(exif.date)$('imageDate').value=exif.date;if(state)state.textContent='EXIFの緯度・経度'+(Number.isFinite(exif.height)?'・標高':'')+'を自動入力しました。';}
    else{if(state)state.textContent='位置情報は見つかりませんでした。必要に応じて手入力してください。';}
  }catch(error){console.warn('EXIF read failed',error);if(state)state.textContent='位置情報を読み取れませんでした。手入力で登録できます。';}
}
async function imageReplaceRecord(id){
  const record=imageRecords.find(item=>item.id===id);if(!record)return;
  const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;document.body.appendChild(input);
  input.onchange=async()=>{const file=input.files?.[0];input.remove();if(!file)return;
    try{const exif=await imageReadExif(file),hasGps=Number.isFinite(exif.lat)&&Number.isFinite(exif.lon);let updateMetadata=false;
      if(hasGps)updateMetadata=confirm('差し替え画像に位置情報があります。\n\nOK：画像と撮影位置・日時を更新\nキャンセル：画像だけ差し替え');
      record.blob=file;record.fileName=file.name;record.size=file.size;record.updatedAt=new Date().toISOString();
      if(updateMetadata){record.lat=exif.lat;record.lon=exif.lon;if(Number.isFinite(exif.height))record.height=exif.height;if(Number.isFinite(exif.heading))record.heading=exif.heading;if(exif.date)record.date=exif.date;}
      await imageDbPut(record);const old=imageEntities.get(record.id);if(old)viewer.entities.remove(old);imageEntities.delete(record.id);imageAddPin(record);imageRenderList();imageShowInfo(record);status('画像を差し替えました。');
    }catch(error){console.error(error);alert('画像の差し替えに失敗しました。');}
  };input.click();
}

async function imageRegisterRecord(){const file=$('imageFile')?.files?.[0],lat=Number($('imageLat').value),lon=Number($('imageLon').value);if(!file||!Number.isFinite(lat)||!Number.isFinite(lon)){alert('画像ファイル、緯度、経度を入力してください。');return;}const record={id:'IMG-'+Date.now(),kind:$('imageKind').value,name:$('imageName').value.trim()||file.name,date:$('imageDate').value,lat,lon,height:Number($('imageHeight').value)||0,heading:Number($('imageHeading').value)||0,fileName:file.name,size:file.size,blob:file,createdAt:new Date().toISOString()};await imageDbPut(record);imageRecords.push(record);imageAddPin(record);imageRenderList();$('imageFile').value='';status('画像を登録しました。');}
function imageAddPin(record){if(imageEntities.has(record.id))return;const entity=viewer.entities.add({id:'image:'+record.id,position:Cesium.Cartesian3.fromDegrees(record.lon,record.lat,record.height),point:{pixelSize:14,color:Cesium.Color.DEEPSKYBLUE,outlineColor:Cesium.Color.WHITE,outlineWidth:3,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:'📷 '+record.name,font:'12px sans-serif',fillColor:Cesium.Color.WHITE,showBackground:true,backgroundColor:Cesium.Color.fromCssColorString('#0b2633').withAlpha(.88),pixelOffset:new Cesium.Cartesian2(0,-24),disableDepthTestDistance:Number.POSITIVE_INFINITY}});entity.__imageRecordId=record.id;imageEntities.set(record.id,entity);}
function imageRenderList(){const list=$('imageRecordList');if(!list)return;const sorted=[...imageRecords].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));list.innerHTML=sorted.length?sorted.map(r=>`<article class="image-record-card" data-image-card="${r.id}" role="button" tabindex="0" aria-label="${esc(r.name)}の画像情報を表示"><b>${esc(r.name)}</b><small>${r.kind==='panorama'?'全天球画像':'通常画像'}${r.date?' / '+esc(r.date):''}</small><div><button type="button" data-image-focus="${r.id}">位置</button><button type="button" data-image-open="${r.id}">開く</button><button type="button" data-image-compare="${r.id}">比較</button><button type="button" data-image-delete="${r.id}" class="danger">削除</button></div></article>`).join(''):'<div class="image-empty">登録画像はありません。</div>';list.querySelectorAll('[data-image-card]').forEach(card=>{const select=()=>{const record=imageRecords.find(x=>x.id===card.dataset.imageCard);if(record)imageShowInfo(record)};card.onclick=e=>{if(!e.target.closest('button'))select()};card.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();select()}}});list.querySelectorAll('[data-image-focus]').forEach(b=>b.onclick=e=>{e.stopPropagation();imageFocus(b.dataset.imageFocus)});list.querySelectorAll('[data-image-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();imageOpen(b.dataset.imageOpen,false)});list.querySelectorAll('[data-image-compare]').forEach(b=>b.onclick=e=>{e.stopPropagation();imageOpen(b.dataset.imageCompare,true)});list.querySelectorAll('[data-image-delete]').forEach(b=>b.onclick=e=>{e.stopPropagation();imageDelete(b.dataset.imageDelete)});}
function imageFocus(id){const r=imageRecords.find(x=>x.id===id);if(!r)return;viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(r.lon,r.lat,r.height+25),orientation:{heading:Cesium.Math.toRadians(r.heading),pitch:Cesium.Math.toRadians(-25),roll:0}});}
async function imageDelete(id){if(!confirm('この画像を削除しますか？'))return;await imageDbDelete(id);imageRecords=imageRecords.filter(x=>x.id!==id);const entity=imageEntities.get(id);if(entity)viewer.entities.remove(entity);imageEntities.delete(id);imageRenderList();$('imageInfoPanel')?.classList.add('hidden');status('画像を削除しました。');}
function createSpherePanorama(stage,record,onViewChange){
  stage.innerHTML='';stage.className='image-viewer-stage sphere-panorama';
  const canvas=document.createElement('canvas');canvas.className='sphere-panorama-canvas';stage.appendChild(canvas);
  const guide=document.createElement('div');guide.className='panorama-guide';guide.textContent='ドラッグで上下左右を見渡す・ホイールで拡大縮小';stage.appendChild(guide);
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false});
  if(!gl){stage.innerHTML='<div class="image-empty">WebGLを利用できないため球面表示できません。</div>';return null;}
  const vs=`attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.0,1.0);}`;
  const fs=`precision highp float;varying vec2 v;uniform sampler2D tex;uniform float aspect;uniform float yaw;uniform float pitch;uniform float fov;const float PI=3.141592653589793;void main(){float t=tan(fov*0.5);vec3 dir=normalize(vec3(v.x*aspect*t,v.y*t,-1.0));float cp=cos(pitch),sp=sin(pitch);dir=vec3(dir.x,cp*dir.y-sp*dir.z,sp*dir.y+cp*dir.z);float cy=cos(yaw),sy=sin(yaw);dir=vec3(cy*dir.x-sy*dir.z,dir.y,sy*dir.x+cy*dir.z);float lon=atan(dir.x,-dir.z);float lat=asin(clamp(dir.y,-1.0,1.0));vec2 uv=vec2(fract(lon/(2.0*PI)+0.5),0.5-lat/PI);gl_FragColor=texture2D(tex,uv);}`;
  const shader=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh};
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  let yaw=Cesium.Math.toRadians(Number(record.heading)||0),pitch=0,fov=Cesium.Math.toRadians(75),ready=false,raf=0,destroyed=false;
  const u={aspect:gl.getUniformLocation(program,'aspect'),yaw:gl.getUniformLocation(program,'yaw'),pitch:gl.getUniformLocation(program,'pitch'),fov:gl.getUniformLocation(program,'fov')};
  const resize=()=>{const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);const rw=Math.round(w*dpr),rh=Math.round(h*dpr);if(canvas.width!==rw||canvas.height!==rh){canvas.width=rw;canvas.height=rh;gl.viewport(0,0,rw,rh);}};
  const draw=()=>{raf=0;if(destroyed||!ready)return;resize();gl.useProgram(program);gl.uniform1f(u.aspect,canvas.width/canvas.height);gl.uniform1f(u.yaw,yaw);gl.uniform1f(u.pitch,pitch);gl.uniform1f(u.fov,fov);gl.drawArrays(gl.TRIANGLES,0,6);};
  const requestDraw=()=>{if(!raf)raf=requestAnimationFrame(draw)};
  const notify=()=>{requestDraw();onViewChange?.({heading:Cesium.Math.zeroToTwoPi(yaw),pitch,fov});};
  const img=new Image();imageObjectUrl=imageBlobUrl(record);img.onload=()=>{
    try{
      const max=gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096;let source=img;
      if(img.width>max||img.height>max){const scale=Math.min(max/img.width,max/img.height),off=document.createElement('canvas');off.width=Math.max(1,Math.floor(img.width*scale));off.height=Math.max(1,Math.floor(img.height*scale));off.getContext('2d').drawImage(img,0,0,off.width,off.height);source=off;}
      gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);ready=true;notify();
    }catch(error){console.error('Panorama texture load failed',error);stage.innerHTML='<div class=\"image-empty\">全天球画像を表示できませんでした。画像サイズまたは形式を確認してください。</div>';}
  };img.onerror=()=>{stage.innerHTML='<div class=\"image-empty\">全天球画像を読み込めませんでした。</div>';};img.src=imageObjectUrl;
  let drag=false,lastX=0,lastY=0;
  canvas.onpointerdown=e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)};
  canvas.onpointermove=e=>{if(!drag)return;const scale=fov/Math.max(stage.clientHeight,1);yaw-=(e.clientX-lastX)*scale;pitch=Math.max(-Math.PI/2+0.02,Math.min(Math.PI/2-0.02,pitch+(e.clientY-lastY)*scale));lastX=e.clientX;lastY=e.clientY;notify();};
  const stop=e=>{drag=false;try{canvas.releasePointerCapture(e.pointerId)}catch(_){}};canvas.onpointerup=stop;canvas.onpointercancel=stop;
  canvas.onwheel=e=>{e.preventDefault();fov=Math.max(Cesium.Math.toRadians(25),Math.min(Cesium.Math.toRadians(105),fov*(e.deltaY>0?1.08:0.92)));notify();};
  return {setView(v,emit=false){if(Number.isFinite(v.heading))yaw=v.heading;if(Number.isFinite(v.pitch))pitch=Math.max(-Math.PI/2+0.02,Math.min(Math.PI/2-0.02,v.pitch));if(Number.isFinite(v.fov))fov=v.fov;requestDraw();if(emit)notify();},getView:()=>({heading:yaw,pitch,fov}),destroy(){destroyed=true;if(raf)cancelAnimationFrame(raf);if(imageObjectUrl){URL.revokeObjectURL(imageObjectUrl);imageObjectUrl='';}try{gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program)}catch(_){}}};
}
function imageApplyViewToCesium(record,view){
  if(!viewer||!record)return;const destination=Cesium.Cartesian3.fromDegrees(record.lon,record.lat,record.height);viewer.camera.setView({destination,orientation:{heading:view.heading,pitch:view.pitch,roll:0}});if(viewer.camera.frustum&&'fov' in viewer.camera.frustum)viewer.camera.frustum.fov=view.fov;
}
function imageStartCompareSync(record){
  imageStopCompareSync();let applying=false,last='';
  const sync=()=>{if(applying||!imageSphereViewer||$('imageComparePanel')?.classList.contains('hidden'))return;const c=viewer.camera;const cart=Cesium.Cartographic.fromCartesian(c.positionWC);const distance=Math.abs(Cesium.Math.toDegrees(cart.latitude)-record.lat)+Math.abs(Cesium.Math.toDegrees(cart.longitude)-record.lon)+Math.abs(cart.height-record.height)/100000;const key=[c.heading.toFixed(5),c.pitch.toFixed(5),(c.frustum?.fov||0).toFixed(5)].join('|');if(distance<0.002&&key!==last){last=key;imageSphereViewer.setView({heading:c.heading,pitch:c.pitch,fov:c.frustum?.fov});}};
  viewer.scene.postRender.addEventListener(sync);imageCompareSync={stop:()=>viewer.scene.postRender.removeEventListener(sync),setApplying:v=>applying=v};
}
function imageStopCompareSync(){if(imageCompareSync){imageCompareSync.stop();imageCompareSync=null;}}
function imageStage(stage,record,compare=false){
  imageSphereViewer?.destroy();imageSphereViewer=null;
  if(record.kind==='panorama'){
    imageSphereViewer=createSpherePanorama(stage,record,view=>{if(compare){imageCompareSync?.setApplying(true);imageApplyViewToCesium(record,view);imageCompareSync?.setApplying(false);}});
    if(compare&&imageSphereViewer){const initial=imageSphereViewer.getView();imageApplyViewToCesium(record,initial);imageStartCompareSync(record);}
  }else{stage.innerHTML='';stage.className='image-viewer-stage';if(imageObjectUrl)URL.revokeObjectURL(imageObjectUrl);imageObjectUrl=imageBlobUrl(record);const img=document.createElement('img');img.src=imageObjectUrl;img.alt=record.name;stage.appendChild(img);if(compare){viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(record.lon,record.lat,record.height+2),orientation:{heading:Cesium.Math.toRadians(record.heading||0),pitch:0,roll:0}});}}
}
function imageOpen(id,compare){const record=imageRecords.find(x=>x.id===id);if(!record)return;imageShowInfo(record);if(compare){document.querySelector('main')?.classList.add('image-compare-active');document.querySelector('main')?.classList.remove('image-compare-hide-info');const toggle=$('imageCompareInfoToggle');if(toggle)toggle.textContent='情報欄を隠す';$('imageComparePanel').classList.remove('hidden');setTimeout(()=>{viewer?.resize();imageSphereViewer?.setView(imageSphereViewer.getView());},60);imageStage($('imageCompareStage'),record,true);}else{$('imageViewerOverlay').classList.remove('hidden');$('imageViewerTitle').textContent=record.name;imageStage($('imageViewerStage'),record,false);}}
function imageToggleCompareInfo(){const main=document.querySelector('main');if(!main)return;const hidden=main.classList.toggle('image-compare-hide-info');$('imageCompareInfoToggle').textContent=hidden?'情報欄を表示':'情報欄を隠す';setTimeout(()=>{viewer?.resize();if(imageSphereViewer)imageSphereViewer.setView(imageSphereViewer.getView());},60);}
function imageCloseViewer(compare){$(compare?'imageComparePanel':'imageViewerOverlay')?.classList.add('hidden');if(compare){imageStopCompareSync();document.querySelector('main')?.classList.remove('image-compare-active','image-compare-hide-info');setTimeout(()=>viewer?.resize(),60);}imageSphereViewer?.destroy();imageSphereViewer=null;if(imageObjectUrl){URL.revokeObjectURL(imageObjectUrl);imageObjectUrl='';}}
function imageShowInfo(record){document.querySelectorAll('[data-image-card]').forEach(card=>card.classList.toggle('selected',card.dataset.imageCard===record.id));restoreInspectionRightPanel();$('detailEmpty')?.classList.add('hidden');$('detailForm')?.classList.add('hidden');$('objectPropertiesPanel')?.classList.add('hidden');const panel=$('imageInfoPanel');panel.classList.remove('hidden');$('rightPanelTitle').textContent='画像情報';const url=imageBlobUrl(record);panel.innerHTML=`<img class="image-info-preview" src="${url}" alt="${esc(record.name)}"><dl><dt>画像名</dt><dd>${esc(record.name)}</dd><dt>種類</dt><dd>${record.kind==='panorama'?'全天球画像':'通常画像'}</dd><dt>撮影日時</dt><dd>${esc(record.date||'－')}</dd><dt>位置</dt><dd>${record.lat.toFixed(7)}, ${record.lon.toFixed(7)}, ${record.height.toFixed(2)}m</dd><dt>方位角</dt><dd>${record.heading}°</dd><dt>ファイル</dt><dd>${esc(record.fileName||'－')}</dd></dl><div class="image-info-actions"><button type="button" id="imageInfoFocus">撮影位置へ移動</button><button type="button" id="imageInfoOpen">画像を開く</button><button type="button" id="imageInfoCompare">3Dと比較</button><button type="button" id="imageInfoReplace" class="image-replace-button">画像を差し替え</button></div>`;$('imageInfoFocus').onclick=()=>imageFocus(record.id);$('imageInfoOpen').onclick=()=>imageOpen(record.id,false);$('imageInfoCompare').onclick=()=>imageOpen(record.id,true);$('imageInfoReplace').onclick=()=>imageReplaceRecord(record.id);}
/* IMAGE_FEATURE_END */

async function init(){
  setTimeout(()=>{$('displayMode')?.addEventListener('change',updateLocalAxisSettingsVisibility);updateLocalAxisSettingsVisibility();},0);if(ready())Cesium.Ion.defaultAccessToken=cfg.CESIUM_ACCESS_TOKEN;/* PLATEAU_TERRAIN_BEGIN */
let plateauTerrainProvider;
try {
  plateauTerrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
    'https://tile.plateauview.mlit.go.jp/terrain/',
    { requestVertexNormals: true }
  );
  console.info('PLATEAU-Terrain loaded.');
} catch (terrainError) {
  console.warn('PLATEAU-Terrain could not be loaded. Falling back to the WGS84 ellipsoid.', terrainError);
  plateauTerrainProvider = new Cesium.EllipsoidTerrainProvider();
}
/* PLATEAU_TERRAIN_END */
viewer=new Cesium.Viewer('cesiumContainer',{terrainProvider: plateauTerrainProvider,animation:false,timeline:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,baseLayerPicker:false,infoBox:false,selectionIndicator:false,geocoder:false});const savedMainAssetId=String(localStorage.getItem('infra-last-main-asset-id')||'').trim();$('assetId').value=savedMainAssetId||'5982758';$('displayMode').value=localStorage.getItem('infra-display-mode')||'geo';if(!localStorage.getItem('infra-japan-local-migrated')){$('displayMode').value='geo';localStorage.setItem('infra-display-mode','geo');localStorage.setItem('infra-axis-settings',JSON.stringify({preset:'japan',rx:0,ry:0,rz:0}));localStorage.setItem('infra-japan-local-migrated','1');}applyDisplayMode();
viewer.scene.globe.depthTestAgainstTerrain = true;
bind();setupObjectPropertiesPickerV2();hideAxisSettingsForAllModes();updateLocalAxisSettingsVisibility();moveStatusToViewer();setupViewpointManager();setupPointSizeOnly();setupPointCloudColor();setupPointCloudPerformance();setupPointCloudAutoAll();setupPointCloudHeightOffset();setupMeasurementTools();setupBiDashboard();setupTimelineCalendar();setupTimelineDualView();setupBiFacilityFilter();setupTerrainSwitcher();setupImageFeature();setupFeatureTabs();moveFeatureTabsToHeader();renderRecords();
  const startupMainAssetId=String($('assetId').value||'').trim();
  if(ready()&&/^\d+$/.test(startupMainAssetId))await loadAsset(Number(startupMainAssetId));
  else $('assetStatus').textContent='config.jsへトークンを設定してください。';
  await autoLoadSavedAdditionalAssets();
}
function applyDisplayMode(){
  const local=$('displayMode').value==='local';if($('axisSettings'))$('axisSettings').style.display=local?'block':'none';
  localStorage.setItem('infra-display-mode',local?'local':'geo');
  viewer.scene.globe.show=!local;
  viewer.scene.globe.depthTestAgainstTerrain=false;
  if(viewer.scene.skyAtmosphere)viewer.scene.skyAtmosphere.show=!local;
  if(viewer.scene.sun)viewer.scene.sun.show=!local;
  if(viewer.scene.moon)viewer.scene.moon.show=!local;
  viewer.scene.fog.enabled=!local;
  viewer.scene.backgroundColor=local?Cesium.Color.fromCssColorString('#071522'):Cesium.Color.BLACK;
  viewer.scene.requestRender();
}
function placeAsLocalModel(){
  if(!mainTileset)return;
  // Match the working Cesium Sandcastle example exactly.
  // Preserve the asset's authored orientation and place its local origin on an ENU frame.
  mainTileset.modelMatrix=Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(0.0,0.0,0.0)
  );
  ionSourceMatrix=Cesium.Matrix4.clone(mainTileset.modelMatrix,new Cesium.Matrix4());
}
function axisCorrectionMatrix(){const p=$('axisPreset').value;let b;if(p==='japan')b=new Cesium.Matrix3(0,1,0,1,0,0,0,0,1);else if(p==='yup')b=new Cesium.Matrix3(1,0,0,0,0,1,0,1,0);else b=Cesium.Matrix3.clone(Cesium.Matrix3.IDENTITY);const rx=Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(Number($('rotX').value)||0)),ry=Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(Number($('rotY').value)||0)),rz=Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(Number($('rotZ').value)||0));return Cesium.Matrix3.multiply(Cesium.Matrix3.multiply(rz,Cesium.Matrix3.multiply(ry,rx,new Cesium.Matrix3()),new Cesium.Matrix3()),b,new Cesium.Matrix3())}
function applyAxisSettings(){
  if(!mainTileset){status('先にAssetを読み込んでください。');return;}
  try{
    clip.enabled=false;
    if($('clipEnabled'))$('clipEnabled').checked=false;
    if(clip.collection)clip.collection.enabled=false;

    // Reset to the same stable ENU placement first, preventing accumulated rotations.
    mainTileset.modelMatrix=Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromDegrees(0.0,0.0,0.0)
    );
    const baseMatrix=Cesium.Matrix4.clone(mainTileset.modelMatrix,new Cesium.Matrix4());
    const pivot=Cesium.Cartesian3.clone(mainTileset.boundingSphere.center);
    const rx=Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(Number($('rotX').value)||0));
    const ry=Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(Number($('rotY').value)||0));
    const rz=Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(Number($('rotZ').value)||0));
    const rot3=Cesium.Matrix3.multiply(rz,Cesium.Matrix3.multiply(ry,rx,new Cesium.Matrix3()),new Cesium.Matrix3());
    const rot4=Cesium.Matrix4.fromRotationTranslation(rot3,Cesium.Cartesian3.ZERO,new Cesium.Matrix4());
    const toOrigin=Cesium.Matrix4.fromTranslation(Cesium.Cartesian3.negate(pivot,new Cesium.Cartesian3()),new Cesium.Matrix4());
    const back=Cesium.Matrix4.fromTranslation(pivot,new Cesium.Matrix4());
    mainTileset.modelMatrix=Cesium.Matrix4.multiply(back,Cesium.Matrix4.multiply(rot4,Cesium.Matrix4.multiply(toOrigin,baseMatrix,new Cesium.Matrix4()),new Cesium.Matrix4()),new Cesium.Matrix4());

    if(typeof setupClipFromModel==='function')setupClipFromModel(true);
    clip.enabled=false;
    if($('clipEnabled'))$('clipEnabled').checked=false;
    if(clip.collection)clip.collection.enabled=false;
    if(typeof focusAsset==='function')focusAsset();
    status('Cesium ion標準姿勢を基準に回転を適用しました。');
  }catch(e){console.error(e);status('回転適用に失敗しました。Consoleを確認してください。');}
}
function additionalModelStorageKey(){return 'infra-additional-models';}
function loadAdditionalModelDefs(){try{return JSON.parse(localStorage.getItem(additionalModelStorageKey())||'[]');}catch(_){return [];}}
function saveAdditionalModelDefs(items){localStorage.setItem(additionalModelStorageKey(),JSON.stringify(items));}
function placeAdditionalAsLocal(tileset){
  tileset.modelMatrix=Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(0.0,0.0,0.0));
}
function renderAdditionalModels(){
  const list=$('additionalModelList');if(!list)return;const defs=loadAdditionalModelDefs();list.innerHTML='';
  if(!defs.length){list.innerHTML='<div class="additional-model-empty">追加モデルはありません</div>';return;}
  defs.forEach(def=>{
    const row=document.createElement('div');row.className='additional-model-item';row.dataset.assetId=def.id;
    const head=document.createElement('div');head.className='additional-model-head';
    const check=document.createElement('input');check.type='checkbox';check.checked=def.visible!==false;check.title='表示・非表示';check.onchange=()=>toggleAdditionalModel(def.id,check.checked);
    const text=document.createElement('div');text.className='additional-model-text';text.innerHTML='<b></b><small></small>';text.querySelector('b').textContent=def.name||('Asset '+def.id);text.querySelector('small').textContent='Asset ID：'+def.id;
    const state=document.createElement('span');state.className='additional-model-state';state.textContent=additionalTilesets.has(String(def.id))?'表示中':'未読込';
    head.append(check,text,state);
    const actions=document.createElement('div');actions.className='additional-model-actions';
    const load=document.createElement('button');load.type='button';load.textContent=additionalTilesets.has(String(def.id))?'再読込':'読込';load.onclick=()=>loadAdditionalAsset(def.id);
    const focus=document.createElement('button');focus.type='button';focus.textContent='フォーカス';focus.disabled=!additionalTilesets.has(String(def.id));focus.onclick=()=>focusAdditionalAsset(def.id);
    const remove=document.createElement('button');remove.type='button';remove.className='additional-model-remove';remove.textContent='削除';remove.onclick=()=>removeAdditionalAsset(def.id);
    actions.append(load,focus,remove);row.append(head,actions);list.appendChild(row);
  });
}
async function addAdditionalAsset(){
  const id=String($('additionalAssetId').value||'').trim(),name=String($('additionalAssetName').value||'').trim();
  if(!/^\d+$/.test(id)){alert('Cesium ion Asset IDを数字で入力してください。');return;}
  const mainId=String($('assetId').value||'').trim();if(id===mainId){alert('メインAssetと同じIDです。');return;}
  const defs=loadAdditionalModelDefs();if(defs.some(x=>String(x.id)===id)){alert('同じAsset IDが登録されています。');return;}
  defs.push({id,name:name||('Asset '+id),visible:true});saveAdditionalModelDefs(defs);$('additionalAssetId').value='';$('additionalAssetName').value='';renderAdditionalModels();await loadAdditionalAsset(id);
}
async function loadAdditionalAsset(id){
  if(!ready()){status('config.jsにトークンを設定してください。');return;}
  const key=String(id),old=additionalTilesets.get(key);if(old){viewer.scene.primitives.remove(old);additionalTilesets.delete(key);}
  status('追加モデル Asset '+key+' を読み込んでいます。');
  try{
    const tileset=await Cesium.Cesium3DTileset.fromIonAssetId(Number(key));viewer.scene.primitives.add(tileset);
    const def=loadAdditionalModelDefs().find(x=>String(x.id)===key);tileset.show=def?.visible!==false;
    if($('displayMode')?.value==='local')placeAdditionalAsLocal(tileset);
    additionalTilesets.set(key,tileset);registerPointCloudTileset(tileset);applySavedPointCloudHeightOffset(key,tileset);renderAdditionalModels();renderPointCloudHeightRows();schedulePointCloudAutoApply();status('追加モデル Asset '+key+' を読み込みました。');
  }catch(e){console.error(e);renderAdditionalModels();alert('追加モデル Asset '+key+' の読込に失敗しました。\nトークン、権限、Asset IDを確認してください。');status('追加モデルの読込に失敗しました。');}
setTimeout(enhanceAdditionalModelDateInputs,0);}

async function autoLoadSavedAdditionalAssets(){
  if(!ready())return;
  const defs=loadAdditionalModelDefs();
  const targets=defs.filter(def=>def&&def.id&&def.autoLoad!==false);
  if(!targets.length){renderAdditionalModels();return;}
  let loaded=0,failed=0;
  status('保存済み追加Assetを自動読込しています。');
  for(const def of targets){
    try{
      await loadAdditionalAsset(def.id);
      loaded++;
    }catch(_){failed++;}
  }
  renderAdditionalModels();
  status('追加Assetの自動読込完了：'+loaded+'件'+(failed?'、失敗 '+failed+'件':''));
}
function toggleAdditionalModel(id,visible){
  const defs=loadAdditionalModelDefs(),def=defs.find(x=>String(x.id)===String(id));if(def){def.visible=visible;saveAdditionalModelDefs(defs);}const t=additionalTilesets.get(String(id));if(t)t.show=visible;
}
function focusAdditionalAsset(id){
  const tileset=additionalTilesets.get(String(id));if(!tileset)return;tileset.show=true;const s=tileset.boundingSphere;viewer.camera.viewBoundingSphere(s,new Cesium.HeadingPitchRange(Cesium.Math.toRadians(35),Cesium.Math.toRadians(-28),Math.max(s.radius*3,10)));viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);viewer.scene.requestRender();
}
function removeAdditionalAsset(id){
  const key=String(id),tileset=additionalTilesets.get(key);if(tileset)viewer.scene.primitives.remove(tileset);additionalTilesets.delete(key);saveAdditionalModelDefs(loadAdditionalModelDefs().filter(x=>String(x.id)!==key));renderAdditionalModels();
}
async function reloadAdditionalModels(){for(const def of loadAdditionalModelDefs())await loadAdditionalAsset(def.id);}
async function loadAsset(id){
  if(!ready()){status('config.jsにトークンを設定してください。');return}
  status('読込中...');
  $('focusAssetBtn').disabled=true;
  try{
    clearClip();
    clip.enabled=false;
    $('clipEnabled').checked=false;
    if(mainTileset)viewer.scene.primitives.remove(mainTileset);
    mainTileset=await Cesium.Cesium3DTileset.fromIonAssetId(Number(id));
    const loadedMainAssetId=String(Number(id));
    $('assetId').value=loadedMainAssetId;
    localStorage.setItem('infra-last-main-asset-id',loadedMainAssetId);
    mainTileset.show=true;
    $('assetVisible').checked=true;
    viewer.scene.primitives.add(mainTileset);
    registerPointCloudTileset(mainTileset);
    ionSourceMatrix=Cesium.Matrix4.clone(mainTileset.modelMatrix,new Cesium.Matrix4());
    axisBaseMatrix=Cesium.Matrix4.clone(mainTileset.modelMatrix,new Cesium.Matrix4());
    axisPivot=Cesium.Cartesian3.clone(mainTileset.boundingSphere.center);
    originalModelMatrix=Cesium.Matrix4.clone(mainTileset.modelMatrix,new Cesium.Matrix4());
    applyDisplayMode();
    if($('displayMode').value==='local')placeAsLocalModel();
    applySavedPointCloudHeightOffset(String(id),mainTileset);
    renderPointCloudHeightRows();
    setupClipFromModel(false);
    clip.enabled=false;
    $('clipEnabled').checked=false;
    if(clip.collection)clip.collection.enabled=false;
    $('focusAssetBtn').disabled=false;
    focusAsset();
    schedulePointCloudAutoApply();
  }catch(e){
    console.error(e);
    status('読込失敗。トークン、権限、Asset IDを確認してください。');
  }
}
function focusAsset(){
  if(!mainTileset){status('先にAssetを読み込んでください。');return;}
  try{
    viewer.camera.cancelFlight();
    mainTileset.show=true;
    $('assetVisible').checked=true;

    // フォーカス時は切断を一時解除し、モデル全体を確実に表示します。
    clip.enabled=false;
    $('clipEnabled').checked=false;
    if(clip.collection)clip.collection.enabled=false;

    // 点群や建物内部へ入り込まないよう、モデル半径の4倍から表示します。
    const sphere=mainTileset.boundingSphere;
    const radius=Math.max(Number(sphere.radius)||1.0,1.0);
    const offset=new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(35),
      Cesium.Math.toRadians(-28),
      radius*4.0
    );

    viewer.camera.viewBoundingSphere(sphere,offset);
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    viewer.scene.globe.depthTestAgainstTerrain=false;
    viewer.selectedEntity=undefined;
    viewer.scene.requestRender();
    status(($('displayMode').value==='local'?'ローカル空間':'地理空間')+'でモデル全体へフォーカスしました。');
  }catch(e){
    console.error('focusAsset error',e);
    status('フォーカスに失敗しました。開発者ツールのConsoleを確認してください。');
  }
}
function status(t){$('assetStatus').textContent=t}
function bind(){$('assetId').addEventListener('change',()=>{const id=String($('assetId').value||'').trim();if(/^\d+$/.test(id))localStorage.setItem('infra-last-main-asset-id',id)});$('loadAssetBtn').onclick=()=>loadAsset(Number($('assetId').value));$('addAssetBtn').onclick=addAdditionalAsset;$('additionalAssetId').addEventListener('keydown',e=>{if(e.key==='Enter')addAdditionalAsset();});renderAdditionalModels();const ax=JSON.parse(localStorage.getItem('infra-axis-settings')||'null');$('axisPreset').value=ax?.preset||'japan';$('rotX').value=ax?.rx||0;$('rotY').value=ax?.ry||0;$('rotZ').value=ax?.rz||0;$('applyAxisBtn').onclick=applyAxisSettings;$('japanDefaultBtn').onclick=()=>{$('axisPreset').value='enu';$('rotX').value=0;$('rotY').value=0;$('rotZ').value=0;applyAxisSettings();};$('levelPresetBtn').onclick=()=>{$('rotX').value=Number($('rotX').value)===-90?90:-90;$('rotY').value=0;$('rotZ').value=0;applyAxisSettings();};$('focusAssetBtn').onclick=focusAsset;$('displayMode').onchange=()=>{applyDisplayMode();if(mainTileset)loadAsset(Number($('assetId').value));reloadAdditionalModels();};$('assetVisible').onchange=e=>{if(mainTileset)mainTileset.show=e.target.checked};$('pinsVisible').onchange=updatePinVisibility;$('searchBox').oninput=renderList;$('addPinBtn').onclick=()=>{addingPin=true;$('addPinBtn').classList.add('hidden');$('cancelPinBtn').classList.remove('hidden');status('3D上の追加位置をクリックしてください。')};$('cancelPinBtn').onclick=stopAdd;$('detailForm').onsubmit=e=>{e.preventDefault();updateSelected()};$('deleteBtn').onclick=deleteSelected;$('csvBtn').onclick=exportCsv;$('viewpointRenameForm').onsubmit=e=>{e.preventDefault();applyViewpointRename();};$('viewpointRenameCancel').onclick=closeViewpointRenameDialog;$('viewpointRenameDialog').addEventListener('cancel',e=>{e.preventDefault();closeViewpointRenameDialog();});$('pdfAttachBtn').onclick=()=>{if(!selectedId){alert('先に点検情報を選択してください。');return;}$('pdfFileInput').click();};$('pdfFileInput').onchange=e=>{const f=e.target.files?.[0];if(f)attachSelectedPdf(f);e.target.value='';};$('pdfPreviewBtn').onclick=previewSelectedPdf;$('pdfRemoveBtn').onclick=removeSelectedPdf;$('pdfCloseBtn').onclick=closePdfPreview;$('pdfPreviewDialog').addEventListener('cancel',e=>{e.preventDefault();closePdfPreview();});$('pdfOpenExternalBtn').onclick=async()=>{if(!selectedId)return;const item=await pdfDbGet(selectedId);if(!item)return;const u=URL.createObjectURL(item.blob);window.open(u,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(u),60000);};$('csvImportBtn').onclick=()=>$('csvImportFile').click();$('csvImportFile').onchange=e=>{const f=e.target.files?.[0];if(f)importRecordsCsv(f);};$('bpoBtn').onclick=openBpo;$('registerTaskBtn').onclick=registerTask;$('clipEnabled').onchange=e=>{
  const active=e.target.checked;
  clip.enabled=active;
  clip.visible=active;
  if($('clipBoxVisible'))$('clipBoxVisible').checked=active;
  applyClip();
  updateClipEntities();
  updatePinVisibility();
  saveClip();
  status(active?'切断ボックスを有効にしました。':'切断ボックスを解除しました。');
};$('clipLabelsVisible').onchange=e=>{clip.labelsVisible=e.target.checked;updateClipEntities();saveClip()};$('clipPins').onchange=e=>{clip.hidePins=e.target.checked;updatePinVisibility();saveClip()};$('fitClipBtn').onclick=()=>{
  setupClipFromModel(true);
  clip.enabled=true;
  clip.visible=true;
  $('clipEnabled').checked=true;
  applyClip();
  updateClipEntities();
  saveClip();
  status('モデル全体に切断ボックスを合わせて有効化しました。');
};$('resetClipBtn').onclick=()=>{
  clip.enabled=false;
  clip.visible=false;
  $('clipEnabled').checked=false;
  if(clip.collection)clip.collection.enabled=false;
  updateClipEntities();
  updatePinVisibility();
  saveClip();
  status('切断ボックスをリセットしました。');
};
  const cube=$('revitViewCube');if(cube)cube.addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(!b)return;e.preventDefault();e.stopPropagation();focusViewPreset(b.dataset.view);});
  /* hex-view-click-binding */const hexNav=$('revitViewCube');if(hexNav)hexNav.addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(!b||typeof focusViewPreset!=='function')return;e.preventDefault();e.stopPropagation();focusViewPreset(b.dataset.view);});
  const h=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);h.setInputAction(c=>onDown(c.position),Cesium.ScreenSpaceEventType.LEFT_DOWN);h.setInputAction(m=>onMove(m.endPosition),Cesium.ScreenSpaceEventType.MOUSE_MOVE);h.setInputAction(()=>onUp(),Cesium.ScreenSpaceEventType.LEFT_UP);h.setInputAction(c=>{if(addingPin){addPinAt(c.position);return}const p=viewer.scene.pick(c.position);if(Cesium.defined(p)&&p.id?.__imageRecordId)return;if(Cesium.defined(p)&&p.id&&p.id.id&&!String(p.id.id).startsWith('clip-')){viewer.selectedEntity=undefined;selectRecord(p.id.id)}},Cesium.ScreenSpaceEventType.LEFT_CLICK)}
function setupClipFromModel(force=false){if(!mainTileset)return;const s=mainTileset.boundingSphere;clip.worldMatrix=Cesium.Transforms.eastNorthUpToFixedFrame(s.center);
clip.baseWorldMatrix=Cesium.Matrix4.clone(clip.worldMatrix,new Cesium.Matrix4());
const origin=mainTileset.clippingPlanesOriginMatrix||Cesium.Matrix4.IDENTITY;
const originInv=Cesium.Matrix4.inverse(origin,new Cesium.Matrix4());
clip.modelMatrix=Cesium.Matrix4.multiply(originInv,clip.worldMatrix,new Cesium.Matrix4());
clip.inverse=Cesium.Matrix4.inverse(clip.worldMatrix,new Cesium.Matrix4());const saved=!force&&JSON.parse(localStorage.getItem('infra-clip-'+$('assetId').value)||'null');clip.center=new Cesium.Cartesian3(...(saved?.center||[0,0,0]));const r=s.radius*1.15;clip.half=new Cesium.Cartesian3(...(saved?.half||[r,r,r]));clip.rotHeading=Number(saved?.rotHeading||0);clip.rotPitch=Number(saved?.rotPitch||0);clip.rotRoll=Number(saved?.rotRoll||0);if($('clipHeading'))$('clipHeading').value=clip.rotHeading;if($('clipPitch'))$('clipPitch').value=clip.rotPitch;if($('clipRoll'))$('clipRoll').value=clip.rotRoll;composeClipRotation();clip.enabled=false;clip.visible=clip.enabled;clip.labelsVisible=saved?.labelsVisible!==false;clip.hidePins=saved?.hidePins!==false;$('clipEnabled').checked=clip.enabled;clip.visible=clip.enabled;$('clipLabelsVisible').checked=clip.labelsVisible;$('clipPins').checked=clip.hidePins;createClipEntities();applyClip()}
function composeClipRotation(){
  if(!clip.baseWorldMatrix)return;
  const hpr=Cesium.HeadingPitchRoll.fromDegrees(clip.rotHeading,clip.rotPitch,clip.rotRoll);
  const q=Cesium.Quaternion.fromHeadingPitchRoll(hpr);
  const rot3=Cesium.Matrix3.fromQuaternion(q,new Cesium.Matrix3());
  const rot4=Cesium.Matrix4.fromRotationTranslation(rot3,Cesium.Cartesian3.ZERO,new Cesium.Matrix4());
  clip.worldMatrix=Cesium.Matrix4.multiply(clip.baseWorldMatrix,rot4,new Cesium.Matrix4());
  clip.inverse=Cesium.Matrix4.inverse(clip.worldMatrix,new Cesium.Matrix4());
  if(mainTileset){const origin=mainTileset.clippingPlanesOriginMatrix||Cesium.Matrix4.IDENTITY;const oi=Cesium.Matrix4.inverse(origin,new Cesium.Matrix4());clip.modelMatrix=Cesium.Matrix4.multiply(oi,clip.worldMatrix,new Cesium.Matrix4());}
}
function applyClipRotationFromUi(){
  clip.rotHeading=Number($('clipHeading').value)||0;clip.rotPitch=Number($('clipPitch').value)||0;clip.rotRoll=Number($('clipRoll').value)||0;
  composeClipRotation();
  if(clip.collection){clip.collection.modelMatrix=clip.modelMatrix;syncClipPlanes();}
  updateClipEntities();updatePinVisibility();saveClip();viewer.scene.requestRender();
}
function focusViewPreset(viewName){
  if(!mainTileset)return;
  const s=mainTileset.boundingSphere;
  const range=Math.max(s.radius*2.8,10);
  const frame=clip.worldMatrix||Cesium.Transforms.eastNorthUpToFixedFrame(s.center);
  const local={'iso-tl':new Cesium.Cartesian3(-1,-1,0.8),'iso-tr':new Cesium.Cartesian3(1,-1,0.8),front:new Cesium.Cartesian3(0,-1,0),back:new Cesium.Cartesian3(0,1,0),right:new Cesium.Cartesian3(1,0,0),left:new Cesium.Cartesian3(-1,0,0),top:new Cesium.Cartesian3(0,0,1),bottom:new Cesium.Cartesian3(0,0,-1),iso:new Cesium.Cartesian3(1,-1,0.8)}[viewName]||new Cesium.Cartesian3(1,-1,0.8);
  Cesium.Cartesian3.normalize(local,local);
  const worldDir=Cesium.Matrix4.multiplyByPointAsVector(frame,local,new Cesium.Cartesian3());Cesium.Cartesian3.normalize(worldDir,worldDir);
  const destination=Cesium.Cartesian3.add(s.center,Cesium.Cartesian3.multiplyByScalar(worldDir,range,new Cesium.Cartesian3()),new Cesium.Cartesian3());
  const direction=Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(s.center,destination,new Cesium.Cartesian3()),new Cesium.Cartesian3());
  let localUp=(viewName==='top'||viewName==='bottom')?new Cesium.Cartesian3(0,1,0):new Cesium.Cartesian3(0,0,1);
  let up=Cesium.Matrix4.multiplyByPointAsVector(frame,localUp,new Cesium.Cartesian3());Cesium.Cartesian3.normalize(up,up);
  viewer.camera.setView({destination,orientation:{direction,up}});
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);viewer.scene.requestRender();
  updateViewNavigator(viewName);
}
function updateViewNavigator(activeName){
  const labels={top:'上',bottom:'下',front:'前',right:'右',back:'後',left:'左',iso:'立体'};
  document.querySelectorAll('#revitViewCube [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===activeName));
  const t=$('viewDirectionText');if(t)t.textContent='現在：'+(labels[activeName]||'自由視点');
}
function planes(){const c=clip.center,h=clip.half;return [new Cesium.ClippingPlane(new Cesium.Cartesian3(1,0,0),-(c.x-h.x)),new Cesium.ClippingPlane(new Cesium.Cartesian3(-1,0,0),c.x+h.x),new Cesium.ClippingPlane(new Cesium.Cartesian3(0,1,0),-(c.y-h.y)),new Cesium.ClippingPlane(new Cesium.Cartesian3(0,-1,0),c.y+h.y),new Cesium.ClippingPlane(new Cesium.Cartesian3(0,0,1),-(c.z-h.z)),new Cesium.ClippingPlane(new Cesium.Cartesian3(0,0,-1),c.z+h.z)]}
function syncClipPlanes(){
  if(!clip.collection)return;
  const next=planes();
  for(let i=0;i<next.length;i++){
    const current=clip.collection.get(i);
    current.normal=Cesium.Cartesian3.clone(next[i].normal,current.normal);
    current.distance=next[i].distance;
  }
}
function applyClip(){
  if(!mainTileset)return;
  if(!clip.collection){
    clip.collection=new Cesium.ClippingPlaneCollection({
      planes:planes(),
      unionClippingRegions:true,
      modelMatrix:clip.modelMatrix,
      edgeColor:Cesium.Color.CYAN,
      edgeWidth:1,
      enabled:clip.enabled
    });
    mainTileset.clippingPlanes=clip.collection;
  }else{
    syncClipPlanes();
    clip.collection.modelMatrix=clip.modelMatrix;
    clip.collection.enabled=clip.enabled;
  }
  updateClipEntities();
  updatePinVisibility();
}
function localToWorld(v){return Cesium.Matrix4.multiplyByPoint(clip.worldMatrix,v,new Cesium.Cartesian3())}
function createClipEntities(){clip.entities.forEach(e=>viewer.entities.remove(e));clip.entities=[];const dirs=[['xp',1,0,0,Cesium.Color.RED],['xn',-1,0,0,Cesium.Color.RED],['yp',0,1,0,Cesium.Color.LIME],['yn',0,-1,0,Cesium.Color.LIME],['zp',0,0,1,Cesium.Color.DODGERBLUE],['zn',0,0,-1,Cesium.Color.DODGERBLUE]];dirs.forEach(([n,x,y,z,col])=>clip.entities.push(viewer.entities.add({id:'clip-'+n,position:new Cesium.CallbackProperty(()=>handlePos(n),false),point:{pixelSize:7,color:col,outlineColor:Cesium.Color.WHITE,outlineWidth:1,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:n.toUpperCase(),font:'10px sans-serif',fillColor:Cesium.Color.WHITE,showBackground:true,pixelOffset:new Cesium.Cartesian2(0,-18),disableDepthTestDistance:Number.POSITIVE_INFINITY},show:clip.visible})));clip.entities.push(viewer.entities.add({id:'clip-box',position:new Cesium.CallbackProperty(()=>localToWorld(clip.center),false),box:{dimensions:new Cesium.CallbackProperty(()=>Cesium.Cartesian3.multiplyByScalar(clip.half,2,new Cesium.Cartesian3()),false),material:Cesium.Color.CYAN.withAlpha(.04),outline:true,outlineColor:Cesium.Color.CYAN},orientation:new Cesium.CallbackProperty(()=>Cesium.Quaternion.fromRotationMatrix(Cesium.Matrix4.getMatrix3(clip.worldMatrix,new Cesium.Matrix3()),new Cesium.Quaternion()),false),show:clip.visible}));clip.entities.push(viewer.entities.add({id:'clip-rotate',position:new Cesium.CallbackProperty(()=>{const p=Cesium.Cartesian3.clone(clip.center);p.z+=clip.half.z*1.28;return localToWorld(p)},false),point:{pixelSize:13,color:Cesium.Color.ORANGE,outlineColor:Cesium.Color.WHITE,outlineWidth:2,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:'回転',font:'10px sans-serif',fillColor:Cesium.Color.WHITE,showBackground:true,pixelOffset:new Cesium.Cartesian2(0,-19),disableDepthTestDistance:Number.POSITIVE_INFINITY},show:clip.visible}));}
function handlePos(n){const c=Cesium.Cartesian3.clone(clip.center),h=clip.half;if(n==='xp')c.x+=h.x;if(n==='xn')c.x-=h.x;if(n==='yp')c.y+=h.y;if(n==='yn')c.y-=h.y;if(n==='zp')c.z+=h.z;if(n==='zn')c.z-=h.z;return localToWorld(c)}
function updateClipEntities(){clip.visible=!!clip.enabled;
  clip.entities.forEach(entity=>{
    entity.show=clip.visible;
    if(entity.label) entity.label.show=clip.visible&&clip.labelsVisible;
  });
  if(!clip.visible && viewer.selectedEntity && String(viewer.selectedEntity.id||'').startsWith('clip-')){
    viewer.selectedEntity=undefined;
  }
  viewer.scene.requestRender();
}
function onDown(pos){
  const picked=viewer.scene.pick(pos);
  const id=picked?.id?.id;
  if(!id||!String(id).startsWith('clip-'))return;
  if(id==='clip-box')return;
  if(id==='clip-rotate')clip.drag={name:'rotate-button',last:Cesium.Cartesian2.clone(pos)};
  else clip.drag={name:String(id).slice(5),last:Cesium.Cartesian2.clone(pos)};
  viewer.selectedEntity=undefined;
  viewer.scene.screenSpaceCameraController.enableInputs=false;
}
function onMove(pos){
  if(!clip.drag)return;
  const mouseDelta=new Cesium.Cartesian2();Cesium.Cartesian2.subtract(pos,clip.drag.last,mouseDelta);clip.drag.last=Cesium.Cartesian2.clone(pos);
  const name=clip.drag.name;
  if(name==='rotate-button'){
    clip.rotHeading=(clip.rotHeading||0)+mouseDelta.x*0.35;
    composeClipRotation();
    if(clip.collection){clip.collection.modelMatrix=clip.modelMatrix;syncClipPlanes();}
    updateClipEntities();updatePinVisibility();viewer.scene.requestRender();return;
  }
  const axis=name[0],faceSign=name[1]==='p'?1:-1;
  const centerWorld=localToWorld(clip.center),handleWorld=handlePos(name);
  const cs=Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene,centerWorld),hs=Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene,handleWorld);if(!Cesium.defined(cs)||!Cesium.defined(hs))return;
  const out=new Cesium.Cartesian2();Cesium.Cartesian2.subtract(hs,cs,out);const len=Cesium.Cartesian2.magnitude(out);if(len<1)return;Cesium.Cartesian2.divideByScalar(out,len,out);
  const projected=Cesium.Cartesian2.dot(mouseDelta,out);const ref=Math.max(clip.half.x,clip.half.y,clip.half.z,1),faceDelta=projected*(ref/250),halfDelta=faceDelta/2,minHalf=Math.max(ref*.002,.05);
  let actualHalfDelta=halfDelta;
  if(axis==='x'){const nh=Math.max(minHalf,clip.half.x+halfDelta);actualHalfDelta=nh-clip.half.x;clip.half.x=nh;clip.center.x+=faceSign*actualHalfDelta;}
  if(axis==='y'){const nh=Math.max(minHalf,clip.half.y+halfDelta);actualHalfDelta=nh-clip.half.y;clip.half.y=nh;clip.center.y+=faceSign*actualHalfDelta;}
  if(axis==='z'){const nh=Math.max(minHalf,clip.half.z+halfDelta);actualHalfDelta=nh-clip.half.z;clip.half.z=nh;clip.center.z+=faceSign*actualHalfDelta;}
  applyClip();
}
function onUp(){if(!clip.drag)return;if(clip.drag.name==='rotate-button')saveClip();clip.drag=null;viewer.scene.screenSpaceCameraController.enableInputs=true;saveClip()}
function saveClip(){if(!clip.center||!clip.half)return;localStorage.setItem('infra-clip-'+$('assetId').value,JSON.stringify({center:[clip.center.x,clip.center.y,clip.center.z],half:[clip.half.x,clip.half.y,clip.half.z],enabled:clip.enabled,visible:clip.enabled,labelsVisible:clip.labelsVisible,hidePins:clip.hidePins,rotHeading:clip.rotHeading,rotPitch:clip.rotPitch,rotRoll:clip.rotRoll}))}
function clearClip(){if(clip.collection)clip.collection.enabled=false;clip.collection=null;clip.entities.forEach(e=>viewer?.entities.remove(e));clip.entities=[]}
function inBox(r){if(!clip.enabled||!clip.inverse)return true;const w=Cesium.Cartesian3.fromDegrees(r.lon,r.lat,r.height||0),l=Cesium.Matrix4.multiplyByPoint(clip.inverse,w,new Cesium.Cartesian3()),c=clip.center,h=clip.half;return Math.abs(l.x-c.x)<=h.x&&Math.abs(l.y-c.y)<=h.y&&Math.abs(l.z-c.z)<=h.z}
function updatePinVisibility(){records.forEach(r=>{const e=viewer.entities.getById(r.id);if(e)e.show=$('pinsVisible').checked&&(!clip.hidePins||inBox(r))})}
function stopAdd(){addingPin=false;$('addPinBtn').classList.remove('hidden');$('cancelPinBtn').classList.add('hidden')}function addPinAt(p){const w=viewer.scene.pickPosition(p)||viewer.camera.pickEllipsoid(p,viewer.scene.globe.ellipsoid);if(!w)return;const c=Cesium.Cartographic.fromCartesian(w);let n=1;while(records.some(r=>r.id===`D-${String(n).padStart(3,'0')}`))n++;const r={id:`D-${String(n).padStart(3,'0')}`,facilityId:'',facilityName:'',memberName:'',defectType:'ひび割れ',severity:'経過観察',inspectionDate:new Date().toISOString().slice(0,10),workStatus:'未着手',note:'',referenceUrl:'',lon:Cesium.Math.toDegrees(c.longitude),lat:Cesium.Math.toDegrees(c.latitude),height:c.height};records.push(r);saveRecords();renderRecords();/* bi-auto-refresh-after-csv */refreshBiDashboardAutomatically();selectRecord(r.id);stopAdd()}
function renderRecords(){records.forEach(r=>{const o=viewer.entities.getById(r.id);if(o)viewer.entities.remove(o);viewer.entities.add({id:r.id,position:Cesium.Cartesian3.fromDegrees(r.lon,r.lat,r.height||0),billboard:{image:pinSvg(COLORS[r.severity]||'#eab308'),width:22,height:30,verticalOrigin:Cesium.VerticalOrigin.BOTTOM,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:r.id,font:'10px sans-serif',fillColor:Cesium.Color.WHITE,showBackground:true,backgroundColor:Cesium.Color.fromCssColorString('#0b2438').withAlpha(.68),pixelOffset:new Cesium.Cartesian2(0,-34),disableDepthTestDistance:Number.POSITIVE_INFINITY}})});renderList();updatePinVisibility()}
function pinSvg(c){return'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52"><path fill="${c}" stroke="white" stroke-width="2" d="M20 1C9.5 1 1 9.5 1 20c0 14 19 31 19 31s19-17 19-31C39 9.5 30.5 1 20 1z"/><circle cx="20" cy="20" r="7" fill="white"/></svg>`)}
function renderListBase(){const q=$('searchBox').value.toLowerCase(),list=records.filter(r=>Object.values(r).join(' ').toLowerCase().includes(q));$('resultList').innerHTML='';list.forEach(r=>{const d=document.createElement('div');d.className='result-item'+(r.id===selectedId?' active':'');d.innerHTML=`<b>${esc(r.id)}｜${esc(r.defectType)}</b><small>${esc(r.facilityId)} ${esc(r.memberName)}｜${esc(r.workStatus)}</small>`;d.onclick=()=>{selectRecord(r.id);viewer.flyTo(viewer.entities.getById(r.id))};$('resultList').appendChild(d)})}
function safeHttpUrl(value){
  try{const u=new URL(String(value||'').trim());return (u.protocol==='https:'||u.protocol==='http:')?u.href:'';}catch(_){return '';}
}
function enhanceSavedUrlLinks(){
  document.querySelectorAll('#resultList .result-item').forEach(item=>{
    const firstLine=(item.querySelector('b')?.textContent||item.textContent||'').trim();
    const id=firstLine.split('｜')[0].split('|')[0].trim();
    const record=records.find(r=>String(r.id)===id);
    const href=safeHttpUrl(record?.referenceUrl);
    if(!href)return;
    const link=document.createElement('a');
    link.className='saved-record-link';
    link.href=href;
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.title=record.referenceUrl;
    link.innerHTML='<span class="saved-link-icon">↗</span><span class="saved-link-text">関連資料・台帳を開く</span>';
    link.addEventListener('click',e=>e.stopPropagation());
    item.appendChild(link);
  });
}
function renderList(){
  renderListBase();
  enhanceSavedUrlLinks();
enhancePdfListBadges();}
function selectRecord(id){restoreInspectionRightPanel();viewer.selectedEntity=undefined;viewer.trackedEntity=undefined;selectedId=id;const r=records.find(x=>x.id===id);if(!r)return;$('detailEmpty').classList.add('hidden');$('detailForm').classList.remove('hidden');$('defectId').value=r.id||'';['facilityId','facilityName','memberName','defectType','severity','inspectionDate','workStatus','note','referenceUrl'].forEach(k=>$(k).value=r[k]||'');renderList()}
function updateSelected(){const r=records.find(x=>x.id===selectedId);if(!r)return;const nid=$('defectId').value.trim();if(!nid){alert('損傷IDを入力してください。');return}if(records.some(x=>x.id===nid&&x!==r)){alert('同じ損傷IDがあります。');return}const old=r.id;['facilityId','facilityName','memberName','defectType','severity','inspectionDate','workStatus','note','referenceUrl'].forEach(k=>r[k]=$(k).value);r.id=nid;if(old!==nid){viewer.entities.removeById(old);selectedId=nid}saveRecords();renderRecords();selectRecord(nid);refreshBiDashboardAutomatically();status('点検情報を保存しました。')}
function deleteSelected(){if(!selectedId||!confirm('削除しますか？'))return;records=records.filter(r=>r.id!==selectedId);viewer.entities.removeById(selectedId);selectedId=null;saveRecords();$('detailForm').classList.add('hidden');$('detailEmpty').classList.remove('hidden');renderList();refreshBiDashboardAutomatically()}function openBpo(){const r=records.find(x=>x.id===selectedId);$('bpoTarget').textContent=r?`対象：${r.id} / ${r.facilityName} / ${r.memberName}`:'先に損傷ピンを選択してください。';$('bpoDialog').showModal()}function registerTask(e){const r=records.find(x=>x.id===selectedId);if(!r){e.preventDefault();alert('損傷ピンを選択してください。');return}r.task={type:$('taskType').value,due:$('taskDue').value,priority:$('taskPriority').value,memo:$('taskMemo').value};r.workStatus='BPO処理中';saveRecords();renderRecords();selectRecord(r.id)}function exportCsvLegacy(){const h=['損傷ID','施設ID','施設名','部材名','損傷種別','重要度','点検日','ステータス','所見','参照URL','BPO依頼'],rows=records.map(r=>[r.id,r.facilityId,r.facilityName,r.memberName,r.defectType,r.severity,r.inspectionDate,r.workStatus,r.note,r.referenceUrl,r.task?JSON.stringify(r.task):'']),csv=[h,...rows].map(row=>row.map(v=>`"${String(v||'').replaceAll('"','""')}"`).join(',')).join('\r\n'),b=new Blob(['\ufeff'+csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='infrastructure_bpo_records.csv';a.click();URL.revokeObjectURL(a.href)}function csvEscape(value){return '"'+String(value??'').replaceAll('"','""')+'"';}
function exportCsv(){
  const headers=['損傷ID','施設ID','施設名','部材名','損傷種別','重要度','点検日','ステータス','所見','参照URL','経度','緯度','高さ','BPO依頼','PDFファイル名'];
  const rows=records.map(r=>[r.id,r.facilityId,r.facilityName,r.memberName,r.defectType,r.severity,r.inspectionDate,r.workStatus,r.note,r.referenceUrl,r.lon,r.lat,r.height,r.task?JSON.stringify(r.task):'',r.pdfName||'']);
  const csv=[headers,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='infrastructure_bpo_id_linked.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);
  status('損傷ID紐づけCSVを書き出しました。');
}
function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(quoted){if(c==='"'&&n==='"'){field+='"';i++;}else if(c==='"'){quoted=false;}else field+=c;}
    else if(c==='"')quoted=true;
    else if(c===','){row.push(field);field='';}
    else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  return rows;
}
function importRecordsCsv(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const rows=parseCsv(String(reader.result||'').replace(/^\ufeff/,''));
      if(rows.length<2)throw new Error('CSVにデータ行がありません。');
      const headers=rows[0].map(v=>v.trim());
      const col=name=>headers.indexOf(name);
      if(col('損傷ID')<0)throw new Error('「損傷ID」列が必要です。');
      const get=(row,name)=>{const i=col(name);return i>=0?String(row[i]??'').trim():'';};
      let updated=0,added=0,skipped=0;
      for(const row of rows.slice(1)){
        const id=get(row,'損傷ID');if(!id){skipped++;continue;}
        let rec=records.find(r=>String(r.id)===id);
        const isNew=!rec;
        if(isNew){
          const lon=Number(get(row,'経度')),lat=Number(get(row,'緯度')),height=Number(get(row,'高さ')||0);
          if(!Number.isFinite(lon)||!Number.isFinite(lat)){skipped++;continue;}
          rec={id,lon,lat,height:Number.isFinite(height)?height:0};records.push(rec);added++;
        }else updated++;
        const map={facilityId:'施設ID',facilityName:'施設名',memberName:'部材名',defectType:'損傷種別',severity:'重要度',inspectionDate:'点検日',workStatus:'ステータス',note:'所見',referenceUrl:'参照URL'};
        for(const [key,label] of Object.entries(map)){if(col(label)>=0)rec[key]=get(row,label);}
        for(const [key,label] of [['lon','経度'],['lat','緯度'],['height','高さ']]){if(col(label)>=0&&get(row,label)!==''){const n=Number(get(row,label));if(Number.isFinite(n))rec[key]=n;}}
        if(col('BPO依頼')>=0&&get(row,'BPO依頼')){try{rec.task=JSON.parse(get(row,'BPO依頼'));}catch(_){}}
      }
      saveRecords();renderRecords();
      if(selectedId&&records.some(r=>r.id===selectedId))selectRecord(selectedId);
      status('CSV読込完了：更新 '+updated+'件、新規 '+added+'件、スキップ '+skipped+'件');
      alert('CSV読込完了\n更新：'+updated+'件\n新規：'+added+'件\nスキップ：'+skipped+'件');
    }catch(e){console.error(e);alert('CSV読込に失敗しました。\n'+e.message);}
    finally{$('csvImportFile').value='';}
  };
  reader.readAsText(file,'UTF-8');
}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

/* POINTCLOUD_HEIGHT_INTEGRATED_BEGIN */
const POINT_CLOUD_HEIGHT_OFFSET_KEY='infra-point-cloud-height-offset-by-asset-v2';
const pointCloudHeightBaseMatrices=new Map();
function loadPointCloudHeightOffsets(){try{return JSON.parse(localStorage.getItem(POINT_CLOUD_HEIGHT_OFFSET_KEY)||'{}')}catch(_){return {}}}
function savePointCloudHeightOffsets(data){localStorage.setItem(POINT_CLOUD_HEIGHT_OFFSET_KEY,JSON.stringify(data))}
function findLoadedTilesetByAssetId(assetId){
  const id=String(assetId||'').trim();
  if(!id)return null;
  if(String($('assetId')?.value||'').trim()===id&&mainTileset)return mainTileset;
  return additionalTilesets.get(id)||null;
}
function rememberPointCloudHeightBase(assetId,tileset){
  const id=String(assetId||'').trim();
  if(!id||!tileset)return;
  pointCloudHeightBaseMatrices.set(id,Cesium.Matrix4.clone(tileset.modelMatrix||Cesium.Matrix4.IDENTITY,new Cesium.Matrix4()));
}
function pointCloudHeightShiftMatrix(tileset,meters){
  const center=tileset.boundingSphere?.center;
  if(!center)return Cesium.Matrix4.clone(Cesium.Matrix4.IDENTITY,new Cesium.Matrix4());
  const carto=Cesium.Cartographic.fromCartesian(center);
  const surface=Cesium.Cartesian3.fromRadians(carto.longitude,carto.latitude,0);
  const elevated=Cesium.Cartesian3.fromRadians(carto.longitude,carto.latitude,Number(meters)||0);
  const translation=Cesium.Cartesian3.subtract(elevated,surface,new Cesium.Cartesian3());
  return Cesium.Matrix4.fromTranslation(translation,new Cesium.Matrix4());
}
function applyPointCloudHeightOffset(assetId,meters,showMessage=true){
  const id=String(assetId||'').trim(),tileset=findLoadedTilesetByAssetId(id);
  if(!tileset){if(showMessage)status('Asset '+id+' は未読込です。モデルタブで読込してください。');return false;}
  if(!pointCloudHeightBaseMatrices.has(id))rememberPointCloudHeightBase(id,tileset);
  const base=pointCloudHeightBaseMatrices.get(id);
  const shift=pointCloudHeightShiftMatrix(tileset,meters);
  tileset.modelMatrix=Cesium.Matrix4.multiply(shift,base,new Cesium.Matrix4());
  viewer.scene.requestRender();
  if(showMessage)status('Asset '+id+' の高さを '+Number(meters).toFixed(1)+'m 補正しました。');
  return true;
}
function applySavedPointCloudHeightOffset(assetId,tileset){
  const id=String(assetId||'').trim();
  rememberPointCloudHeightBase(id,tileset);
  const offsets=loadPointCloudHeightOffsets();
  if(Object.prototype.hasOwnProperty.call(offsets,id))applyPointCloudHeightOffset(id,Number(offsets[id])||0,false);
}
function renderPointCloudHeightRows(){
  const list=$('pointCloudHeightOffsetList');if(!list)return;
  const offsets=loadPointCloudHeightOffsets();
  // Only show Asset IDs explicitly added to the height-offset settings.
  // Loaded main/additional models are not added automatically.
  const ids=new Set(Object.keys(offsets));
  list.innerHTML='';
  if(!ids.size){
    list.innerHTML='<p class="point-cloud-height-empty">登録済みの高さ補正はありません。「点群IDを追加」から登録してください。</p>';
    return;
  }
  [...ids].filter(Boolean).forEach(id=>{
    const row=document.createElement('div');row.className='point-cloud-height-row';row.dataset.assetId=id;
    row.innerHTML='<label>Asset ID<input class="point-cloud-height-id" type="text" value="'+esc(id)+'"></label><label>高さ補正（m）<input class="point-cloud-height-value" type="number" step="0.1" value="'+Number(offsets[id]??0)+'"></label><button type="button" class="point-cloud-height-apply">反映</button><button type="button" class="point-cloud-height-reset">0m</button><button type="button" class="point-cloud-height-delete">削除</button>';
    row.querySelector('.point-cloud-height-apply').onclick=()=>applyPointCloudHeightRow(row);
    row.querySelector('.point-cloud-height-reset').onclick=()=>{row.querySelector('.point-cloud-height-value').value='0';applyPointCloudHeightRow(row)};
    row.querySelector('.point-cloud-height-delete').onclick=()=>{
      const id=row.dataset.assetId;
      // Return the loaded tileset to its original height before removing the setting.
      applyPointCloudHeightOffset(id,0,false);
      const data=loadPointCloudHeightOffsets();
      delete data[id];
      savePointCloudHeightOffsets(data);
      pointCloudHeightBaseMatrices.delete(id);
      renderPointCloudHeightRows();
      status('Asset '+id+' の高さ補正設定を削除しました。');
    };
    list.appendChild(row);
  });
}
function applyPointCloudHeightRow(row){
  const oldId=row.dataset.assetId;
  const id=String(row.querySelector('.point-cloud-height-id').value||'').trim();
  const meters=Number(row.querySelector('.point-cloud-height-value').value)||0;
  const data=loadPointCloudHeightOffsets();if(oldId&&oldId!==id)delete data[oldId];if(id)data[id]=meters;savePointCloudHeightOffsets(data);row.dataset.assetId=id;
  applyPointCloudHeightOffset(id,meters,true);
}
function setupPointCloudHeightOffset(){
  const host=$('pointCloudColorPanel')||$('pointCloudPerformanceCard')?.parentElement||$('pointSizeOnlyPanel');
  if(!host||$('pointCloudHeightOffsetPanel'))return;
  const panel=document.createElement('div');panel.id='pointCloudHeightOffsetPanel';panel.className='point-cloud-height-panel';panel.dataset.featureTab='pointcloud';
  panel.innerHTML='<h3>点群高さ補正（Asset別）</h3><p>正の値で上、負の値で下へ移動します。</p><div id="pointCloudHeightOffsetList"></div><div class="point-cloud-height-add-row"><input id="pointCloudHeightNewAssetId" type="text" inputmode="numeric" placeholder="追加する点群Asset ID"><button id="pointCloudHeightOffsetAdd" type="button">点群IDを追加</button></div><button id="pointCloudHeightOffsetApplyAll" type="button" class="full">高さ補正をすべて反映</button>';
  host.appendChild(panel);
  const addHeightAsset=()=>{
    const input=$('pointCloudHeightNewAssetId');
    const id=String(input?.value||'').trim();
    if(!/^\d+$/.test(id)){status('点群Asset IDを数字で入力してください。');input?.focus();return;}
    const data=loadPointCloudHeightOffsets();
    if(data[id]===undefined)data[id]=0;
    savePointCloudHeightOffsets(data);
    input.value='';
    renderPointCloudHeightRows();
    status('Asset '+id+' を高さ補正一覧へ追加しました。');
  };
  $('pointCloudHeightOffsetAdd').onclick=addHeightAsset;
  $('pointCloudHeightNewAssetId').addEventListener('keydown',event=>{if(event.key==='Enter')addHeightAsset()});
  $('pointCloudHeightOffsetApplyAll').onclick=()=>document.querySelectorAll('.point-cloud-height-row').forEach(applyPointCloudHeightRow);
  renderPointCloudHeightRows();
}
/* POINTCLOUD_HEIGHT_INTEGRATED_END */

init().catch(e=>{console.error(e);alert('起動に失敗しました。')});
})();


/* PDF_PER_INSPECTION_BEGIN */
(()=>{
  'use strict';
  const DB='cesiumInspectionPdfDb', STORE='pdfByDamageId';
  let objectUrl='';
  const txt=e=>(e?.textContent||'').trim();
  const buttons=()=>[...document.querySelectorAll('button')];
  const button=n=>buttons().find(b=>txt(b)===n);
  const fileInput=()=>[...document.querySelectorAll('input[type=file]')].find(i=>(i.accept||'').toLowerCase().includes('pdf'));

  function selectedId(){
    const active=[...document.querySelectorAll('[aria-selected=true],.selected,.active')]
      .filter(e=>/D-[0-9A-Za-z_-]+/.test(txt(e)))
      .sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left)[0];
    const m=active&&txt(active).match(/D-[0-9A-Za-z_-]+/); if(m)return m[0];
    const labels=[...document.querySelectorAll('label')];
    const lab=labels.find(l=>txt(l).includes('損傷ID'));
    const input=lab&&(lab.htmlFor?document.getElementById(lab.htmlFor):lab.parentElement?.querySelector('input'));
    if(input?.value?.trim())return input.value.trim();
    return '';
  }
  function openDb(){return new Promise((ok,ng)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE,{keyPath:'damageId'});};q.onsuccess=()=>ok(q.result);q.onerror=()=>ng(q.error);});}
  async function get(id){if(!id)return null;const db=await openDb();return new Promise((ok,ng)=>{const q=db.transaction(STORE).objectStore(STORE).get(id);q.onsuccess=()=>ok(q.result||null);q.onerror=()=>ng(q.error);});}
  async function put(v){const db=await openDb();return new Promise((ok,ng)=>{const q=db.transaction(STORE,'readwrite').objectStore(STORE).put(v);q.onsuccess=()=>ok();q.onerror=()=>ng(q.error);});}
  async function del(id){const db=await openDb();return new Promise((ok,ng)=>{const q=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);q.onsuccess=()=>ok();q.onerror=()=>ng(q.error);});}
  async function all(){const db=await openDb();return new Promise((ok,ng)=>{const q=db.transaction(STORE).objectStore(STORE).getAll();q.onsuccess=()=>ok(q.result||[]);q.onerror=()=>ng(q.error);});}

  function hideSaveButton(){
    buttons().filter(b=>txt(b)==='保存').forEach(b=>{b.style.display='none';b.setAttribute('aria-hidden','true');});
  }
  function statusNode(){
    const load=button('PDF読込');if(!load)return null;
    const section=load.closest('div')?.parentElement;
    return [...(section?.querySelectorAll('div,span,p')||[])].find(e=>/PDF登録済み|PDF未登録/.test(txt(e)))||null;
  }
  function cardForId(id){
    const candidates=[...document.querySelectorAll('div,li,article')].filter(e=>{
      const t=txt(e);return t.includes(id)&&e.getBoundingClientRect().left<420&&e.getBoundingClientRect().width>180;
    });
    candidates.sort((a,b)=>a.getBoundingClientRect().height-b.getBoundingClientRect().height);
    return candidates.find(e=>e.getBoundingClientRect().height>=45&&e.getBoundingClientRect().height<=180)||null;
  }
  async function renderBadges(){
    document.querySelectorAll('[data-pdf-record-badge]').forEach(e=>e.remove());
    const rows=await all();
    for(const row of rows){
      const card=cardForId(row.damageId);if(!card)continue;
      const heading=[...card.querySelectorAll('strong,b,div,span')].find(e=>txt(e).includes(row.damageId));
      if(!heading)continue;
      const badge=document.createElement('span');
      badge.dataset.pdfRecordBadge='1';badge.textContent='PDF';
      Object.assign(badge.style,{display:'inline-flex',marginLeft:'8px',padding:'2px 7px',borderRadius:'4px',fontSize:'11px',fontWeight:'700',lineHeight:'1.3',color:'#fff',background:'#a64b56',verticalAlign:'middle'});
      heading.appendChild(badge);
    }
  }
  async function refresh(){
    hideSaveButton();
    const id=selectedId(),rec=await get(id),st=statusNode();
    if(st)st.textContent=rec?'PDF登録済み：'+rec.name+' ('+(rec.size/1024).toFixed(1)+' KB)':'PDF未登録';
    const prev=button('プレビュー'),rem=button('解除');if(prev)prev.disabled=!rec;if(rem)rem.disabled=!rec;
    await renderBadges();
  }

  document.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    const n=txt(b);
    if(!['PDF読込','プレビュー','解除'].includes(n)){setTimeout(refresh,30);return;}
    e.preventDefault();e.stopImmediatePropagation();
    const id=selectedId();if(!id){alert('先に点検・損傷情報を選択してください。');return;}
    if(n==='PDF読込'){const i=fileInput();if(i){i.value='';i.click();}}
    if(n==='プレビュー'){
      const r=await get(id);if(!r){alert('この点検にはPDFが登録されていません。');return;}
      if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(r.blob);window.open(objectUrl,'_blank','noopener');
    }
    if(n==='解除'){await del(id);await refresh();}
  },true);
  document.addEventListener('change',async e=>{
    const i=e.target;if(i!==fileInput())return;
    e.stopImmediatePropagation();
    const f=i.files?.[0],id=selectedId();if(!f||!id)return;
    if(f.type!=='application/pdf'&&!f.name.toLowerCase().endsWith('.pdf')){alert('PDFファイルを選択してください。');return;}
    await put({damageId:id,name:f.name,size:f.size,type:f.type||'application/pdf',blob:f,updatedAt:new Date().toISOString()});
    await refresh();
  },true);
  let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refresh,100);}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-selected']});
  window.addEventListener('DOMContentLoaded',refresh);setTimeout(refresh,600);
})();
/* PDF_PER_INSPECTION_END */


