import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
const require=createRequire(import.meta.url);
const handler=require('../api/admin-auth.js');
const {verify,sign,hash}=handler._test;
const original={...process.env};
const password='City-Admin-Only-Long-Password_2026';
const secret='secret-for-admin-tests-is-longer-than-32-characters';
const origin='https://cityofgod-red.vercel.app';
function run(method,body=null,cookie='',requestOrigin=origin){
 return new Promise((resolve,reject)=>{
  const req=new EventEmitter();
  req.method=method;req.body=body;req.headers={host:'cityofgod-red.vercel.app',origin:requestOrigin,cookie};
  const headers={};
  const res={statusCode:200,setHeader(name,v){headers[name.toLowerCase()]=v;},
   end(text){resolve({status:res.statusCode,headers,body:JSON.parse(text||'{}')});}};
  Promise.resolve().then(()=>handler(req,res)).catch(reject);
 });
}
test.beforeEach(()=>{
 process.env.CITY_ADMIN_PASSWORD_SHA256=hash(password);
 process.env.CITY_ADMIN_SESSION_SECRET=secret;
});
test.after(()=>{for(const k of ['CITY_ADMIN_PASSWORD_SHA256','CITY_ADMIN_SESSION_SECRET']){
 if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];
}});
test('no password or secret fails closed',async()=>{
 delete process.env.CITY_ADMIN_SESSION_SECRET;
 const r=await run('GET');assert.equal(r.status,503);
 assert.equal(r.body.configured,false);
});
test('unknown user, wrong password and non-matching Origin denied',async()=>{
 assert.equal((await run('GET')).status,401);
 assert.equal((await run('POST',{password:'wrong-password-attempt'})).status,401);
 assert.equal((await run('POST',{password},'', 'https://untrusted.example')).status,403);
});
test('admin session is secure, HttpOnly, Strict and authorizes only signed sessions',async()=>{
 const login=await run('POST',{password});
 assert.equal(login.status,200);
 const cookie=login.headers['set-cookie'];
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
 const token=cookie.split(';')[0];
 assert.equal((await run('GET',null,token)).status,200);
 const modified=token.slice(0,-1)+(token.slice(-1)==='a'?'b':'a');
 assert.equal((await run('GET',null,modified)).status,401);
 assert.equal((await run('DELETE',null,token)).status,200);
});
test('expired admin tokens are rejected',()=>{
 const now=Math.floor(Date.now()/1000);
 assert.equal(verify((now-10)+'.'+sign(now-10,secret),secret,now),false);
 assert.equal(verify((now+100)+'.'+sign(now+100,secret),secret,now),true);
 assert.equal(verify((now+18000)+'.'+sign(now+18000,secret),secret,now),false);
});
test('admin is wired into runtime, blocked game inputs and has no plaintext secret',()=>{
 const ui=readFileSync(new URL('../js/admin-panel.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const game=readFileSync(new URL('../js/game.js',import.meta.url),'utf8');
 const bridge=readFileSync(new URL('../js/city-ui.js',import.meta.url),'utf8');
 const realty=readFileSync(new URL('../js/city-realty.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Function(ui));
 assert.match(index,/js\/admin-panel\.js/);
 assert.match(index,/css\/admin-panel\.css/);
 assert.match(game,/!window\.CityAdmin\?\.active&&input\.down/);
 assert.match(bridge,/window\.CityAdmin\?\.active/);
 for(const expected of ['money-set','teleport-coords','go-house','own-house',
  'deliver-vehicle','backup','heal','go-poi','logout','F10']){
  assert.match(ui,new RegExp(expected));
 }
 assert.match(realty,/adminSetOwned/);
 assert.doesNotMatch(ui,/CITY_ADMIN_PASSWORD_SHA256|CITY_ADMIN_SESSION_SECRET|CoG-BCFedoh/);
});
