import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestGet} from '../functions/product/[id].js';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const site={id:'site_main',slug:'main',name:'Affiliate Hub',is_active:1};
const product={id:'item-123',title:'คีย์บอร์ด "สีครีม" & เมาส์',image:'https://images.example.test/item.jpg',note:'สินค้าแนะนำ',why:'',description:''};
const env={
  DB:{prepare(query){return {bind(...args){return {async first(){
    if(query.includes('WHERE host='))return null;
    if(query.includes('FROM products'))return args[0]===site.id&&args[1]===product.id?product:null;
    return site;
  }}}}}},
  ASSETS:{async fetch(){return new Response(html,{headers:{'content-type':'text/html'}})}},
};

test('product share URL has one crawler-readable title, image and canonical URL',async()=>{
  const request=new Request('https://khongsasom.pages.dev/product/item-123');
  const response=await onRequestGet({request,env,params:{id:'item-123'}});
  const page=await response.text();
  assert.equal(response.status,200);
  assert.match(page,/<meta property="og:title" content="คีย์บอร์ด &quot;สีครีม&quot; &amp; เมาส์">/);
  assert.match(page,/<meta property="og:image" content="https:\/\/images\.example\.test\/item\.jpg">/);
  assert.match(page,/<meta property="og:url" content="https:\/\/khongsasom\.pages\.dev\/product\/item-123">/);
  assert.match(page,/<meta name="product-id" content="item-123">/);
  assert.equal((page.match(/property="og:title"/g)||[]).length,1);
});

test('unknown product share URL returns 404',async()=>{
  const request=new Request('https://khongsasom.pages.dev/product/unknown');
  const response=await onRequestGet({request,env,params:{id:'unknown'}});
  assert.equal(response.status,404);
});
