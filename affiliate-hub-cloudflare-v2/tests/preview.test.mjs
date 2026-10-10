import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {previewProduct} from '../functions/_lib/product-preview.js';
import {makeSession} from '../functions/_lib/github-auth.js';
import {onRequest as admin} from '../functions/api/admin/[[path]].js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const short = 'https://s.shopee.co.th/9zyMCBLmTp';
const product = 'https://shopee.co.th/opaanlp/1357981670/41880494622?utm_medium=affiliates';
const html = '<html><head><meta content="MAO Keycaps &amp; คีย์แคปแมว" property="og:title"><meta property="og:image" content="https://down-th.img.susercontent.com/file/product-123"></head></html>';

test('Shopee short link resolves to product metadata without changing the affiliate URL', async () => {
  const visited = [];
  const fetcher = async (url, options) => {
    visited.push(url);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers['user-agent'], 'Twitterbot');
    return visited.length === 1
      ? new Response(null, {status:301, headers:{location:product}})
      : new Response(html, {headers:{'content-type':'text/html; charset=utf-8'}});
  };
  const result = await previewProduct(short, fetcher);
  assert.deepEqual(visited, [short, product]);
  assert.deepEqual(result, {market:'shopee', title:'MAO Keycaps & คีย์แคปแมว', image:'https://down-th.img.susercontent.com/file/product-123'});
});

test('metadata fetch rejects unrelated redirects and empty product metadata', async () => {
  let calls = 0;
  await assert.rejects(previewProduct(short, async () => {
    calls++;
    return new Response(null, {status:302, headers:{location:'http://127.0.0.1/internal'}});
  }), error => error.status === 400);
  assert.equal(calls, 1);
  await assert.rejects(previewProduct(short, async () => new Response('<html></html>', {headers:{'content-type':'text/html'}})), error => error.status === 422);
});

test('preview API requires Admin login and returns metadata after login', async () => {
  const origin = 'https://sample.pages.dev';
  const env = {DB:{}, AUTH_PROVIDER:'github', GITHUB_CLIENT_ID:'client', GITHUB_CLIENT_SECRET:'secret', SESSION_SECRET:'long-integration-test-secret-over-32-characters', ADMIN_GITHUB_IDS:'123'};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(html, {headers:{'content-type':'text/html'}});
  try {
    const request = cookie => new Request(origin+'/api/admin/preview', {method:'POST', headers:{Origin:origin, 'Content-Type':'application/json', ...(cookie?{Cookie:cookie}:{})}, body:JSON.stringify({url:short})});
    assert.equal((await admin({request:request(''),env})).status, 401);
    const token = await makeSession(123,'owner',env);
    const response = await admin({request:request('ah_session='+token),env});
    assert.equal(response.status, 200);
    assert.equal((await response.json()).image, 'https://down-th.img.susercontent.com/file/product-123');
  } finally {globalThis.fetch = originalFetch;}
});
