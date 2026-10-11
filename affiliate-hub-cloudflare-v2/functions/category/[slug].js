import {publicSite} from '../_lib/db.js';
import {categorySlug} from '../_lib/category-link.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function onRequestGet({request,env,params}){
  try{
    const site=await publicSite(env.DB,request);
    const categories=await env.DB.prepare("SELECT category FROM products WHERE site_id=? AND status='published' AND deleted_at IS NULL AND category<>'' GROUP BY category LIMIT 100").bind(site.id).all();
    const category=categories.results.find(row=>categorySlug(row.category)===params.slug)?.category;
    if(!category)return new Response('Category not found',{status:404});

    const url=new URL(request.url);
    const canonical=url.origin+url.pathname+url.search;
    const title=category+' | '+site.name;
    const description='สินค้าหมวด'+category+' จาก '+site.name+' — รวมลิงก์สินค้าโปรโมชันจากหลายร้านค้า';
    const asset=await env.ASSETS.fetch(new Request(new URL('/',request.url)));
    if(!asset.ok)return asset;
    let html=await asset.text();
    html=html.replace(/<title>[^<]*<\/title>/,`<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escapeHtml(description)}">`)
      .replace('</head>',`<meta name="category-name" content="${escapeHtml(category)}">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="${escapeHtml(site.name)}">\n<meta property="og:title" content="${escapeHtml(category)}">\n<meta property="og:description" content="${escapeHtml(description)}">\n<meta property="og:url" content="${escapeHtml(canonical)}">\n<meta name="twitter:card" content="summary">\n<link rel="canonical" href="${escapeHtml(canonical)}">\n</head>`);
    const headers=new Headers(asset.headers);
    headers.set('content-type','text/html; charset=utf-8');
    headers.set('cache-control','no-store');
    headers.delete('content-length');
    headers.delete('etag');
    return new Response(html,{status:200,headers});
  }catch(error){console.error('Category page failed:',error);return new Response('Category page unavailable',{status:500});}
}
