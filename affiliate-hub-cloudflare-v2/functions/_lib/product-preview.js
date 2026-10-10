import {HttpError, must} from './http.js';

const marketplaceHosts = [
  ['shopee', /^(?:[a-z0-9-]+\.)?shopee\.co\.th$/],
  ['lazada', /^(?:[a-z0-9-]+\.)?lazada\.co\.th$/],
  ['tiktok', /^(?:[a-z0-9-]+\.)?tiktok\.com$/],
  ['amazon', /^(?:[a-z0-9-]+\.)?amazon\.com$|^amzn\.to$|^a\.co$/],
];

export function marketForUrl(raw) {
  let url;
  try { url = new URL(String(raw)); } catch { throw new HttpError(400, 'ลิงก์สินค้าไม่ถูกต้อง'); }
  must(url.protocol === 'https:' && !url.username && !url.password && !url.port, 400, 'รองรับเฉพาะลิงก์ HTTPS ของร้านค้าที่กำหนด');
  const match = marketplaceHosts.find(([, pattern]) => pattern.test(url.hostname.toLowerCase()));
  must(match, 400, 'รองรับเฉพาะลิงก์ Shopee, Lazada, TikTok Shop และ Amazon');
  return {market: match[0], url};
}

function decodeHtml(value) {
  return String(value || '').replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|quot|apos|lt|gt|nbsp);/gi, (all, entity) => {
    const named = {amp:'&', quot:'"', apos:"'", lt:'<', gt:'>', nbsp:' '};
    if (entity[0] !== '#') return named[entity.toLowerCase()] || all;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
  }).replace(/\s+/g, ' ').trim();
}

export function parseProductMeta(html, baseUrl) {
  const meta = new Map();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([a-z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
      .map(([, key, quoted, single, bare]) => [key.toLowerCase(), quoted ?? single ?? bare]));
    const name = (attrs.property || attrs.name || '').toLowerCase();
    if (name && attrs.content && !meta.has(name)) meta.set(name, decodeHtml(attrs.content));
  }
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = (meta.get('og:title') || meta.get('twitter:title') || decodeHtml(titleTag?.[1])).slice(0, 140);
  const imageRaw = meta.get('og:image') || meta.get('twitter:image') || '';
  let image = '';
  try {
    const parsed = new URL(imageRaw, baseUrl);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) image = parsed.href;
  } catch {}
  return {title, image};
}

async function readHtml(response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let html = '', size = 0;
  try {
    while (size < 512000) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      html += decoder.decode(value, {stream:true});
    }
  } finally { await reader.cancel().catch(() => {}); }
  return html + decoder.decode();
}

export async function previewProduct(raw, fetcher = fetch) {
  const original = marketForUrl(raw);
  let current = original.url;
  try {
    for (let hop = 0; hop < 5; hop++) {
      const response = await fetcher(current.href, {
        method:'GET', redirect:'manual', signal:AbortSignal.timeout(10000),
        headers:{'user-agent':'Twitterbot', 'accept':'text/html,application/xhtml+xml'},
      });
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        must(location, 422, 'ร้านค้าไม่ส่งหน้าสินค้ากลับมา');
        current = new URL(location, current);
        marketForUrl(current.href); // Never follow a redirect to an unrelated host.
        continue;
      }
      must(response.ok, 422, 'ร้านค้าไม่อนุญาตให้ดึงข้อมูลลิงก์นี้');
      must((response.headers.get('content-type') || '').toLowerCase().includes('text/html'), 422, 'ลิงก์นี้ไม่ใช่หน้าสินค้า');
      const details = parseProductMeta(await readHtml(response), current.href);
      must(details.title.length >= 2 && details.image, 422, 'ร้านค้าไม่ส่งชื่อหรือรูปสินค้า กรุณาเพิ่มรายการนี้เอง');
      return {...details, market:original.market};
    }
    throw new HttpError(422, 'ลิงก์เปลี่ยนทางมากเกินไป');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422, 'ดึงข้อมูลร้านค้าไม่สำเร็จ กรุณาลองใหม่หรือเพิ่มเอง');
  }
}
