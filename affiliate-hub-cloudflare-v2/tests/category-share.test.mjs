import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categorySlug} from '../functions/_lib/category-link.js';
import {onRequestGet} from '../functions/category/[slug].js';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const site={id:'site_main',slug:'main',name:'Affiliate Hub',is_active:1};
const categories=[{category:'อิเล็กทรอนิกส์'},{category:'ของใหม่ & ดี'}];
const env={
  DB:{prepare(query){return {bind(){return {
    async first(){return query.includes('WHERE host=')?null:site},
    async all(){return {results:categories}},
  }}}}},
  ASSETS:{async fetch(){return new Response(html,{headers:{'content-type':'text/html'}})}},
};

test('category URLs have short stable slugs',()=>{
  assert.equal(categorySlug('อิเล็กทรอนิกส์'),'electronics');
  assert.equal(categorySlug('กีฬา'),'sports');
  assert.match(categorySlug('ของใหม่ & ดี'),/^c-[a-z0-9]{1,13}$/);
  assert.equal(categorySlug('ของใหม่ & ดี'),categorySlug('ของใหม่ & ดี'));
});

test('category page gives link previews a Thai title and opens the selected category',async()=>{
  const request=new Request('https://khongsasom.pages.dev/category/electronics');
  const response=await onRequestGet({request,env,params:{slug:'electronics'}});
  const page=await response.text();
  assert.equal(response.status,200);
  assert.match(page,/<title>อิเล็กทรอนิกส์ \| Affiliate Hub<\/title>/);
  assert.match(page,/<meta property="og:title" content="อิเล็กทรอนิกส์">/);
  assert.match(page,/<meta name="category-name" content="อิเล็กทรอนิกส์">/);
  assert.match(page,/<base href="\/">/);
});

test('unknown category link returns 404',async()=>{
  const request=new Request('https://khongsasom.pages.dev/category/missing');
  const response=await onRequestGet({request,env,params:{slug:'missing'}});
  assert.equal(response.status,404);
});
