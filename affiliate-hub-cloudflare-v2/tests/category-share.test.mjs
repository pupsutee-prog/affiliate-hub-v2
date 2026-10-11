import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categorySlug,oldGeneratedSlug} from '../functions/_lib/category-link.js';
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

test('category paths are derived from any name, including new Thai names',()=>{
  assert.equal(categorySlug('อิเล็กทรอนิกส์'),'อิเล็กทรอนิกส์');
  assert.equal(categorySlug('ของใหม่ & ดี'),'ของใหม่ & ดี');
});

test('category page gives link previews a Thai title and opens the selected category',async()=>{
  const request=new Request('https://khongsasom.pages.dev/category/'+encodeURIComponent('อิเล็กทรอนิกส์'));
  const response=await onRequestGet({request,env});
  const page=await response.text();
  assert.equal(response.status,200);
  assert.match(page,/<title>อิเล็กทรอนิกส์ \| Affiliate Hub<\/title>/);
  assert.match(page,/<meta property="og:title" content="อิเล็กทรอนิกส์">/);
  assert.match(page,/<meta name="category-name" content="อิเล็กทรอนิกส์">/);
  assert.match(page,/<base href="\/">/);
});

test('new categories and previously shared English links both open',async()=>{
  const newRequest=new Request('https://khongsasom.pages.dev/category/'+encodeURIComponent('ของใหม่ & ดี'));
  const newPage=await onRequestGet({request:newRequest,env});
  assert.equal(newPage.status,200);
  assert.match(await newPage.text(),/<meta property="og:title" content="ของใหม่ &amp; ดี">/);
  const oldRequest=new Request('https://khongsasom.pages.dev/category/electronics');
  const oldPage=await onRequestGet({request:oldRequest,env});
  assert.equal(oldPage.status,200);
  assert.match(await oldPage.text(),/<meta name="category-name" content="อิเล็กทรอนิกส์">/);
  const previousCustomLink=new Request('https://khongsasom.pages.dev/category/'+oldGeneratedSlug('ของใหม่ & ดี'));
  const previousCustomPage=await onRequestGet({request:previousCustomLink,env});
  assert.equal(previousCustomPage.status,200);
});

test('unknown category link returns 404',async()=>{
  const request=new Request('https://khongsasom.pages.dev/category/missing');
  const response=await onRequestGet({request,env});
  assert.equal(response.status,404);
});
