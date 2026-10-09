import {HttpError,must} from './http.js';

// GitHub OAuth is the default: supports a PUBLIC site + PRIVATE Admin on one free pages.dev host.
// Sessions are short-lived, signed, HttpOnly, Secure and SameSite=Lax; no GitHub token is stored.
const SECONDS=12*60*60;
const encoder=new TextEncoder();
const bytesFromB64=(base64)=>Uint8Array.from(atob(base64.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0));
const b64FromBytes=(bytes)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const cookie=(request,key)=>{const raw=request.headers.get('cookie')||'';return raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='))?.slice(key.length+1)||'';};
const ids=(env)=>String(env.ADMIN_GITHUB_IDS||'').split(',').map(s=>s.trim()).filter(x=>/^\d+$/.test(x));
function settings(env){
  must(env.AUTH_PROVIDER==='github',503,'GitHub OAuth is not selected');
  must(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET,503,'GitHub OAuth credentials missing');
  must(String(env.SESSION_SECRET||'').length>=32,503,'SESSION_SECRET must be at least 32 chars');
  must(ids(env).length,503,'Set ADMIN_GITHUB_IDS for allowed admins');
}
async function hmac(data,secret){
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(data)));
}
const constantEquals=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;};
export function cookieHeader(name,value,{maxAge=SECONDS,path='/api'}={}){
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
export async function makeSession(id,login,env){
  settings(env);
  const payload=b64FromBytes(encoder.encode(JSON.stringify({id:String(id),login:String(login).slice(0,80),exp:Math.floor(Date.now()/1000)+SECONDS})));
  return `${payload}.${b64FromBytes(await hmac(payload,env.SESSION_SECRET))}`;
}
export async function verifyGithubSession(request,env){
  settings(env);
  const token=cookie(request,'ah_session');
  must(token.length>70&&token.length<2000,401,'Please sign in with GitHub');
  const parts=token.split('.');must(parts.length===2,401,'Invalid session');
  const [payload,signature]=parts;
  const expected=await hmac(payload,env.SESSION_SECRET);
  let actual;try{actual=bytesFromB64(signature);}catch{throw new HttpError(401,'Invalid session');}
  must(constantEquals(expected,actual),401,'Invalid session signature');
  let data;try{data=JSON.parse(new TextDecoder().decode(bytesFromB64(payload)));}catch{throw new HttpError(401,'Invalid session');}
  must(data.exp>Math.floor(Date.now()/1000)&&ids(env).includes(String(data.id)),403,'Session expired or GitHub account not allowed');
  return {email:`github:${data.login}`,id:String(data.id)};
}
export function githubSettings(env){settings(env);}
export function nonce(){return b64FromBytes(crypto.getRandomValues(new Uint8Array(32)));}
export function stateCookie(request){return cookie(request,'ah_oauth_state');}
