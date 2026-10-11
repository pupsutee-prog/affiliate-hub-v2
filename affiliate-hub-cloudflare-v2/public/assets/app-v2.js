/* Affiliate Hub V2 - preserving the original HTML and CSS.
 * All catalog changes go to authenticated D1-backed API, never localStorage.
 */
(()=>{'use strict';
const $=sel=>document.querySelector(sel);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const markets={shopee:'Shopee',lazada:'Lazada',tiktok:'TikTok Shop',amazon:'Amazon'};
const tint={'อิเล็กทรอนิกส์':'#4f46e5','บ้านและครัว':'#0f766e','ความงาม':'#be185d','แฟชั่น':'#b45309'};
const currentSite=new URLSearchParams(location.search).get('site')||'main';
const randomSeed=crypto.getRandomValues(new Uint32Array(1))[0]%2147483646+1;
const state={site:currentSite,page:1,total:0,limit:24,products:[],categories:[],q:'',category:'',market:'',sort:'random',admin:false,adminProducts:[],adminCategories:[],adminPage:1,adminTotal:0,sites:[],editing:null,selected:new Set(),media:[]};
const params=(p={})=>new URLSearchParams({site:state.site,...p}).toString();
const siteLink=s=>`/?site=${encodeURIComponent(s)}#/`;
const readableCategorySegment=category=>Array.from(category,char=>/[\p{L}\p{M}\p{N}_.~-]/u.test(char)?char:encodeURIComponent(char)).join('');
const readableCategoryUrl=category=>location.origin+'/category/'+readableCategorySegment(category)+location.search;
async function api(path,opts={}){
  const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts});
  let data;try{data=await res.json();}catch{throw Error(res.status===401?'กรุณาเข้าสู่ระบบผู้ดูแล':'เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (ตรวจสอบการตั้งค่า Login และ Functions)');}
  if(!res.ok||data.ok===false)throw Error(data.error||'คำขอไม่สำเร็จ ('+res.status+')');
  return data;
}
function adminApi(path,method='GET',body){return api('/api/admin/'+path,{method,headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});}
function notify(message,error=false){const el=$('#toast');if(!el){alert(message);return;}el.textContent=message;el.classList.toggle('error',error);el.hidden=false;setTimeout(()=>el.hidden=true,5000);}
function fail(error){notify(error.message||String(error),true);}
function photo(p,cls=''){
  return `<div class="placeholder" style="background:${tint[p.category]||'#475569'}">${esc(String(p.title||'?').slice(0,2))}</div>${p.image?`<img class="${cls}" src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">`:''}`;
}
function card(p){return `<article class="card"><div class="card-media"><a class="media-link" href="#/product/${encodeURIComponent(p.id)}">${photo(p)}</a><span class="badge" data-market="${esc(p.market)}">${esc(markets[p.market]||p.market)}</span></div><div class="card-body">${p.category?`<span class="card-cat">${esc(p.category)}</span>`:''}<h3 class="card-title"><a href="#/product/${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3>${p.why?`<p class="card-why">${esc(p.why)}</p>`:''}<div class="card-foot"><button class="btn-go" type="button" data-go="${esc(p.id)}">ไปหน้าสินค้า ↗</button></div></div></article>`;}
async function loadPublic(){
 try{
  const d=await api('/api/catalog?'+params({page:state.page,limit:state.limit,q:state.q,category:state.category,market:state.market,sort:state.sort,seed:randomSeed}));
  state.products=d.products;state.categories=d.categories;state.total=d.total;
  document.title=state.category?state.category+' — '+d.site.name:d.site.name+' — รวมลิงก์สินค้า';$('.brand-text strong').textContent=d.site.name;$('.brand-text small').textContent=d.site.tagline||'รวมลิงก์สินค้าโปรโมชัน';
  $('#catalogTitle').textContent=state.category||'สินค้าทั้งหมด';
  $('#copyCategoryLink').hidden=!state.category;
  const siteTheme=String(d.site.theme_color||'').toLowerCase();
  if(/^#[0-9a-f]{6}$/.test(siteTheme)&&siteTheme!=='#4f46e5')document.documentElement.style.setProperty('--indigo-600',siteTheme);
  else document.documentElement.style.removeProperty('--indigo-600');
  $('#categoryChips').innerHTML=`<button class="chip ${!state.category?'active':''}" data-category="">ทั้งหมด</button>`+state.categories.map(c=>`<button class="chip ${state.category===c.category?'active':''}" data-category="${esc(c.category)}">${esc(c.category)}</button>`).join('');
  const activeChip=$('#categoryChips .active'),scroller=$('.category-scroll');
  if(activeChip&&scroller)requestAnimationFrame(()=>activeChip.scrollIntoView({block:'nearest',inline:'center'}));
  $('#linkGrid').innerHTML=d.products.map(card).join('');
  $('#homeEmpty').hidden=d.products.length>0;
  $('#resultCount').textContent=`พบ ${d.total.toLocaleString('th-TH')} รายการ · หน้า ${d.page}`;
  renderPager('linkGrid',state.page,Math.ceil(state.total/state.limit),'public');
 }catch(e){$('#linkGrid').innerHTML=`<div class="v2-alert">โหลดข้อมูลไม่สำเร็จ: ${esc(e.message)}<p class="hint">โปรดตรวจสอบ D1 Binding และรันไฟล์ schema/001_init.sql</p></div>`;}
}
function renderPager(afterId,page,last,type){
 const old=$('#v2Pager-'+type);if(old)old.remove();if(last<=1)return;
 const pager=document.createElement('div');pager.className='v2-pager';pager.id='v2Pager-'+type;
 pager.innerHTML=`<button class="btn btn-ghost btn-sm" data-page="${type}:prev" ${page<=1?'disabled':''}>← ก่อนหน้า</button><span>หน้า ${page} / ${last}</span><button class="btn btn-ghost btn-sm" data-page="${type}:next" ${page>=last?'disabled':''}>ถัดไป →</button>`;
 const anchor=type==='admin'?$('#'+afterId).closest('.table-wrap'):$('#'+afterId);anchor.insertAdjacentElement('afterend',pager);
}
async function productDetail(id){
 try{
  const data=await api('/api/catalog?'+params({id})),p=data.product;
  $('#productCrumbs').innerHTML=`<a href="#/">หน้าแรก</a><span>›</span><span class="crumb-current">${esc(p.title)}</span>`;
  $('#productBody').innerHTML=`<article class="pd"><div class="pd-media">${photo(p)}</div><div class="pd-info"><span class="badge badge-inline" data-market="${esc(p.market)}">${esc(markets[p.market]||p.market)}</span>${p.category?`<span class="pd-cat">${esc(p.category)}</span>`:''}<h1 class="pd-title">${esc(p.title)}</h1>${p.note?`<p class="pd-note">${esc(p.note)}</p>`:''}${p.why?`<div class="pd-why"><span class="pd-why-label">ทำไมเราถึงแนะนำ</span><p>${esc(p.why)}</p></div>`:''}<div class="pd-actions"><a class="btn-go btn-go-lg" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer sponsored">ไปหน้าสินค้า ↗</a></div><p class="pd-disclosure">ลิงก์นี้เป็นลิงก์ affiliate เราอาจได้รับค่าคอมมิชชัน</p></div></article>${p.description?`<section class="panel pd-section"><h2>รายละเอียดจากร้านค้า</h2><p class="pre-line">${esc(p.description)}</p></section>`:''}`;
  $('#stickyCta').innerHTML=`<a class="btn-go" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer sponsored">ไปหน้าสินค้า ↗</a>`;
  $('#stickyCta').hidden=false;
 }catch(e){$('#productBody').innerHTML=`<div class="v2-alert">${esc(e.message)}</div>`;}
}
async function route(){
 const [section,...encodedParts]=(location.hash.slice(2)||'').split('/');
 let detail='';try{detail=decodeURIComponent(encodedParts.join('/'));}catch{}
 const view=section==='admin'?'admin':section==='about'?'about':section==='product'?'product':'home';
 if(view==='home'){
  const category=section==='category'?detail:!location.hash&&location.pathname.startsWith('/category/')?document.querySelector('meta[name="category-name"]')?.content||'':'';
  if(state.category!==category)state.page=1;
  state.category=category;
 }
 for(const el of document.querySelectorAll('.view'))el.hidden=el.id!=='view-'+view;
 document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===view));
 $('#stickyCta').hidden=true;
 if(view==='admin')await loadAdmin();
 else if(view==='product')await productDetail(detail);
 else if(view==='home')await loadPublic();
 window.scrollTo(0,0);
}
function showImage(url){
 const preview=$('#imagePreview');let img=$('#imagePreviewImg');
 if(!img){img=document.createElement('img');img.id='imagePreviewImg';img.alt='';preview.append(img);}
 $('#imageInput').value=url||'';
 if(url){img.src=url;img.hidden=false;}else{img.removeAttribute('src');img.hidden=true;}
 preview.classList.toggle('is-empty',!url);
}
async function loadAdmin(){
 try{
  const identity=await adminApi('me');state.admin=true;$('#adminLock').hidden=true;$('#adminPanel').hidden=false;$('#v2Who').textContent=identity.email;
  $('#publishLine').textContent='แก้ไขสินค้าผ่าน API โดยตรง ไม่ต้องกดเผยแพร่ข้อมูลทั้งชุด';
  await loadSites();await Promise.all([loadAdminProducts(),loadAdminCategories(),loadQuota(),loadMedia()]);
 }catch(e){state.admin=false;$('#adminLock').hidden=false;$('#adminPanel').hidden=true;$('#adminLock .hint').textContent='ยังไม่สามารถเข้า Admin ได้: '+e.message;}
}
async function loadSites(){
 const d=await adminApi('sites');state.sites=d.sites;
 if(!d.sites.some(s=>s.slug===state.site))state.site=d.sites[0]?.slug||'main';
 $('#v2SiteSelect').innerHTML=d.sites.map(s=>`<option value="${esc(s.slug)}" ${s.slug===state.site?'selected':''}>${esc(s.name)} (${esc(s.slug)}) — ${s.products} รายการ</option>`).join('');
 $('#v2VisitSite').href=siteLink(state.site);
}
async function loadAdminCategories(){
 const d=await adminApi('categories?'+params());state.adminCategories=d.categories;
 $('#categoryList').innerHTML=d.categories.map(c=>`<option value="${esc(c.category)}"></option>`).join('');
 $('#adminCategoryList').innerHTML=d.categories.length?d.categories.map(c=>`<div class="admin-category-row"><span><strong>${esc(c.category)}</strong><small class="hint">${c.n.toLocaleString('th-TH')} สินค้า</small></span><button class="btn btn-danger btn-sm" type="button" data-remove-category="${esc(c.category)}">ลบหมวด</button></div>`).join(''):'<p class="hint">ยังไม่มีหมวดหมู่ เพิ่มได้จากช่องหมวดหมู่ของสินค้า</p>';
}
async function loadAdminProducts(){
 const d=await adminApi('products?'+params({page:state.adminPage}));state.adminProducts=d.products;state.adminTotal=d.total;state.selected.clear();
 $('#adminTableBody').innerHTML=d.products.map(p=>`<tr><td><input type="checkbox" data-select="${esc(p.id)}" aria-label="เลือก ${esc(p.title)}"></td><td><div style="display:flex;gap:10px;align-items:center">${p.image?`<img class="row-thumb" src="${esc(p.image)}" alt="" loading="lazy">`:''}<span>${esc(p.title)} ${p.status==='draft'?'<small>(ฉบับร่าง)</small>':''}</span></div></td><td data-label="ตลาด">${esc(markets[p.market]||p.market)}</td><td data-label="หมวด">${esc(p.category)}</td><td class="num" data-label="สถานะ">${p.status==='draft'?'ร่าง':'เผยแพร่'}</td><td><button class="btn btn-ghost btn-sm" data-edit="${esc(p.id)}">แก้ไข</button><button class="btn btn-danger btn-sm" data-delete="${esc(p.id)}">ลบ</button></td></tr>`).join('');
 $('#storageLine').textContent=`รายการทั้งหมดของเว็บไซต์นี้ ${d.total.toLocaleString('th-TH')} · แสดงครั้งละ ${d.limit} รายการ`;
 $('#statCards').innerHTML=`<div class="hero-stat"><b>${d.total.toLocaleString('th-TH')}</b><span>รายการสินค้าของเว็บไซต์นี้</span></div>`;
 $('#rowBulkBar').hidden=true;
 renderPager('adminTableBody',state.adminPage,Math.ceil(d.total/d.limit),'admin');

}
async function loadQuota(){
 try{
  const d=await adminApi('quota?'+params());
  const db=d.approxDbBytes;const dbPercent=db===null?null:Math.round(db/d.freeTier.d1PerDatabaseBytes*100);
  const knownMB=(d.imageBytes/(1024*1024)).toFixed(2);
  let warn='';if(dbPercent!==null&&dbPercent>=70)warn='<div class="v2-alert">พื้นที่ฐานข้อมูลประมาณการถึง '+dbPercent+'% · สำรองและตรวจสอบโควตาทันที</div>';
  if(d.images>0&&d.imageBytes>200*1024*1024)warn+='<div class="v2-alert">รูปที่ติดตามในระบบเกินงบประมาณแนะนำ 200 MB · ตรวจสอบ Cloudinary Usage</div>';
  $('#v2QuotaData').innerHTML=`<div class="v2-quota-line"><strong>สินค้า: ${d.products.toLocaleString('th-TH')} รายการ</strong><span>รูปที่ติดตาม: ${d.images} รูป (${knownMB} MB)</span></div><div class="v2-quota-line"><span>D1 ของฐานข้อมูลทั้งหมด: ${db===null?'อ่านค่าพื้นที่ไม่ได้':(db/1048576).toFixed(2)+' / 500 MB ('+dbPercent+'%)'}</span><span>Cloudinary: Free 25 credits/เดือน (ใช้ร่วมกัน)</span></div>${warn}<p class="hint">Workers Requests, D1 Rows และเครดิต Cloudinary จริงต้องตรวจที่ Dashboard ของแต่ละบริการ</p>`;
 }catch(e){$('#v2QuotaData').textContent='โหลดสถานะไม่สำเร็จ: '+e.message;}
}
async function loadMedia(){
 try{
  const d=await adminApi('media?'+params());state.media=d.media;
  $('#v2MediaGrid').innerHTML=d.media.length?d.media.map(m=>`<div class="v2-media-item"><img src="${esc(m.url)}" alt=""><small title="${esc(m.public_id)}">${esc(m.public_id.split('/').at(-1))}</small><button type="button" class="btn btn-danger btn-sm" data-media-delete="${esc(m.id)}">ลบรูป</button></div>`).join(''):'<p class="hint">ยังไม่มีรูปที่อัปโหลดจากหน้า Admin</p>';
 }catch(e){$('#v2MediaGrid').textContent='โหลดรูปไม่สำเร็จ: '+e.message;}
}
function dataFromForm(){const d=Object.fromEntries(new FormData($('#linkForm')).entries());d.site=state.site;d.image=$('#imageInput').value;d.status='published';return d;}
function resetForm(){state.editing=null;$('#linkForm').reset();$('#formTitle').textContent='เพิ่มลิงก์ใหม่';$('#cancelEdit').hidden=true;showImage('');}
function editProduct(id){const p=state.adminProducts.find(p=>p.id===id);if(!p)return;state.editing=id;for(const [k,v] of Object.entries({title:p.title,market:p.market,category:p.category,url:p.url,note:p.note,why:p.why,description:p.description,subId:p.subId})){const el=$('#linkForm [name="'+k+'"]');if(el)el.value=v||'';}showImage(p.image);$('#formTitle').textContent='แก้ไข: '+p.title;$('#cancelEdit').hidden=false;$('#linkForm').scrollIntoView({behavior:'smooth'});}
async function onForm(e){e.preventDefault();const data=dataFromForm();try{const submit=$('#submitBtn');submit.disabled=true;await adminApi(state.editing?'products/'+state.editing:'products',state.editing?'PATCH':'POST',data);notify('บันทึกข้อมูลสำเร็จ');resetForm();state.adminPage=1;await Promise.all([loadAdminProducts(),loadAdminCategories(),loadQuota()]);}catch(err){fail(err);}finally{$('#submitBtn').disabled=false;}}
async function uploadImage(file){
 if(!file)return;
 if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)){notify('รับ JPEG, PNG, WebP, AVIF เท่านั้น',true);return;}
 if(file.size>3*1024*1024){notify('แนะนำให้บีบอัดรูปก่อน: จำกัด 3 MB ต่อรูปเพื่อประหยัดโควตา',true);return;}
 try{
  $('#imageHint').textContent='กำลังส่งรูปไป Cloudinary...';
  const signed=await adminApi('upload-sign','POST',{site:state.site});
  const form=new FormData();form.set('file',file);form.set('api_key',signed.apiKey);form.set('timestamp',signed.timestamp);form.set('public_id',signed.public_id);form.set('signature',signed.signature);
  const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`,{method:'POST',body:form});
  const out=await response.json();if(!response.ok||!out.secure_url)throw Error(out.error?.message||'Cloudinary rejected upload');
  // If registering media fails, do NOT silently claim success.
  await adminApi('media','POST',{site:state.site,public_id:out.public_id,url:out.secure_url,bytes:out.bytes});
  showImage(out.secure_url);$('#imageHint').textContent='อัปโหลดเรียบร้อย · กดบันทึกสินค้าเพื่อใช้รูป';await Promise.all([loadMedia(),loadQuota()]);
 }catch(e){$('#imageHint').textContent='อัปโหลดไม่สำเร็จ: '+e.message;fail(e);}
}
async function fetchSingleProduct(){
 const url=$('#linkForm [name="url"]').value.trim();if(!url)return notify('กรุณาใส่ลิงก์สินค้า',true);
 const button=$('#fetchImageBtn');button.disabled=true;$('#imageHint').textContent='กำลังดึงชื่อและรูปจากร้านค้า...';
 try{
  const p=await adminApi('preview','POST',{url});
  $('#linkForm [name="title"]').value=p.title;$('#formMarket').value=p.market;showImage(p.image);
  $('#imageHint').textContent='ดึงชื่อและรูปแล้ว · ตรวจสอบข้อมูลก่อนกดบันทึก';
 }catch(e){$('#imageHint').textContent='ดึงข้อมูลไม่สำเร็จ: '+e.message;fail(e);}
 finally{button.disabled=false;}
}
function parseCSV(src){
 src=src.replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quotes=false;
 for(let i=0;i<src.length;i++){const c=src[i];if(quotes){if(c==='"'&&src[i+1]==='"'){cell+='"';i++;}else if(c==='"')quotes=false;else cell+=c;}else if(c==='"')quotes=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
 row.push(cell.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);if(!rows.length)return [];
 const keys=rows.shift().map(x=>x.trim());return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]||''])));
}
function csvCell(s){s=String(s??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
async function importItems(items,mode='append'){
 if(!items.length)throw Error('ไม่พบรายการสินค้า');
 if(mode==='replace'&&items.length>50)throw Error('โหมดแทนที่ทั้งหมดรองรับไม่เกิน 50 รายการต่อครั้ง; สำหรับข้อมูลมากกว่านี้ให้สำรองก่อนและใช้โหมดเพิ่ม');
 let done=0;for(let i=0;i<items.length;i+=50){const d=await adminApi('import','POST',{site:state.site,mode:i===0?mode:'append',products:items.slice(i,i+50)});done+=d.imported;}
 return done;
}
async function importFile(file){
 if(!file)return;try{
  const src=await file.text(),isJson=src.trimStart().startsWith('[')||src.trimStart().startsWith('{');
  const parsed=isJson?JSON.parse(src):parseCSV(src);const items=Array.isArray(parsed)?parsed:(parsed.links||parsed.products||[]);
  if(!items.length)throw Error('ไม่มีข้อมูลสินค้าในไฟล์');
  const mode=$('input[name="importMode"]:checked').value;
  if(mode==='replace'&&!confirm(`แทนที่สินค้าของ ${state.site} ทั้งหมดด้วยข้อมูล ${items.length} รายการ? ควร Export Backup ก่อน`))return;
  const done=await importItems(items,mode);notify(`นำเข้า ${done} รายการสำเร็จ`);await Promise.all([loadAdminProducts(),loadAdminCategories(),loadQuota()]);
 }catch(e){fail(e);}finally{$('#bulkImportFile').value='';}
}
async function backup(format){
 try{
  let page=1,items=[],total=1;
  do{const d=await adminApi('export?'+params({page}));items.push(...d.links);total=d.total;page++;if(page>1000)throw Error('Export ถูกจำกัดชั่วคราวที่ 200,000 รายการ');}while(items.length<total);
  const fields=['title','market','category','url','image','why','note','description','subId'];
  const content=format==='csv'?[fields.join(','),...items.map(i=>fields.map(f=>csvCell(i[f])).join(','))].join('\r\n'):JSON.stringify({version:2,site:state.site,exportedAt:new Date().toISOString(),links:items},null,2);
  const blob=new Blob([content],{type:format==='csv'?'text/csv;charset=utf-8':'application/json;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`affiliate-${state.site}-backup-${new Date().toISOString().slice(0,10)}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  notify('ส่งออกข้อมูลสำเร็จ ('+items.length+' รายการ)');
 }catch(e){fail(e);}
}
async function createSite(){
 const slug=prompt('Slug ภาษาอังกฤษ เช่น tech-deals (2–40 ตัวอักษร)');if(!slug)return;
 const name=prompt('ชื่อเว็บไซต์');if(!name)return;
 try{await adminApi('sites','POST',{slug,name,tagline:'รวมลิงก์สินค้าโปรโมชัน'});state.site=slug;state.adminPage=1;resetForm();await loadSites();await Promise.all([loadAdminProducts(),loadAdminCategories(),loadQuota(),loadMedia()]);notify('สร้างเว็บไซต์สำเร็จ');}catch(e){fail(e);}
}
async function editSite(){
 const site=state.sites.find(s=>s.slug===state.site);if(!site)return;
 const name=prompt('ชื่อเว็บไซต์',site.name);if(name===null)return;
 const tagline=prompt('คำอธิบายเว็บไซต์',site.tagline);if(tagline===null)return;
 const color=prompt('สีหลัก เช่น #4f46e5',site.theme_color);if(color===null)return;
 const host=prompt('โดเมนที่เชื่อมกับ Pages แล้ว (เว้นว่างหากใช้ ?site=slug)',site.host||'');if(host===null)return;
 try{await adminApi('sites/'+site.id,'PATCH',{slug:site.slug,name,tagline,theme_color:color,host});await loadSites();await loadPublic();notify('ตั้งค่าเว็บไซต์สำเร็จ');}catch(e){fail(e);}
}
async function bulkUrls(){
 const lines=$('#bulkUrlInput').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length)return notify('กรุณาวางลิงก์',true);
 if(lines.length>50)return notify('เพิ่มได้ครั้งละไม่เกิน 50 ลิงก์',true);
 const button=$('#bulkAddBtn'),message=$('#bulkMsg');button.disabled=true;message.hidden=false;
 const items=[],failed=[];
 try{
  for(let i=0;i<lines.length;i+=4){
   message.textContent=`กำลังดึงชื่อและรูป ${Math.min(i+4,lines.length)} / ${lines.length} ลิงก์...`;
   const batch=await Promise.all(lines.slice(i,i+4).map(async line=>{
    const separator=line.indexOf('|'),url=(separator<0?line:line.slice(0,separator)).trim(),customTitle=separator<0?'':line.slice(separator+1).trim();
    try{const p=await adminApi('preview','POST',{url});return {line,item:{title:customTitle||p.title,url,market:p.market,category:'',image:p.image,status:'published'}};}
    catch(e){return {line,error:e.message||'ดึงข้อมูลไม่สำเร็จ'};}
   }));
   for(const result of batch){if(result.item)items.push(result.item);else failed.push(result);}
  }
  if(items.length){await importItems(items);await Promise.all([loadAdminProducts(),loadAdminCategories(),loadQuota()]);}
  $('#bulkUrlInput').value=failed.map(x=>x.line).join('\n');
  message.textContent=failed.length?`เพิ่ม ${items.length} รายการ · ดึงข้อมูลไม่ได้ ${failed.length} ลิงก์ (${failed.slice(0,2).map(x=>x.error).join('; ')}) — ลิงก์ที่เหลือยังอยู่ในช่อง`:`เพิ่ม ${items.length} รายการ พร้อมชื่อและรูปสินค้า`;
  notify(message.textContent,failed.length>0);
 }catch(e){message.textContent='บันทึกไม่สำเร็จ: '+e.message;fail(e);}
 finally{button.disabled=false;}
}
async function handleGlobalClick(e){
 const p=e.target.closest('[data-page]');if(p){const [type,direction]=p.dataset.page.split(':');if(type==='public'){state.page+=direction==='next'?1:-1;await loadPublic();}else{state.adminPage+=direction==='next'?1:-1;await loadAdminProducts();}return;}
 const cat=e.target.closest('[data-category]');if(cat){const category=cat.dataset.category;location.assign((category?'/category/'+encodeURIComponent(category):'/')+location.search);return;}
 const go=e.target.closest('[data-go]');if(go){const product=state.products.find(p=>p.id===go.dataset.go);if(product)window.open(product.url,'_blank','noopener,noreferrer');return;}
 const edit=e.target.closest('[data-edit]');if(edit)return editProduct(edit.dataset.edit);
 const del=e.target.closest('[data-delete]');if(del){const x=state.adminProducts.find(p=>p.id===del.dataset.delete);if(x&&confirm('ลบสินค้า "'+x.title+'"? (เก็บร่องรอยไว้สำหรับกู้ข้อมูล)'))try{await adminApi('products/'+x.id+'?'+params(),'DELETE');notify('ลบข้อมูลแล้ว');await Promise.all([loadAdminProducts(),loadAdminCategories(),loadQuota()]);}catch(err){fail(err);}return;}
 const removeCategory=e.target.closest('[data-remove-category]');if(removeCategory){const name=removeCategory.dataset.removeCategory;const count=state.adminCategories.find(c=>c.category===name)?.n||0;if(!confirm(`ลบหมวด "${name}"? สินค้า ${count} รายการจะยังอยู่ แต่จะไม่มีหมวดหมู่`))return;try{const result=await adminApi('categories?'+params(),'DELETE',{category:name});await Promise.all([loadAdminCategories(),loadAdminProducts()]);notify(`ลบหมวดแล้ว สินค้า ${result.updatedProducts} รายการยังอยู่`);}catch(err){fail(err);}return;}
 const media=e.target.closest('[data-media-delete]');if(media&&confirm('ลบไฟล์ภาพนี้จาก Cloudinary จริงหรือไม่?'))try{await adminApi('media/'+media.dataset.media+'?'+params(),'DELETE');await loadMedia();await loadQuota();notify('ลบไฟล์แล้ว');}catch(err){fail(err);}
}
function hooks(){
 document.addEventListener('click',handleGlobalClick);
 let debounce;$('#searchInput').addEventListener('input',e=>{state.q=e.target.value;state.page=1;clearTimeout(debounce);debounce=setTimeout(loadPublic,300);});
 $('#searchClear').addEventListener('click',()=>{$('#searchInput').value='';state.q='';state.page=1;loadPublic();});
 $('#marketFilter').innerHTML='<option value="">ทั้งหมด</option>'+Object.entries(markets).map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
 $('#marketFilter').addEventListener('change',e=>{state.market=e.target.value;state.page=1;loadPublic();});
 $('#sortSelect').addEventListener('change',e=>{state.sort=e.target.value;state.page=1;loadPublic();});
 $('#copyCategoryLink').addEventListener('click',async()=>{if(!state.category)return;try{await navigator.clipboard.writeText(`หมวดหมู่: ${state.category}\n${readableCategoryUrl(state.category)}`);notify('คัดลอกชื่อหมวดและลิงก์แล้ว');}catch{notify('คัดลอกไม่ได้ กรุณาคัดลอกจากแถบที่อยู่',true);}});
 $('#formMarket').innerHTML=Object.entries(markets).map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
 $('#linkForm').addEventListener('submit',onForm);$('#cancelEdit').addEventListener('click',resetForm);
 $('#imageInput').addEventListener('input',e=>showImage(e.target.value));$('#clearImageBtn').addEventListener('click',()=>showImage(''));
 $('#fetchImageBtn').addEventListener('click',fetchSingleProduct);
 $('#uploadImageBtn').addEventListener('click',()=>$('#imageFile').click());$('#imageFile').addEventListener('change',e=>uploadImage(e.target.files?.[0]));
 $('#logoutBtn').addEventListener('click',()=>{location.href='/api/auth/logout';});
 $('#v2SiteSelect').addEventListener('change',async e=>{state.site=e.target.value;state.adminPage=1;resetForm();$('#v2VisitSite').href=siteLink(state.site);await Promise.all([loadAdminProducts(),loadAdminCategories(),loadQuota(),loadMedia()]);});
 $('#refreshCategories').addEventListener('click',()=>loadAdminCategories().catch(fail));
 $('#v2NewSite').addEventListener('click',createSite);$('#v2EditSite').addEventListener('click',editSite);
 $('#v2RefreshQuota').addEventListener('click',loadQuota);$('#v2RefreshMedia').addEventListener('click',loadMedia);
 $('#exportBtn').addEventListener('click',()=>backup('json'));$('#exportCsvBtn').addEventListener('click',()=>backup('csv'));
 $('#importFileBtn').addEventListener('click',()=>$('#bulkImportFile').click());$('#bulkImportFile').addEventListener('change',e=>importFile(e.target.files?.[0]));
 $('#downloadTemplateBtn').addEventListener('click',()=>{const content='title,market,category,url,image,why,note,description,subId\r\n';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));a.download='affiliate-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
 $('#bulkAddBtn').addEventListener('click',bulkUrls);$('#bulkClearBtn').addEventListener('click',()=>$('#bulkUrlInput').value='');
 $('#bulkTabs').addEventListener('click',e=>{const b=e.target.closest('[data-bulk]');if(!b)return;document.querySelectorAll('#bulkTabs .chip').forEach(x=>x.classList.toggle('active',x===b));$('#bulkUrls').hidden=b.dataset.bulk!=='urls';$('#bulkFile').hidden=b.dataset.bulk!=='file';});
 $('#adminTableBody').addEventListener('change',e=>{const s=e.target.dataset.select;if(!s)return;if(e.target.checked)state.selected.add(s);else state.selected.delete(s);$('#rowBulkBar').hidden=!state.selected.size;$('#rowBulkCount').textContent=state.selected.size+' รายการ';});
 $('#selectAllRows').addEventListener('change',e=>{state.selected.clear();document.querySelectorAll('[data-select]').forEach(box=>{box.checked=e.target.checked;if(box.checked)state.selected.add(box.dataset.select);});$('#rowBulkBar').hidden=!state.selected.size;$('#rowBulkCount').textContent=state.selected.size+' รายการ';});
 $('#bulkDeleteBtn').addEventListener('click',async()=>{if(!state.selected.size||!confirm('ยืนยันลบ '+state.selected.size+' รายการ?'))return;try{for(const id of state.selected)await adminApi('products/'+id+'?'+params(),'DELETE');await Promise.all([loadAdminProducts(),loadAdminCategories()]);notify('ลบรายการที่เลือกแล้ว');}catch(e){fail(e);}});
 $('#bulkApplyCategoryBtn').addEventListener('click',async()=>{const cat=$('#bulkCategoryInput').value.trim();if(!cat||!state.selected.size)return;try{for(const id of state.selected){const p=state.adminProducts.find(x=>x.id===id);if(p)await adminApi('products/'+id,'PATCH',{...p,site:state.site,category:cat});}await Promise.all([loadAdminProducts(),loadAdminCategories()]);notify('เปลี่ยนหมวดหมู่แล้ว');}catch(e){fail(e);}});
 $('#bulkClearSelectionBtn').addEventListener('click',()=>{state.selected.clear();document.querySelectorAll('[data-select]').forEach(b=>b.checked=false);$('#rowBulkBar').hidden=true;});
 $('#menuBtn').addEventListener('click',()=>{const open=$('#menuBtn').getAttribute('aria-expanded')!=='true';$('#menuBtn').setAttribute('aria-expanded',String(open));$('.nav').classList.toggle('open',open);});
 window.addEventListener('hashchange',route);
}
document.addEventListener('error',e=>{if(e.target?.id==='imagePreviewImg'){e.target.hidden=true;$('#imagePreview')?.classList.add('is-empty');}else if(e.target?.tagName==='IMG')e.target.remove();},true);
hooks();route();
})();
