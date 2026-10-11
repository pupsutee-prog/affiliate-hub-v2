import {json, responseError, must} from '../_lib/http.js';
import {publicSite, productOut} from '../_lib/db.js';
import {categorySlug} from '../_lib/category-link.js';

export async function onRequestGet({request,env}) {
  try {
    must(env.DB,503,'D1 binding not configured');
    const u=new URL(request.url);
    const site=await publicSite(env.DB,request);
    const id=u.searchParams.get('id');
    if(id) {
      const row=await env.DB.prepare("SELECT * FROM products WHERE site_id=? AND id=? AND status='published' AND deleted_at IS NULL").bind(site.id,id).first();
      must(row,404,'Product not found');
      return json({ok:true,site,product:productOut(row)});
    }
    const page=Math.max(1,Math.min(100000,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
    const limit=Math.max(1,Math.min(48,Number.parseInt(u.searchParams.get('limit')||'24',10)||24));
    const q=String(u.searchParams.get('q')||'').trim().slice(0,120);
    const cat=String(u.searchParams.get('category')||'').slice(0,40);
    const market=String(u.searchParams.get('market')||'').slice(0,20);
    const sort=String(u.searchParams.get('sort')||'random');
    const args=[site.id];
    let where="site_id=? AND status='published' AND deleted_at IS NULL";
    if(q){where+=' AND (title LIKE ? OR category LIKE ? OR note LIKE ?)';const query='%'+q.replace(/[\\%_]/g,'\\$&')+'%';args.push(query,query,query);where=where.replaceAll('LIKE ?','LIKE ? ESCAPE \'\\\'');}
    if(cat){where+=' AND category=?';args.push(cat);}
    if(market){where+=' AND market=?';args.push(market);}
    const seed=Math.max(1,Math.min(2147483646,Number.parseInt(u.searchParams.get('seed')||'',10)||Math.floor(Math.random()*2147483646)+1));
    const randomOrder=sort==='random';
    const order=randomOrder?'substr(id, ?, 8) COLLATE NOCASE ASC, id ASC':({oldest:'created_at ASC, id ASC',title:'title COLLATE NOCASE ASC, id ASC',newest:'created_at DESC, id DESC'})[sort]||'created_at DESC, id DESC';
    const count=await env.DB.prepare(`SELECT COUNT(*) AS n FROM products WHERE ${where}`).bind(...args).first();
    const result=await env.DB.prepare(`SELECT * FROM products WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args,...(randomOrder?[1+seed%29]:[]),limit,(page-1)*limit).all();
    const categories=await env.DB.prepare("SELECT category,COUNT(*) AS n FROM products WHERE site_id=? AND status='published' AND deleted_at IS NULL AND category<>'' GROUP BY category ORDER BY category LIMIT 100").bind(site.id).all();
    return json({ok:true,site:{id:site.id,slug:site.slug,name:site.name,tagline:site.tagline,theme_color:site.theme_color},products:result.results.map(productOut),total:count.n,page,limit,categories:categories.results.map(c=>({...c,slug:categorySlug(c.category)}))});
  } catch(e){return responseError(e);}
}
