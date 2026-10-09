import {HttpError,must} from './http.js';
import {verifyGithubSession} from './github-auth.js';
// Cloudflare Access assertion is RS256 signed. Verify JWT (kid, sig, iss, aud, exp)
// independently. NEVER trust a sessionStorage flag or old x-admin-key header.
let cachedKeys=null, keysExpire=0;
const decode=(part)=>Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
const parse=(part)=>JSON.parse(new TextDecoder().decode(decode(part)));
async function jwks(teamDomain) {
  if(cachedKeys && Date.now()<keysExpire)return cachedKeys;
  const response=await fetch(`${teamDomain}/cdn-cgi/access/certs`);
  must(response.ok,503,'Cannot verify Access identity');
  const keys=(await response.json()).keys;
  must(Array.isArray(keys),503,'Access keys unavailable');
  cachedKeys=keys;keysExpire=Date.now()+10*60*1000;
  return keys;
}
async function verifyCloudflareAccess(request, env) {
  const domain=String(env.TEAM_DOMAIN||'').replace(/\/$/,'');
  const aud=String(env.POLICY_AUD||'');
  const emails=String(env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  must(/^https:\/\/[a-z0-9.-]+\.cloudflareaccess\.com$/.test(domain) && aud && emails.length,503,'Admin authentication is not configured');
  const jwt=request.headers.get('Cf-Access-Jwt-Assertion')||'';
  must(jwt.length>50,401,'Please sign in using Cloudflare Access');
  let header, claims, signature, signed;
  try {const [h,p,s,...rest]=jwt.split('.');must(h&&p&&s&&!rest.length,401,'Invalid authentication');header=parse(h);claims=parse(p);signature=decode(s);signed=new TextEncoder().encode(`${h}.${p}`);}
  catch {throw new HttpError(401,'Invalid authentication token');}
  must(header.alg==='RS256'&&typeof header.kid==='string',401,'Unsupported authentication');
  const keys=await jwks(domain);
  const jwk=keys.find(k=>k.kid===header.kid && k.kty==='RSA');
  must(jwk,401,'Unknown Access signing key');
  let ok=false;
  try {const cryptoKey=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',cryptoKey,signature,signed);}
  catch {throw new HttpError(401,'Invalid token signature');}
  const second=Date.now()/1000;
  must(ok&&claims.iss===domain&&(Array.isArray(claims.aud)?claims.aud.includes(aud):claims.aud===aud)&&claims.exp>second&&(!claims.nbf||claims.nbf<=second),401,'Access token is invalid or expired');
  const email=String(claims.email||'').toLowerCase();
  must(emails.includes(email),403,'This account is not an allowed admin');
  return {email};
}

export async function verifyAdmin(request, env){
  if(env.AUTH_PROVIDER==='github')return verifyGithubSession(request,env);
  if(env.AUTH_PROVIDER==='access')return verifyCloudflareAccess(request,env);
  throw new HttpError(503,'AUTH_PROVIDER must be github or access');
}
