import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {makeSession} from '../functions/_lib/github-auth.js';
import {onRequest as admin} from '../functions/api/admin/[[path]].js';
import {onRequestGet as catalog} from '../functions/api/catalog.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const origin='https://sample.pages.dev';
const settings={AUTH_PROVIDER:'github',GITHUB_CLIENT_ID:'local-id',GITHUB_CLIENT_SECRET:'local-secret',SESSION_SECRET:'integration-test-secret-that-is-much-longer-than-32-chars',ADMIN_GITHUB_IDS:'123'};
function mockD1(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../schema/001_init.sql',import.meta.url),'utf8'));
 const db={
  prepare(query){return stmt(query)},
  async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}},
 };
 function stmt(query,vars=[]){
  return {bind(...values){return stmt(query,values)},
   async first(){return sql.prepare(query).get(...vars)||null},
   async all(){return {results:sql.prepare(query).all(...vars)}},
   async run(){const result=sql.prepare(query).run(...vars);return {meta:{changes:result.changes}}}};
 }
 return {db,sql};
}
async function withSession(t){
 const {db,sql}=mockD1();t.after(()=>sql.close());
 const token=await makeSession(123,'verified-owner',settings);
 const env={...settings,DB:db,CLOUDINARY_CLOUD_NAME:'demo-cloud',CLOUDINARY_API_KEY:'demo-key',CLOUDINARY_API_SECRET:'demo-secret'};
 async function call(path,method='GET',body,auth=true){
  const request=new Request(origin+path,{method,headers:{...(method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'}),...(auth?{'Cookie':`ah_session=${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const res=path.startsWith('/api/catalog')?await catalog({request,env}):await admin({request,env});
  return {status:res.status,data:await res.json()};
 }
 return {call};
}

test('D1 full lifecycle: create site, create/edit/search/delete product, import/export, quota',async(t)=>{
 const {call}=await withSession(t);
 let r=await call('/api/admin/sites','POST',{slug:'tech-items',name:'Tech Finds',tagline:'เลือกของคุ้ม'});
 assert.equal(r.status,201,JSON.stringify(r.data));
 r=await call('/api/admin/products','POST',{site:'tech-items',title:'Camera Case',market:'shopee',url:'https://shopee.co.th/123',image:'',category:'กล้อง',why:'กันรอย'});
 assert.equal(r.status,201,JSON.stringify(r.data));const pid=r.data.id;
 r=await call('/api/catalog?site=tech-items&q=Camera');assert.equal(r.status,200);assert.equal(r.data.total,1);assert.equal(r.data.site.slug,'tech-items');
 r=await call('/api/catalog?site=main&q=Camera');assert.equal(r.data.total,0);
 r=await call(`/api/admin/products/${pid}`,'PATCH',{site:'tech-items',title:'Camera Sleeve',market:'shopee',url:'https://shopee.co.th/123',category:'กล้อง'});
 assert.equal(r.status,200,JSON.stringify(r.data));
 r=await call(`/api/admin/export?site=tech-items`);assert.equal(r.data.links[0].title,'Camera Sleeve');
 r=await call('/api/admin/upload-sign','POST',{site:'tech-items'});assert.equal(r.status,200);assert.match(r.data.public_id,/^affiliate-hub\/tech-items\//);assert.match(r.data.signature,/^[0-9a-f]{40}$/);
 r=await call('/api/admin/quota?site=tech-items');assert.equal(r.status,200);assert.equal(r.data.products,1);
 r=await call(`/api/admin/products/${pid}?site=tech-items`,'DELETE');assert.equal(r.status,200);
 r=await call('/api/catalog?site=tech-items');assert.equal(r.data.total,0);
 r=await call('/api/admin/import','POST',{site:'tech-items',products:[{title:'Tripod',market:'lazada',url:'https://lazada.co.th/item'}]});assert.equal(r.status,200,JSON.stringify(r.data));
 r=await call('/api/catalog?site=tech-items');assert.equal(r.data.total,1);assert.equal(r.data.products[0].title,'Tripod');
 r=await call('/api/admin/sites');assert.equal(r.data.sites.length,2);
 r=await call('/api/admin/products','POST',{site:'tech-items',title:'Denied',market:'shopee',url:'https://shopee.co.th/item'},false);assert.equal(r.status,401);
});
