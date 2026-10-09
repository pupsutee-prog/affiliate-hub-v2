import {must,cleanText,urlValue,slugValue,safeHost} from './http.js';
export async function siteFromSlug(db,slug,includeInactive=false) {
  const site=await db.prepare('SELECT * FROM sites WHERE slug=?').bind(slug).first();
  must(site && (includeInactive||site.is_active),404,'Site not found');
  return site;
}
export async function publicSite(db,request) {
  const u=new URL(request.url),host=u.hostname.toLowerCase();
  const slug=u.searchParams.get('site');
  if(slug) return siteFromSlug(db,slug);
  const mapped=await db.prepare('SELECT * FROM sites WHERE host=? AND is_active=1').bind(host).first();
  return mapped||await siteFromSlug(db,'main');
}
export function validateSite(body) {
  const slug=slugValue(body.slug);
  const name=cleanText(body.name,100);
  must(name.length>0,400,'Site name is required');
  const tagline=cleanText(body.tagline,240);
  const host=safeHost(body.host);
  const theme=String(body.theme_color||'#4f46e5');
  must(/^#[0-9a-fA-F]{6}$/.test(theme),400,'Invalid theme color');
  return {slug,name,tagline,host,theme};
}
export function validateProduct(body) {
  const title=cleanText(body.title,140),market=cleanText(body.market,30),category=cleanText(body.category,40);
  const url=urlValue(body.url);
  must(title.length>=2,400,'Product title must be at least 2 characters');
  must(['shopee','lazada','tiktok','amazon'].includes(market),400,'Invalid market');
  const image=urlValue(body.image,false);
  const status=String(body.status||'published');
  must(['published','draft'].includes(status),400,'Invalid status');
  return {title,market,category,url,image,status,note:cleanText(body.note,120),why:cleanText(body.why,400),description:cleanText(body.description,4000),sub_id:cleanText(body.subId??body.sub_id,40)};
}
export function productOut(p) {return {id:p.id,siteId:p.site_id,title:p.title,market:p.market,category:p.category,url:p.url,image:p.image,note:p.note,why:p.why,description:p.description,subId:p.sub_id,status:p.status,clicks:p.clicks,createdAt:p.created_at,updatedAt:p.updated_at};}
export async function log(db,siteId,actor,action,itemId) {await db.prepare('INSERT INTO audit_logs (id,site_id,actor_email,action,item_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),siteId,actor,action,itemId||null).run();}
