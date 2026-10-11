import {publicSite} from '../_lib/db.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function onRequestGet({request,env,params}){
  try{
    if(!env.DB)return new Response('Product unavailable',{status:503});
    const url=new URL(request.url);
    const id=params?.id||url.pathname.split('/').filter(Boolean).at(-1);
    const site=await publicSite(env.DB,request);
    const product=await env.DB.prepare("SELECT id,title,image,category,note,why,description FROM products WHERE site_id=? AND id=? AND status='published' AND deleted_at IS NULL").bind(site.id,id).first();
    if(!product)return new Response('Product not found',{status:404});

    const canonical=url.origin+url.pathname+url.search;
    const title=product.title+' | '+site.name;
    const description=(product.note||product.why||product.description||'ดูรายละเอียดและลิงก์สินค้าจาก '+site.name).slice(0,220);
    const image=product.image||url.origin+'/assets/share-preview.png';
    const asset=await env.ASSETS.fetch(new Request(new URL('/',request.url)));
    if(!asset.ok)return asset;
    let html=await asset.text();
    html=html.replace(/<title>[^<]*<\/title>/,`<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escapeHtml(description)}">`)
      .replace(/<!-- SOCIAL_META_START -->[\s\S]*?<!-- SOCIAL_META_END -->/,`<meta property="og:type" content="website">\n<meta property="og:site_name" content="${escapeHtml(site.name)}">\n<meta property="og:title" content="${escapeHtml(product.title)}">\n<meta property="og:description" content="${escapeHtml(description)}">\n<meta property="og:url" content="${escapeHtml(canonical)}">\n<meta property="og:image" content="${escapeHtml(image)}">\n<meta property="og:image:alt" content="${escapeHtml(product.title)}">\n<meta name="twitter:card" content="summary_large_image">`)
      .replace('</head>',`<meta name="product-id" content="${escapeHtml(product.id)}">\n<link rel="canonical" href="${escapeHtml(canonical)}">\n</head>`);
    const headers=new Headers(asset.headers);
    headers.set('content-type','text/html; charset=utf-8');
    headers.set('cache-control','no-store');
    headers.delete('content-length');
    headers.delete('etag');
    return new Response(html,{status:200,headers});
  }catch(error){console.error('Product page failed:',error);return new Response('Product page unavailable',{status:500});}
}
