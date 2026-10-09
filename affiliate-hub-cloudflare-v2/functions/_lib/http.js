export function json(data, status=200) {
  return Response.json(data, {status, headers:{'cache-control':'no-store', 'x-content-type-options':'nosniff'}});
}
export class HttpError extends Error {
  constructor(status, message) {super(message);this.status=status;}
}
export function must(condition,status,message) {if(!condition)throw new HttpError(status,message);}
export async function parseBody(request,maxBytes=256000) {
  const length=Number(request.headers.get('content-length')||0);
  must(length <= maxBytes,413,'Request too large');
  const text=await request.text();
  must(new TextEncoder().encode(text).length <= maxBytes,413,'Request too large');
  let result; try {result=JSON.parse(text);}catch {throw new HttpError(400,'Invalid JSON');}
  must(result && typeof result === 'object',400,'Invalid request');
  return result;
}
export function responseError(err) {
  const status=err instanceof HttpError?err.status:500;
  if(status===500) console.error('Affiliate Hub request failed:',err);
  return json({ok:false,error:status===500?'Internal server error':err.message},status);
}
export function urlValue(value,required=true) {
  if(!value && !required)return '';
  try {
    const url=new URL(String(value));
    must(['http:','https:'].includes(url.protocol),400,'URL must be http(s)');
    must(!url.username&&!url.password,400,'URL credentials are not allowed');
    return url.href;
  }catch(e) {if(e instanceof HttpError)throw e; throw new HttpError(400,'Invalid URL');}
}
export function safeHost(value) {
  const host=String(value||'').trim().toLowerCase();
  if(!host)return null;
  must(/^[a-z0-9.-]+$/.test(host)&&host.includes('.')&&!host.includes('..'),400,'Invalid hostname');
  return host;
}
export function slugValue(value) {
  const slug=String(value||'').toLowerCase().trim();
  must(/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug),400,'Site slug needs 2-40 lowercase letters, digits or hyphens');
  return slug;
}
export function cleanText(value,max=200) {return String(value??'').trim().slice(0,max);}
export function now() {return new Date().toISOString();}
