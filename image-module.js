(() => {
  'use strict';
  const DB='infra-viewer-images-v1', STORE='images';
  let viewer=null, records=[], entities=new Map(), selected=null, yaw=50;
  const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function db(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
  async function all(){const d=await db();return new Promise((ok,no)=>{const r=d.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>no(r.error)})}
  async function put(v){const d=await db();return new Promise((ok,no)=>{const r=d.transaction(STORE,'readwrite').objectStore(STORE).put(v);r.onsuccess=ok;r.onerror=()=>no(r.error)})}
  async function del(id){const d=await db();return new Promise((ok,no)=>{const r=d.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=ok;r.onerror=()=>no(r.error)})}
  const blobUrl=r=>URL.createObjectURL(r.file);
  function makeUi(){
    if($('imageFeaturePanel'))return;
    const host=document.createElement('div'); host.innerHTML=`
      <section id="imageFeaturePanel" class="image-feature-panel hidden">
       <div class="image-panel-head"><b>画像</b><button id="imagePanelClose">×</button></div>
       <div class="image-scroll">
        <label>画像種別<select id="imageKind"><option value="panorama">全天球画像</option><option value="normal">通常画像</option></select></label>
        <label>画像名<input id="imageName" placeholder="例：橋脚P3 現況"></label>
        <label>撮影日時<input id="imageDate" type="datetime-local"></label>
        <div class="image-grid"><label>緯度<input id="imageLat" type="number" step="0.0000001"></label><label>経度<input id="imageLon" type="number" step="0.0000001"></label></div>
        <div class="image-grid"><label>標高（m）<input id="imageHeight" type="number" step="0.1" value="0"></label><label>方位角（°）<input id="imageHeading" type="number" step="0.1" value="0"></label></div>
        <label>画像ファイル<input id="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <button id="imageUseCamera" class="image-primary">現在のカメラ位置を取得</button>
        <button id="imageRegister" class="image-primary">画像を登録</button>
        <div class="image-note">全天球画像は横：縦が2：1の画像を推奨します。</div>
        <h3>登録画像</h3><div id="imageRecordList"></div>
       </div>
      </section>
      <section id="imageInfoPanel" class="image-info-panel hidden"><div id="imageInfoBody"></div></section>
      <section id="imageViewerOverlay" class="image-viewer-overlay hidden"><div class="image-viewer-top"><b id="imageViewerTitle">画像</b><button id="imageViewerClose">3Dへ戻る</button></div><div id="imageViewerStage" class="image-viewer-stage"></div></section>
      <section id="imageComparePanel" class="image-compare-panel hidden"><div class="image-viewer-top"><b>3Dと画像を比較</b><button id="imageCompareClose">比較終了</button></div><div id="imageCompareStage" class="image-viewer-stage"></div></section>`;
    document.body.appendChild(host);
    const tabs=[...document.querySelectorAll('button')].filter(b=>['BI','時系列'].includes(b.textContent.trim()));
    const anchor=tabs.find(b=>b.textContent.trim()==='BI')||tabs[0];
    if(anchor){const btn=anchor.cloneNode(true);btn.id='imageFeatureTab';btn.textContent='画像';btn.removeAttribute('data-tab');btn.onclick=()=>$('imageFeaturePanel').classList.toggle('hidden');anchor.parentNode.insertBefore(btn,anchor)}
    else {const btn=document.createElement('button');btn.id='imageFeatureTab';btn.className='image-floating-tab';btn.textContent='画像';btn.onclick=()=>$('imageFeaturePanel').classList.toggle('hidden');document.body.appendChild(btn)}
    $('imagePanelClose').onclick=()=>$('imageFeaturePanel').classList.add('hidden');
    $('imageViewerClose').onclick=closeViewer;$('imageCompareClose').onclick=closeCompare;
    $('imageUseCamera').onclick=useCamera;$('imageRegister').onclick=register;
  }
  function useCamera(){if(!viewer)return alert('3Dビューアーの準備中です。');const c=Cesium.Cartographic.fromCartesian(viewer.camera.positionWC);$('imageLat').value=Cesium.Math.toDegrees(c.latitude).toFixed(7);$('imageLon').value=Cesium.Math.toDegrees(c.longitude).toFixed(7);$('imageHeight').value=c.height.toFixed(2);$('imageHeading').value=Cesium.Math.toDegrees(viewer.camera.heading).toFixed(1)}
  async function register(){const file=$('imageFile').files[0],lat=+$('imageLat').value,lon=+$('imageLon').value;if(!file||!Number.isFinite(lat)||!Number.isFinite(lon))return alert('画像ファイル、緯度、経度を入力してください。');const rec={id:'IMG-'+Date.now(),kind:$('imageKind').value,name:$('imageName').value.trim()||file.name,date:$('imageDate').value,lat,lon,height:+$('imageHeight').value||0,heading:+$('imageHeading').value||0,file,fileName:file.name,createdAt:Date.now()};await put(rec);records.push(rec);addPin(rec);renderList();$('imageFile').value='';alert('画像を登録しました。')}
  function addPin(r){if(!viewer||entities.has(r.id))return;const e=viewer.entities.add({id:'image:'+r.id,position:Cesium.Cartesian3.fromDegrees(r.lon,r.lat,r.height),point:{pixelSize:14,color:Cesium.Color.DEEPSKYBLUE,outlineColor:Cesium.Color.WHITE,outlineWidth:3,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:'📷 '+r.name,font:'13px sans-serif',fillColor:Cesium.Color.WHITE,showBackground:true,backgroundColor:Cesium.Color.fromCssColorString('#0b2633').withAlpha(.85),pixelOffset:new Cesium.Cartesian2(0,-24),disableDepthTestDistance:Number.POSITIVE_INFINITY}});e.__imageRecordId=r.id;entities.set(r.id,e)}
  function renderList(){const el=$('imageRecordList');if(!el)return;el.innerHTML=records.length?records.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(r=>`<div class="image-card"><b>${esc(r.name)}</b><small>${esc(r.kind==='panorama'?'全天球画像':'通常画像')} ${esc(r.date||'')}</small><div><button data-go="${r.id}">位置</button><button data-open="${r.id}">開く</button><button data-compare="${r.id}">比較</button><button data-delete="${r.id}">削除</button></div></div>`).join(''):'<div class="image-empty">登録画像はありません。</div>';el.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>focus(b.dataset.go));el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openImage(b.dataset.open,false));el.querySelectorAll('[data-compare]').forEach(b=>b.onclick=()=>openImage(b.dataset.compare,true));el.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.delete))}
  function focus(id){const r=records.find(x=>x.id===id);if(r)viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(r.lon,r.lat,r.height+25),orientation:{heading:Cesium.Math.toRadians(r.heading),pitch:Cesium.Math.toRadians(-25),roll:0}})}
  async function remove(id){if(!confirm('この画像を削除しますか？'))return;await del(id);records=records.filter(x=>x.id!==id);const e=entities.get(id);if(e)viewer.entities.remove(e);entities.delete(id);renderList();$('imageInfoPanel').classList.add('hidden')}
  function stageImage(stage,r){const url=blobUrl(r);stage.innerHTML='';if(r.kind==='panorama'){stage.className='image-viewer-stage panorama';stage.style.backgroundImage=`url("${url}")`;stage.style.backgroundPosition=`${yaw}% 50%`;let down=false,last=0;stage.onpointerdown=e=>{down=true;last=e.clientX;stage.setPointerCapture(e.pointerId)};stage.onpointermove=e=>{if(!down)return;yaw=Math.max(0,Math.min(100,yaw-(e.clientX-last)/6));last=e.clientX;stage.style.backgroundPosition=`${yaw}% 50%`};stage.onpointerup=()=>down=false}else{stage.className='image-viewer-stage';const img=new Image();img.src=url;stage.appendChild(img)}}
  function openImage(id,compare){const r=records.find(x=>x.id===id);if(!r)return;selected=r;if(compare){$('imageComparePanel').classList.remove('hidden');stageImage($('imageCompareStage'),r)}else{$('imageViewerOverlay').classList.remove('hidden');$('imageViewerTitle').textContent=r.name;stageImage($('imageViewerStage'),r)}}
  function closeViewer(){$('imageViewerOverlay').classList.add('hidden')}
  function closeCompare(){$('imageComparePanel').classList.add('hidden')}
  function showInfo(r){const p=$('imageInfoPanel');p.classList.remove('hidden');$('imageInfoBody').innerHTML=`<h2>画像情報</h2><img src="${blobUrl(r)}"><dl><dt>画像名</dt><dd>${esc(r.name)}</dd><dt>種類</dt><dd>${r.kind==='panorama'?'全天球画像':'通常画像'}</dd><dt>撮影日時</dt><dd>${esc(r.date||'－')}</dd><dt>位置</dt><dd>${r.lat.toFixed(7)}, ${r.lon.toFixed(7)}, ${r.height.toFixed(2)}m</dd><dt>方位角</dt><dd>${r.heading}°</dd></dl><button id="imgInfoFocus">撮影位置へ移動</button><button id="imgInfoOpen">画像を開く</button><button id="imgInfoCompare">3Dと比較</button>`;$('imgInfoFocus').onclick=()=>focus(r.id);$('imgInfoOpen').onclick=()=>openImage(r.id,false);$('imgInfoCompare').onclick=()=>openImage(r.id,true)}
  async function init(){makeUi();for(let i=0;i<100&&!window.cesiumViewer;i++)await new Promise(r=>setTimeout(r,100));viewer=window.cesiumViewer;if(!viewer){console.warn('Image module: viewer not exposed');return}records=await all();records.forEach(addPin);renderList();const h=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);h.setInputAction(m=>{const p=viewer.scene.pick(m.position);const id=p?.id?.__imageRecordId;if(id){const r=records.find(x=>x.id===id);if(r)showInfo(r)}},Cesium.ScreenSpaceEventType.LEFT_CLICK)}
  window.addEventListener('DOMContentLoaded',init);
})();
