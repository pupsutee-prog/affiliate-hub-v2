import {HttpError,must,responseError} from '../../_lib/http.js';
import {githubSettings,nonce,stateCookie,cookieHeader,makeSession} from '../../_lib/github-auth.js';

// Free pages.dev setup: public catalogue, GitHub OAuth for admin, no paid custom domain.
// All tokens are exchanged server-side. OAuth state and session are HttpOnly cookies.
export async function onRequestGet({request,env}){
  try{
    const u=new URL(request.url), action=u.pathname.split('/')[3]||'';
    if(action==='login'){
      if(env.AUTH_PROVIDER==='access')return Response.redirect(u.origin+'/api/admin/login',302);
      githubSettings(env);
      const state=nonce(), destination=new URL('https://github.com/login/oauth/authorize');
      destination.searchParams.set('client_id',env.GITHUB_CLIENT_ID);
      destination.searchParams.set('redirect_uri',u.origin+'/api/auth/callback');
      destination.searchParams.set('state',state);
      destination.searchParams.set('scope','read:user');
      const headers=new Headers({'Location':destination.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
      headers.append('Set-Cookie',cookieHeader('ah_oauth_state',state,{maxAge:600,path:'/api/auth/callback'}));
      return new Response(null,{status:302,headers});
    }
    if(action==='callback'){
      githubSettings(env);
      const state=u.searchParams.get('state')||'', expected=stateCookie(request), code=u.searchParams.get('code')||'';
      must(state.length>=30&&state===expected&&code.length>5,401,'OAuth state or code is invalid');
      const exchange=await fetch('https://github.com/login/oauth/access_token',{
        method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},
        body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:u.origin+'/api/auth/callback'})
      });
      must(exchange.ok,502,'GitHub token exchange failed');
      const token=await exchange.json();
      must(typeof token.access_token==='string'&&token.access_token.length>5,401,'GitHub login was not authorized');
      const profileResponse=await fetch('https://api.github.com/user',{
        headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+token.access_token,'User-Agent':'affiliate-hub-v2'}
      });
      must(profileResponse.ok,502,'Could not verify GitHub user');
      const profile=await profileResponse.json();
      const id=String(profile.id||''),allowed=String(env.ADMIN_GITHUB_IDS||'').split(',').map(x=>x.trim());
      must(/^\d+$/.test(id)&&allowed.includes(id),403,'GitHub account not allowed for Admin');
      const session=await makeSession(id,profile.login||id,env);
      const headers=new Headers({'Location':u.origin+'/#/admin','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
      headers.append('Set-Cookie',cookieHeader('ah_oauth_state','',{maxAge:0,path:'/api/auth/callback'}));
      headers.append('Set-Cookie',cookieHeader('ah_session',session,{path:'/api'}));
      return new Response(null,{status:302,headers});
    }
    if(action==='logout'){
      const headers=new Headers({'Location':u.origin+'/#/','Cache-Control':'no-store'});
      headers.append('Set-Cookie',cookieHeader('ah_session','',{maxAge:0,path:'/api'}));
      return new Response(null,{status:302,headers});
    }
    throw new HttpError(404,'Not found');
  }catch(err){return responseError(err);}
}
