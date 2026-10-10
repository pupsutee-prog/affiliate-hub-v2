import {json,HttpError,must,parseBody,responseError,cleanText} from '../../_lib/http.js';
import {verifyAdmin} from '../../_lib/auth.js';
import {siteFromSlug,validateSite,validateProduct,productOut,log} from '../../_lib/db.js';
import {previewProduct} from '../../_lib/product-preview.js';

const stamp=()=>new Date().toISOString();
const METHODS=['GET','POST','PATCH','DELETE'];
function slugFrom(u,body){return String(u.searchParams.get('site') || (body&&body.site) || 'main').toLowerCase();}
const sha1=async(text)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function cloudinarySign(params,secret){const input=Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&')+secret;return sha1(input);}
async function requireSite(db,u,body){return siteFromSlug(db,slugFrom(u,body),true);}
async function audit(db,siteId,email,action,itemId){await log(db,siteId,email,action,itemId);}
function isObject(value){return value && typeof value==='object' && !Array.isArray(value);}
function validCloudinaryUrl(url, cloud){try{const u=new URL(url);return u.protocol==='https:' && u.hostname==='res.cloudinary.com' && u.pathname.startsWith('/'+cloud+'/');}catch{return false;}}

export async function onRequest(context){
  const {request,env}=context;
  try{
    must(env.DB,503,'D1 binding missing');
    const actor=await verifyAdmin(request,env);
    const u=new URL(request.url);
    const method=request.method.toUpperCase();must(METHODS.includes(method),405,'Method not allowed');
    if(method!=='GET')must(request.headers.get('Origin')===u.origin,403,'Cross-origin changes are forbidden');
    const path=u.pathname.replace(/^\/api\/admin\/?/,'').split('/').filter(Boolean);
    const action=path[0]||'me', id=path[1];
    if(action==='login' && method==='GET')return Response.redirect(u.origin+'/#/admin',302);
    if(action==='me' && method==='GET')return json({ok:true,email:actor.email});

    if(action==='preview' && method==='POST'){
      const body=await parseBody(request);
      return json({ok:true,...await previewProduct(body.url)});
    }

    if(action==='sites') {
      if(method==='GET'){
        const r=await env.DB.prepare("SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.site_id=s.id AND p.deleted_at IS NULL) AS products FROM sites s ORDER BY s.created_at ASC").all();
        return json({ok:true,sites:r.results});
      }
      if(method==='POST' && !id){
        const body=await parseBody(request);const s=validateSite(body),siteId=crypto.randomUUID(),time=stamp();
        await env.DB.prepare('INSERT INTO sites (id,slug,name,tagline,host,theme_color,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(siteId,s.slug,s.name,s.tagline,s.host,s.theme,time,time).run();
        await audit(env.DB,siteId,actor.email,'site.create',siteId);
        return json({ok:true,id:siteId,slug:s.slug},201);
      }
      if(method==='PATCH' && id){
        const body=await parseBody(request);const s=validateSite(body);
        const result=await env.DB.prepare('UPDATE sites SET slug=?,name=?,tagline=?,host=?,theme_color=?,is_active=?,updated_at=? WHERE id=?').bind(s.slug,s.name,s.tagline,s.host,s.theme,body.is_active===false?0:1,stamp(),id).run();
        must(result.meta.changes,404,'Site not found');await audit(env.DB,id,actor.email,'site.update',id);
        return json({ok:true});
      }
    }

    if(action==='products') {
      if(method==='GET'){
        const site=await requireSite(env.DB,u);
        const page=Math.max(1,Number.parseInt(u.searchParams.get('page')||'1',10)||1),limit=48;
        const r=await env.DB.prepare('SELECT * FROM products WHERE site_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(site.id,limit,(page-1)*limit).all();
        const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE site_id=? AND deleted_at IS NULL').bind(site.id).first();
        return json({ok:true,products:r.results.map(productOut),total:row.n,page,limit});
      }
      if(method==='POST' && !id){
        const body=await parseBody(request);const site=await requireSite(env.DB,u,body),p=validateProduct(body),pid=crypto.randomUUID(),time=stamp();
        await env.DB.prepare('INSERT INTO products (id,site_id,title,market,category,url,image,note,why,description,sub_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(pid,site.id,p.title,p.market,p.category,p.url,p.image,p.note,p.why,p.description,p.sub_id,p.status,time,time).run();
        await audit(env.DB,site.id,actor.email,'product.create',pid);
        return json({ok:true,id:pid},201);
      }
      if(method==='PATCH' && id){
        const body=await parseBody(request),site=await requireSite(env.DB,u,body),p=validateProduct(body);
        const r=await env.DB.prepare('UPDATE products SET title=?,market=?,category=?,url=?,image=?,note=?,why=?,description=?,sub_id=?,status=?,updated_at=? WHERE site_id=? AND id=? AND deleted_at IS NULL').bind(p.title,p.market,p.category,p.url,p.image,p.note,p.why,p.description,p.sub_id,p.status,stamp(),site.id,id).run();
        must(r.meta.changes,404,'Product not found');await audit(env.DB,site.id,actor.email,'product.update',id);
        return json({ok:true});
      }
      if(method==='DELETE' && id){
        const site=await requireSite(env.DB,u);
        const r=await env.DB.prepare('UPDATE products SET deleted_at=?,updated_at=? WHERE site_id=? AND id=? AND deleted_at IS NULL').bind(stamp(),stamp(),site.id,id).run();
        must(r.meta.changes,404,'Product not found');await audit(env.DB,site.id,actor.email,'product.delete',id);
        return json({ok:true});
      }
    }

    if(action==='import' && method==='POST'){
      const body=await parseBody(request,600000),site=await requireSite(env.DB,u,body);
      must(Array.isArray(body.products)&&body.products.length>0 && body.products.length<=50,400,'Import 1-50 rows per request');
      const products=body.products.map(validateProduct);
      const mode=body.mode==='replace'?'replace':'append';
      must(!(mode==='replace'&&products.length>50),400,'Replace is limited to 50 rows');
      const statements=[];
      if(mode==='replace') statements.push(env.DB.prepare('UPDATE products SET deleted_at=?,updated_at=? WHERE site_id=? AND deleted_at IS NULL').bind(stamp(),stamp(),site.id));
      for(const [i,p] of products.entries()) {
        const raw=body.products[i];
        const preserved=typeof raw.createdAt==='string' && /^\d{4}-\d{2}-\d{2}T/.test(raw.createdAt) && !Number.isNaN(Date.parse(raw.createdAt)) ? new Date(raw.createdAt).toISOString() : stamp();
        statements.push(env.DB.prepare('INSERT INTO products (id,site_id,title,market,category,url,image,note,why,description,sub_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),site.id,p.title,p.market,p.category,p.url,p.image,p.note,p.why,p.description,p.sub_id,p.status,preserved,stamp()));
      }
      await env.DB.batch(statements);await audit(env.DB,site.id,actor.email,'products.import',String(products.length));
      return json({ok:true,imported:products.length});
    }
    if(action==='export' && method==='GET'){
      const site=await requireSite(env.DB,u);
      const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE site_id=? AND deleted_at IS NULL').bind(site.id).first();
      // Export must be paged when the catalog is large to avoid Worker memory/CPU limits.
      const page=Math.max(1,Number.parseInt(u.searchParams.get('page')||'1',10)||1),limit=200;
      const rows=await env.DB.prepare('SELECT * FROM products WHERE site_id=? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT ? OFFSET ?').bind(site.id,limit,(page-1)*limit).all();
      return json({ok:true,site:site.slug,exportedAt:stamp(),page,limit,total:count.n,links:rows.results.map(productOut)});
    }
    if(action==='quota' && method==='GET'){
      const site=await requireSite(env.DB,u);
      const counts=await env.DB.prepare('SELECT COUNT(*) AS products,COALESCE(SUM(LENGTH(title)+LENGTH(url)+LENGTH(image)+LENGTH(COALESCE(description,\'\'))),0) AS text_bytes FROM products WHERE site_id=? AND deleted_at IS NULL').bind(site.id).first();
      const images=await env.DB.prepare('SELECT COUNT(*) AS images,COALESCE(SUM(bytes),0) AS bytes FROM media WHERE site_id=?').bind(site.id).first();
      let estimatedDbBytes=null;
      try {const pages=await env.DB.prepare('PRAGMA page_count').first();const size=await env.DB.prepare('PRAGMA page_size').first();estimatedDbBytes=(pages.page_count||0)*(size.page_size||0)||null;} catch {}
      return json({ok:true,site:site.slug,products:counts.products,images:images.images,imageBytes:images.bytes,approxTextBytes:counts.text_bytes,approxDbBytes:estimatedDbBytes,freeTier:{d1PerDatabaseBytes:500*1024*1024,cloudinaryMonthlyCredits:25},note:'D1 and Cloudinary readings are indicative; verify actual usage in provider dashboards. Cloudinary bytes only count images tracked by this app.'});
    }
    if(action==='upload-sign' && method==='POST'){
      const body=await parseBody(request),site=await requireSite(env.DB,u,body);
      must(env.CLOUDINARY_CLOUD_NAME&&env.CLOUDINARY_API_KEY&&env.CLOUDINARY_API_SECRET,503,'Cloudinary not configured');
      const timestamp=String(Math.floor(Date.now()/1000));
      // Public ID is signed and bound to one site, regardless of Cloudinary folder mode.
      const public_id=`affiliate-hub/${site.slug}/${crypto.randomUUID()}`;
      const params={public_id,timestamp};const signature=await cloudinarySign(params,env.CLOUDINARY_API_SECRET);
      return json({ok:true,cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,signature,...params});
    }
    if(action==='media'){
      if(method==='GET'){
        const site=await requireSite(env.DB,u);
        const items=await env.DB.prepare('SELECT * FROM media WHERE site_id=? ORDER BY created_at DESC LIMIT 100').bind(site.id).all();
        return json({ok:true,media:items.results});
      }
      if(method==='POST'&&!id){
        const body=await parseBody(request),site=await requireSite(env.DB,u,body);
        const publicId=String(body.public_id||''),imageUrl=String(body.url||''),bytes=Number(body.bytes||0);
        must(publicId.startsWith(`affiliate-hub/${site.slug}/`)&& publicId.length<300,400,'Invalid image asset');
        must(validCloudinaryUrl(imageUrl,env.CLOUDINARY_CLOUD_NAME),400,'Invalid Cloudinary URL');
        must(Number.isInteger(bytes)&&bytes>=0&&bytes<=8*1024*1024,400,'Invalid image size');
        await env.DB.prepare('INSERT OR IGNORE INTO media (id,site_id,public_id,url,bytes) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),site.id,publicId,imageUrl,bytes).run();
        await audit(env.DB,site.id,actor.email,'media.create',publicId);
        return json({ok:true});
      }
      if(method==='DELETE'&&id){
        const site=await requireSite(env.DB,u);
        const item=await env.DB.prepare('SELECT * FROM media WHERE site_id=? AND id=?').bind(site.id,id).first();must(item,404,'Image not found');
        const referenced=await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE site_id=? AND image=? AND deleted_at IS NULL').bind(site.id,item.url).first();
        must(!referenced.n,409,'Image is used by products; replace those images first');
        must(env.CLOUDINARY_API_SECRET&&env.CLOUDINARY_API_KEY&&env.CLOUDINARY_CLOUD_NAME,503,'Cloudinary not configured');
        const timestamp=String(Math.floor(Date.now()/1000)),public_id=item.public_id;
        const signature=await cloudinarySign({public_id,timestamp},env.CLOUDINARY_API_SECRET);
        const form=new FormData();form.set('public_id',public_id);form.set('timestamp',timestamp);form.set('api_key',env.CLOUDINARY_API_KEY);form.set('signature',signature);
        const reply=await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,{method:'POST',body:form});
        const result=await reply.json().catch(()=>({}));
        must(reply.ok && (result.result==='ok'||result.result==='not found'),502,'Cloudinary image deletion failed');
        await env.DB.prepare('DELETE FROM media WHERE site_id=? AND id=?').bind(site.id,id).run();
        await audit(env.DB,site.id,actor.email,'media.delete',public_id);
        return json({ok:true});
      }
    }
    throw new HttpError(404,'Admin endpoint not found');
  }catch(e){return responseError(e);}
}
