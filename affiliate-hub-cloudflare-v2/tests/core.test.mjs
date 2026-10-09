import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {validateProduct,validateSite} from '../functions/_lib/db.js';
import {verifyAdmin} from '../functions/_lib/auth.js';
import {onRequest} from '../functions/api/admin/[[path]].js';

const crypto=globalThis.crypto||webcrypto;
const env={AUTH_PROVIDER:'access',TEAM_DOMAIN:'https://unit.cloudflareaccess.com',POLICY_AUD:'test-audience',ADMIN_EMAILS:'owner@example.com'};
const encoding=new TextEncoder();
const b64u=input=>Buffer.from(input instanceof Uint8Array?input:encoding.encode(JSON.stringify(input))).toString('base64url');

test('product validation retains original affiliate fields and blocks unsafe schemes',()=>{
 const p=validateProduct({title:'สินค้าเครื่องครัว',market:'shopee',url:'https://shopee.co.th/test',image:'https://example.com/a.webp',category:'บ้านและครัว',why:'คุ้มราคา',subId:'campaign'});
 assert.equal(p.sub_id,'campaign');assert.equal(p.market,'shopee');assert.equal(p.category,'บ้านและครัว');
 assert.throws(()=>validateProduct({...p,url:'javascript:alert(1)'}));
 assert.throws(()=>validateProduct({...p,image:'data:image/png;base64,AAAA'}));
 assert.throws(()=>validateProduct({...p,market:'unknown'}));
});

test('site slug prevents SQL/path/domain tricks',()=>{
 assert.equal(validateSite({slug:'tech-deals',name:'Tech Deals'}).slug,'tech-deals');
 assert.throws(()=>validateSite({slug:'../../api/admin',name:'Oops'}));
 assert.throws(()=>validateSite({slug:'x',name:'Oops'}));
 assert.throws(()=>validateSite({slug:'main',name:'OK',host:'foo.example.com/path'}));
});

test('Access authentication fails closed when not configured or missing JWT',async()=>{
 await assert.rejects(verifyAdmin(new Request('https://example.com'),{}),e=>e.status===503);
 await assert.rejects(verifyAdmin(new Request('https://example.com'),env),e=>e.status===401);
});

test('Access RS256 token verifies issuer, audience, signature, email allowlist',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pub=await crypto.subtle.exportKey('jwk',keys.publicKey);pub.kid='test-key';
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({keys:[pub]}),{status:200,headers:{'content-type':'application/json'}});
 try {
  const header={alg:'RS256',kid:'test-key',typ:'JWT'};
  async function token(claims){const s=b64u(header)+'.'+b64u(claims);const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,encoding.encode(s)));return s+'.'+b64u(signature);}
  const validClaims={iss:env.TEAM_DOMAIN,aud:[env.POLICY_AUD],exp:Math.floor(Date.now()/1000)+300,iat:Math.floor(Date.now()/1000),email:'owner@example.com'};
  const jwt=await token(validClaims);
  const r=new Request('https://example.com',{headers:{'Cf-Access-Jwt-Assertion':jwt}});
  assert.equal((await verifyAdmin(r,env)).email,'owner@example.com');
  await assert.rejects(verifyAdmin(new Request('https://example.com',{headers:{'Cf-Access-Jwt-Assertion':await token({...validClaims,email:'hacker@example.com'})}}),env),e=>e.status===403);
  await assert.rejects(verifyAdmin(new Request('https://example.com',{headers:{'Cf-Access-Jwt-Assertion':await token({...validClaims,aud:['wrong']})}}),env),e=>e.status===401);
  const parts=jwt.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  await assert.rejects(verifyAdmin(new Request('https://example.com',{headers:{'Cf-Access-Jwt-Assertion':parts.join('.')}}),env),e=>e.status===401);
 }finally{globalThis.fetch=originalFetch;}
});

test('every Admin route is protected when no Access credentials',async()=>{
 for(const [path,method] of [['me','GET'],['sites','GET'],['products','POST'],['quota','GET'],['import','POST'],['upload-sign','POST'],['media','GET']]){
  const request=new Request('https://example.com/api/admin/'+path,{method});
  const r=await onRequest({request,env:{DB:{},...env}});
  assert.equal(r.status,401,`${method} ${path} must refuse unauthenticated requests`);
 }
});

import {makeSession} from '../functions/_lib/github-auth.js';
import {onRequestGet as oauthRoute} from '../functions/api/auth/[[path]].js';
const gitEnv={AUTH_PROVIDER:'github',GITHUB_CLIENT_ID:'demo-client',GITHUB_CLIENT_SECRET:'demo-secret',SESSION_SECRET:'temporary-secret-is-at-least-32-characters-long',ADMIN_GITHUB_IDS:'12345,45678'};
test('GitHub signed HttpOnly session authorizes only allowlisted IDs',async()=>{
 const token=await makeSession(12345,'project-owner',gitEnv);
 const req=new Request('https://example.pages.dev/api/admin/me',{headers:{Cookie:'ah_session='+token}});
 assert.equal((await verifyAdmin(req,gitEnv)).id,'12345');
 const [p,s]=token.split('.');
 const bad=(s[0]==='A'?'B':'A')+s.slice(1);
 await assert.rejects(verifyAdmin(new Request('https://example.pages.dev/api/admin/me',{headers:{Cookie:'ah_session='+p+'.'+bad}}),gitEnv),e=>e.status===401);
 await assert.rejects(verifyAdmin(new Request('https://example.pages.dev/api/admin/me',{headers:{Cookie:'ah_session='+await makeSession(999,'outsider',gitEnv)}}),gitEnv),e=>e.status===403);
});
test('GitHub OAuth entrypoint redirects to GitHub with CSRF state cookie',async()=>{
 const r=await oauthRoute({request:new Request('https://example.pages.dev/api/auth/login'),env:gitEnv});
 assert.equal(r.status,302);assert.match(r.headers.get('Location'),/^https:\/\/github.com\/login\/oauth\/authorize/);
 assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
});
test('GitHub OAuth callback refuses requests without valid state and code',async()=>{
 const r=await oauthRoute({request:new Request('https://example.pages.dev/api/auth/callback?code=abcdefghi&state=bad'),env:gitEnv});
 assert.equal(r.status,401);
});
